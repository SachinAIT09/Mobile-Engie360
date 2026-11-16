/**
 * ENGIE360 demo state and operations. Seeded from the mock-up's own data (src/data), so the server
 * and the UI tell the same story. Pure over Db + an event sink: unit-tested without HTTP.
 */
import { randomUUID } from 'node:crypto';
import type {
  Activity,
  ActivityKind,
  AssistantReply,
  AssistantRequest,
  BillingResponse,
  ChatLogEntry,
  Conversation,
  CustomerResponse,
  EnergyResponse,
  InboxMessage,
  InsightsResponse,
  InstallmentState,
  LiveEvent,
  MessageTemplate,
  StaffMessageRequest,
  StaffOverview,
  Text,
} from '../shared/contract.ts';
import { brand } from '../src/brand';
import { contract, customer } from '../src/data/customer';
import { benchmark, breakdown, daily, hourly, lastMonthSummary, monthly, peakSplit, thisMonth, tomorrowPrices, weekly } from '../src/data/energy';
import { annualOverview, invoices, payments } from '../src/data/billing';
import { insights, notificationsSeed } from '../src/data/insights';
import { reply as scriptedReply } from '../src/assistant/mockProvider';
import { DEMO_NOW } from '../src/lib/time';
import type { Db } from './db.ts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const DAY = 86_400_000;
const ago = (ms: number) => new Date(DEMO_NOW.getTime() - ms).toISOString();
const eur = (v: number, lang: 'en' | 'nl') => new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
const T = (en: string, nl: string): Text => ({ en, nl });

/** Seed inbox: the mock-up's notifications, dated relative to the demo clock. */
const SEED_AGES: Record<string, number> = { n1: 5 * DAY, n2: 3_600_000, n3: 2 * DAY, n4: 30 * DAY };

const PAGE_NAMES: Record<string, Text> = {
  '/': T('Home', 'Home'),
  '/energy': T('Energy consumption', 'Energieverbruik'),
  '/billing': T('Bills & payments', 'Nota’s & betalingen'),
  '/insights': T('Energy insights', 'Energie-inzichten'),
  '/smart-energy': T('Smart Energy', 'Slimme Energie'),
  '/assistant': T(brand.assistant.name, brand.assistant.name),
  '/account': T('My account', 'Mijn account'),
  '/website-demo': T(`${brand.name}.nl (website)`, `${brand.name}.nl (website)`),
};

export const TEMPLATES: MessageTemplate[] = [
  {
    id: 'cheap-hours',
    icon: 'ev',
    title: T('Cheapest hours tonight: 02:00–05:00', 'Goedkoopste uren vannacht: 02:00–05:00'),
    body: T('Charge your car tonight for €0.17/kWh. Smart charging can do it for you.', 'Laad je auto vannacht voor €0,17/kWh. Slim laden regelt het voor je.'),
    to: '/smart-energy',
  },
  {
    id: 'installment',
    icon: 'wallet',
    title: T('Advice: raise your installment to €198', 'Advies: verhoog je termijnbedrag naar €198'),
    body: T('Since EV charging started, €198 a month avoids a bill of about €156 in March.', 'Sinds je je auto laadt, voorkom je met €198 per maand een nabetaling van zo’n €156 in maart.'),
    to: '/billing?adjust=1',
  },
  {
    id: 'night-use',
    icon: 'moon',
    title: T('Did something stay on last night?', 'Bleef er vannacht iets aan staan?'),
    body: T('We saw 1.4 kW between 01:40 and 04:10, six times your normal night use.', 'We zagen 1,4 kW tussen 01:40 en 04:10, zes keer je normale nachtverbruik.'),
    to: '/insights#night-anomaly',
  },
  {
    id: 'invoice',
    icon: 'doc',
    title: T('Your November installment invoice is ready', 'Je termijnnota van november staat klaar'),
    body: T('€185.00, collected on 28 November.', '€185,00, afgeschreven op 28 november.'),
    to: '/billing#invoices',
  },
  {
    id: 'solar',
    icon: 'sun',
    title: T('Your roof fits 10 solar panels', 'Je dak is geschikt voor 10 zonnepanelen'),
    body: T(`About €610 a year. Ask ${brand.assistant.name} what it means for you.`, `Zo’n €610 per jaar. Vraag ${brand.assistant.name} wat het voor jou betekent.`),
    to: '/assistant?q=solar',
  },
];

