import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  ASSISTANT,
  BRAND,
  applianceBreakdown,
  lastMonthSummary,
  monthlyUsage,
  peakSplit,
  thisMonth,
  type AssistantAnswer,
  type AssistantChannel,
  type AssistantContext,
  type AssistantInsights,
  type AssistantLogEntry,
  type AssistantSuggestions,
  type Lang,
} from '@engie/shared';
import { BillingService } from '../billing/billing.service.js';
import type { AssistantLogDoc } from '../db/schemas.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { usageProfile } from '../usage/usage.service.js';
import { nextEventWindow } from '../common/time.js';
import { CampaignsService } from '../campaigns/campaigns.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { Db } from '../db/db.service.js';
import { FlexEventsService } from '../flex-events/flex-events.service.js';
import { GridService } from '../grid/grid.service.js';
import { ReportsService } from '../grid/reports.service.js';
import { answerEva, phrase, type EvaAnswer, type EvaFacts } from './eva-answers.js';
import { INTENTS as EVA_INTENTS, SUGGESTIONS as EVA_SUGGESTIONS } from './eva-intents.js';
import { matchIntent as matchEva } from './eva-nlu.js';
import { STAFF_INTENTS, STAFF_SUGGESTIONS } from './intents.js';
import { summariseLog } from './log-summary.js';
import { matchIntent } from './nlu.js';
import { answerStaff, type DraftTarget, type StaffFacts, type StaffQuestion } from './staff-answers.js';

/**
 * Scripted, stateless assistant. Matches the question to an intent (nlu.ts), gathers only the facts that
 * intent needs from the existing services, then hands plain objects to the pure answer functions.
 * No model and no external calls; the client echoes `context` back for follow-ups.
 */
@Injectable()
export class AssistantService {
  private readonly log_ = new Logger('Assistant');