export class Store {
  constructor(
    private readonly db: Db,
    private readonly emit: (e: LiveEvent) => void,
    /** Clock for new records. Seeds always use the demo clock. */
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!db.get<boolean>('seeded')) this.seed();
  }

  // ------------------------------------------------------------ seed / reset

  seed(): void {
    this.db.set<InstallmentState>('installment', { current: contract.installment, advised: contract.advisedInstallment, pending: null });
    this.db.set<string[]>('plan', ['ev-peak']);
    this.db.set('contact', { email: customer.email, phone: customer.phone });
    this.db.set<string | null>('lastSeen', null);
    for (const t of ['messages', 'activity', 'conversations'] as const) this.db.clear(t);
    for (const n of notificationsSeed) {
      const createdAt = ago(SEED_AGES[n.id] ?? DAY);
      const msg: InboxMessage = { id: n.id, source: 'system', icon: n.icon, title: n.title, body: n.body, to: n.to, createdAt, read: !n.unread };
      this.db.put('messages', msg.id, createdAt, msg);
    }
    this.db.set('seeded', true);
  }

  reset(): void {
    this.seed();
    this.emit({ type: 'demo:reset' });
  }

  // ------------------------------------------------------------ reads

  get installment(): InstallmentState {
    return this.db.get<InstallmentState>('installment')!;
  }

  get plan(): string[] {
    return this.db.get<string[]>('plan') ?? [];
  }

  customer(): CustomerResponse {
    const contact = this.db.get<{ email: string; phone: string }>('contact');
    return { customer: { ...customer, ...contact }, contract, installment: this.installment, demoNow: DEMO_NOW.toISOString() };
  }

  energy(): EnergyResponse {
    return {
      monthly,
      daily,
      weekly,
      hourly,
      tomorrowPrices,
      thisMonth: { ...thisMonth, costSoFar: thisMonth.costSoFar, forecastCost: thisMonth.forecastCost },
      lastMonth: lastMonthSummary,
      peakSplit,
      breakdown,
      benchmark,
    };
  }

  billing(): BillingResponse {
    return { invoices, payments, annualOverview, installment: this.installment };
  }

  insights(): InsightsResponse {
    return { insights, plan: this.plan };
  }

  messages(): InboxMessage[] {
    return this.db.list<InboxMessage>('messages');
  }

  activity(limit = 100): Activity[] {
    return this.db.list<Activity>('activity', limit);
  }

  conversations(): Conversation[] {
    return this.db.list<Conversation>('conversations', 50);
  }

  overview(pushDevices: number, online: number): StaffOverview {
    const c = this.customer();
    const planIds = this.plan;
    return {
      customer: c.customer,
      contract,
      installment: this.installment,
      kpis: {
        electricityThisMonth: thisMonth.electricity,
        gasThisMonth: thisMonth.gas,
        costSoFar: Math.round(thisMonth.costSoFar * 100) / 100,
        expectedSettlement: annualOverview.estimatedTotal - (annualOverview.paidSoFar + (this.installment.pending?.amount ?? this.installment.current) * 4),
        savingsPlanPerYear: insights.filter((i) => planIds.includes(i.id)).reduce((s, i) => s + (i.saving ?? 0), 0),
      },
      plan: planIds,
      pushDevices,
      unreadMessages: this.messages().filter((m) => !m.read).length,
      lastSeen: this.db.get<string | null>('lastSeen') ?? null,
      online,
    };
  }

  // ------------------------------------------------------------ customer actions

  log(kind: ActivityKind, text: Text, to?: string): Activity {
    const a: Activity = { id: randomUUID(), ts: this.now().toISOString(), kind, text, to };
    this.db.put('activity', a.id, a.ts, a);
    this.db.set('lastSeen', a.ts);
    this.emit({ type: 'activity', activity: a });
    return a;
  }

  trackPage(route: string): void {
    const path = route.split(/[?#]/)[0] ?? '/';
    const name = PAGE_NAMES[path];
    if (!name) throw new HttpError(400, `Unknown page ${path}`);
    this.log('page', T(`Viewed ${name.en}`, `Bekeek ${name.nl}`), path);
  }

  setInstallment(amount: number): InstallmentState {
    const { min, max } = contract.installmentRange;
    if (!Number.isInteger(amount) || amount < min || amount > max) throw new HttpError(400, `Installment must be a whole number between ${min} and ${max}`);
    const current = this.installment;
    const next: InstallmentState = {
      ...current,
      pending: amount === current.current ? null : { amount, from: '2026-12', changedAt: this.now().toISOString() },
    };
    this.db.set('installment', next);
    this.emit({ type: 'installment:changed', installment: next });
    this.log('installment', T(`Changed installment to ${eur(amount, 'en')} from December`, `Termijnbedrag gewijzigd naar ${eur(amount, 'nl')} vanaf december`), '/billing');
    return next;
  }

  setPlan(id: string, on: boolean): string[] {
    const insight = insights.find((i) => i.id === id);
    if (!insight) throw new HttpError(404, `Unknown insight ${id}`);
    const plan = this.plan.filter((x) => x !== id);
    if (on) plan.push(id);
    this.db.set('plan', plan);
    this.emit({ type: 'insights:plan', plan });
    this.log('plan', on ? T(`Added “${insight.title.en}” to savings plan`, `“${insight.title.nl}” toegevoegd aan bespaarplan`) : T(`Removed “${insight.title.en}” from savings plan`, `“${insight.title.nl}” verwijderd uit bespaarplan`), '/insights');
    return plan;
  }

  setCharging(active: boolean, kwh: number, readyBy: number): void {
    if (!Number.isFinite(kwh) || kwh <= 0 || kwh > 100 || !Number.isInteger(readyBy) || readyBy < 0 || readyBy > 23) throw new HttpError(400, 'Invalid charging schedule');
    const hh = `${String(readyBy).padStart(2, '0')}:00`;
    this.log('charging', active ? T(`Scheduled smart charging: ${kwh} kWh ready by ${hh}`, `Slim laden ingepland: ${kwh} kWh klaar om ${hh}`) : T('Paused smart charging', 'Slim laden gepauzeerd'), '/smart-energy');
  }

  setContact(email: string, phone: string): void {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || phone.trim().length < 6) throw new HttpError(400, 'Invalid email or phone');
    this.db.set('contact', { email: email.trim(), phone: phone.trim() });
    this.log('contact', T('Updated contact details', 'Contactgegevens bijgewerkt'), '/account');
  }

  markRead(id: string | 'all'): void {
    const msgs = this.messages();
    const targets = id === 'all' ? msgs.filter((m) => !m.read) : msgs.filter((m) => m.id === id);
    if (id !== 'all' && targets.length === 0) throw new HttpError(404, `Unknown message ${id}`);
    for (const m of targets) this.db.put('messages', m.id, m.createdAt, { ...m, read: true });
    this.emit({ type: 'message:read', id });
    const staffRead = targets.find((m) => m.source === 'staff');
    if (staffRead) this.log('message_read', T(`Read “${staffRead.title.en}”`, `Las “${staffRead.title.nl}”`));
  }

  // ------------------------------------------------------------ Eva

  ask(req: AssistantRequest): AssistantReply {
    const question = req.question.trim().slice(0, 500);
    if (!question) throw new HttpError(400, 'Empty question');
    if (!/^[\w-]{4,64}$/.test(req.conversationId)) throw new HttpError(400, 'Invalid conversationId');
    const reply = scriptedReply(question, req.context);
    const ts = this.now().toISOString();
    const existing = this.db.find<Conversation>('conversations', req.conversationId);
    const conv: Conversation = existing ?? { id: req.conversationId, channel: req.channel, audience: req.context.audience, lang: req.context.lang, startedAt: ts, updatedAt: ts, entries: [] };
    const user: ChatLogEntry = { role: 'user', text: question, ts };
    const bot: ChatLogEntry = { role: 'assistant', text: reply.text, intent: reply.intent, ts };
    conv.entries.push(user, bot);
    conv.audience = req.context.audience;
    conv.lang = req.context.lang;
    conv.updatedAt = ts;
    this.db.put('conversations', conv.id, ts, conv);
    this.emit({ type: 'chat:message', conversationId: conv.id, channel: conv.channel, entry: user });
    this.emit({ type: 'chat:message', conversationId: conv.id, channel: conv.channel, entry: bot });
    if (!existing) {
      const where = req.channel === 'website' ? T(`on ${brand.name}.nl`, `op ${brand.name}.nl`) : T(`in ${brand.portal}`, `in ${brand.portal}`);
      this.log('chat', T(`Started a chat with ${brand.assistant.name} ${where.en}: “${question}”`, `Startte een chat met ${brand.assistant.name} ${where.nl}: “${question}”`), '/assistant');
    }
    return reply;
  }

  // ------------------------------------------------------------ staff

  sendStaffMessage(req: StaffMessageRequest): InboxMessage {
    const title = { en: req.title.en.trim(), nl: req.title.nl.trim() || req.title.en.trim() };
    const body = { en: req.body.en.trim(), nl: req.body.nl.trim() || req.body.en.trim() };
    if (!title.en || !body.en || title.en.length > 120 || body.en.length > 500) throw new HttpError(400, 'Title and body are required (max 120 / 500 characters)');
    if (req.to && !req.to.startsWith('/')) throw new HttpError(400, 'Link must be an in-app route');
    const createdAt = this.now().toISOString();
    const msg: InboxMessage = {
      id: `s-${randomUUID().slice(0, 8)}`,
      source: 'staff',
      icon: req.icon ?? 'bell',
      title,
      body,
      to: req.to ?? '/',
      createdAt,
      read: false,
      sender: req.sender?.trim() || `Lotte · ${brand.name} Klantenservice`,
    };
    this.db.put('messages', msg.id, createdAt, msg);
    this.emit({ type: 'message:new', message: msg, banner: true });
    this.log('staff_message', T(`${brand.name} sent “${title.en}”`, `${brand.name} stuurde “${title.nl}”`), msg.to);
    return msg;
  }
}