  constructor(
    private readonly db: Db,
    private readonly grid: GridService,
    private readonly reports: ReportsService,
    private readonly campaigns: CampaignsService,
    private readonly flexEvents: FlexEventsService,
    private readonly customers: CustomersService,
    private readonly billing: BillingService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Await a fact, degrading to `fallback` (and a log line) when the source is unavailable. */
  private async safe<T>(what: string, p: Promise<T>, fallback: T): Promise<T> {
    try {
      return await p;
    } catch (e) {
      this.log_.debug(`${what} unavailable: ${(e as Error).message}`);
      return fallback;
    }
  }

  // ------------------------------------------------------------ staff

  async askStaff(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    const now = new Date();
    const m = matchIntent(question, STAFF_INTENTS, context);
    const q: StaffQuestion = { intent: m.intent, entities: m.entities, context, now };
    const facts = await this.staffFacts(q, question);
    return answerStaff(q, facts);
  }

  private async staffFacts(q: StaffQuestion, question: string): Promise<StaffFacts> {
    const e = q.entities;
    const districtCode = e.districtCodes[0] ?? q.context.districtCode ?? null;
    switch (q.intent) {
      case 'DISTRICT_STATUS': {
        const [district, blindSpots] = await Promise.all([
          districtCode ? this.safe('district', this.grid.district(districtCode), null) : Promise.resolve(null),
          this.grid.blindSpots(),
        ]);
        return { districtCode, district, blindSpots };
      }
      case 'BLIND_SPOTS':
        return { blindSpots: await this.grid.blindSpots() };
      case 'OVERVIEW':
        return { overview: await this.grid.overview() };
      case 'CAMPAIGN_PERFORMANCE':
        return { campaigns: await this.campaigns.list() };
      case 'DR_PERFORMANCE': {
        const [reports, flexEvents] = await Promise.all([this.reports.summary(q.now), this.flexEvents.list()]);
        return { reports, flexEvents };
      }
      case 'ENROLLMENT_TREND':
        return { reports: await this.reports.summary(q.now) };
      case 'GRID_RISK': {
        const docs = await this.db.districts.find({ forecastLoadPct: { $ne: null } }, { code: 1, forecastLoadPct: 1, live: 1 }).lean();
        const live = docs.filter((d) => d.live).map((d) => d.code);
        const counts = live.length ? await this.grid.liveCounts(live) : new Map();
        const w = nextEventWindow(q.now);
        return {
          riskDistricts: docs.map((d) => ({ code: d.code, forecastLoadPct: d.forecastLoadPct ?? 0, known: d.live ? counts.get(d.code)?.known ?? 0 : null })),
          nextWindow: { start: w.start.toISOString(), end: w.end.toISOString() },
        };
      }
      case 'DRAFT_CAMPAIGN': {
        const blindSpots = await this.grid.blindSpots();
        let codes = e.districtCodes.slice(0, 10);
        if (!codes.length) {
          const wantsTop = e.count !== null || /blind ?spots?|worst|biggest|\btop\b/i.test(question);
          if (wantsTop) codes = blindSpots.slice(0, Math.min(Math.max(e.count ?? 3, 1), 10)).map((b) => b.districtCode);
          else if (districtCode) codes = [districtCode];
          else if (blindSpots[0]) codes = [blindSpots[0].districtCode];
        }
        const stats = await Promise.all(codes.map((c) => this.safe('district', this.grid.district(c), null)));
        const draftTargets: DraftTarget[] = stats
          .filter((s): s is NonNullable<typeof s> => !!s && s.known !== null)
          .map((s) => ({ code: s.code, known: s.known ?? 0, unenrolled: s.unenrolled ?? 0 }));
        return { blindSpots, draftTargets };
      }
      case 'FLEX_LOAD': {
        const [reports, overview] = await Promise.all([this.reports.summary(q.now), this.grid.overview()]);
        return { reports, overview };
      }
      default:
        return {};
    }
  }

  async staffSuggestions(): Promise<AssistantSuggestions> {
    const top = (await this.safe('blind spots', this.grid.blindSpots(), []))[0];
    const dynamic = top ? [`How is ${top.districtCode} doing?`] : [];
    return {
      greeting: 'Ask me about postcode districts, EVs not yet in Slim Laden, campaigns, flex events or grid congestion. I answer from the live demo data.',
      suggestions: [...dynamic, ...STAFF_SUGGESTIONS.filter((s) => s !== STAFF_SUGGESTIONS[0] || !top)].slice(0, 9),
    };
  }

  // ------------------------------------------------------------ Eva (customer app and website)

  /** Facts for a signed-in customer; everything Eva may quote comes from the same services as the app screens. */
  private async evaFacts(customerId: string, lang: Lang, now: Date): Promise<EvaFacts> {
    const c = await this.customers.get(customerId);
    const profile = usageProfile(c);
    const [ev, billing, activeFlexEvent] = await Promise.all([
      this.customers.evStatus(c),
      this.billing.overview(customerId, now),
      this.safe('flex event', this.flexEvents.activeForCustomer(customerId), null),
    ]);
    return {
      audience: 'customer',
      lang,
      now,
      firstName: c.firstName,
      city: c.city,
      gridOperator: c.gridOperator,
      ibanMasked: c.ibanMasked,
      contract: c.contract,
      evStatus: ev.status,
      thisMonth: thisMonth(profile, now),
      lastMonth: lastMonthSummary(profile, now),
      months: monthlyUsage(profile, now),
      breakdown: applianceBreakdown(profile, now, c.hasHeatPump),
      peakPct: peakSplit(profile, now).peakPct,
      invoices: billing.invoices,
      annual: billing.annual,
      insights: await this.customers.insightsFor(c, ev.status, billing.annual.expectedSettlement, now),
      activeFlexEvent,
    };
  }

  private async log(channel: AssistantChannel, question: string, a: EvaAnswer, lang: Lang, customer: { id: string; name: string } | null): Promise<void> {
    try {
      const doc = await this.db.assistantLog.create({
        at: new Date(),
        channel,
        customerId: customer ? new Types.ObjectId(customer.id) : null,
        customerName: customer?.name ?? null,
        question: question.replace(/\s+/g, ' ').trim().slice(0, 300),
        intent: a.intent,
        matched: a.matched,
        signInPrompt: a.signInPrompt,
        handoff: a.handoff,
        lang,
        synthetic: false,
      });
      this.realtime.toStaff('assistant:logged', AssistantService.logDto(doc.toObject()));
    } catch (e) {
      this.log_.debug(`assistant log failed: ${(e as Error).message}`);
    }
  }

  static logDto(d: AssistantLogDoc): AssistantLogEntry {
    return {
      id: String(d._id),
      at: d.at.toISOString(),
      channel: d.channel,
      customerId: d.customerId ? String(d.customerId) : null,
      customerName: d.customerName ?? null,
      question: d.question,
      intent: d.intent,
      matched: d.matched,
      signInPrompt: d.signInPrompt,
      handoff: d.handoff,
      lang: d.lang,
    };
  }

  /** A signed-in customer asks Eva (in the app, or on the website after signing in). */
  async askMe(customerId: string, question: string, context: AssistantContext, lang?: Lang, channel: AssistantChannel = 'APP'): Promise<EvaAnswer> {
    const now = new Date();
    const c = await this.customers.get(customerId);
    const l = lang ?? c.lang ?? 'nl';
    const m = matchEva(question, EVA_INTENTS, context.lastIntent);
    const a = answerEva({ intent: m.intent, entities: m.entities, text: question, route: context.route }, await this.evaFacts(customerId, l, now));
    await this.log(channel, question, a, l, { id: customerId, name: `${c.firstName} ${c.lastName}` });
    return a;
  }

  /** A website visitor asks Eva: general answers, and a sign-in prompt for anything personal. */
  async askPublic(question: string, context: AssistantContext, lang: Lang = 'nl'): Promise<EvaAnswer> {
    const m = matchEva(question, EVA_INTENTS, context.lastIntent);
    const a = answerEva({ intent: m.intent, entities: m.entities, text: question, route: context.route }, { audience: 'visitor', lang, now: new Date() });
    await this.log('WEBSITE', question, a, lang, null);
    return a;
  }

  async mySuggestions(customerId: string, lang?: Lang, route?: string): Promise<AssistantSuggestions> {
    const c = await this.customers.get(customerId);
    const l = lang ?? c.lang ?? 'nl';
    const ids = EVA_SUGGESTIONS[route ?? 'default'] ?? EVA_SUGGESTIONS.default ?? [];
    return {
      greeting:
        l === 'nl'
          ? `Hoi ${c.firstName}! Ik ben ${ASSISTANT.customerName.nl}. Vraag me naar je verbruik, nota's, termijnbedrag of het laden van je auto.`
          : `Hi ${c.firstName}! I'm ${ASSISTANT.customerName.en}. Ask me about your usage, invoices, installment or EV charging.`,
      suggestions: ids.map((id) => phrase(id, l)),
    };
  }

  publicSuggestions(lang: Lang = 'nl'): AssistantSuggestions {
    return {
      greeting:
        lang === 'nl'
          ? `${ASSISTANT.customerIntro.nl} Vraag me naar onze energiecontracten, overstappen of je nota. Log in bij ${BRAND.appName} voor antwoorden over je eigen account.`
          : `${ASSISTANT.customerIntro.en} Ask me about our energy contracts, switching, or your bill. Sign in to ${BRAND.appName} for answers about your own account.`,
      suggestions: (EVA_SUGGESTIONS.visitor ?? []).map((id) => phrase(id, lang)),
    };
  }

  // ------------------------------------------------------------ staff: what customers ask Eva

  async insights(now = new Date()): Promise<AssistantInsights> {
    const since = new Date(now.getTime() - 24 * 3600000);
    const [all, total] = await Promise.all([
      this.db.assistantLog.find({ at: { $gte: since } }).sort({ at: -1 }).lean(),
      this.db.assistantLog.countDocuments({}),
    ]);
    return summariseLog(all.map(AssistantService.logDto), total, now);
  }
}
