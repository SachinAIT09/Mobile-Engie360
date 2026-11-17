/**
 * ENGIE360 demo state and operations. Seeded from the mock-up's own data (src/data), so the server
 * and the UI tell the same story. Pure over Db + an event sink: unit-tested without HTTP.
 */
import { randomUUID } from 'node:crypto';
import type {
  Activity,
  ActivityKind,
  AttentionFlag,
  AttentionItem,
  AuditAction,
  AuditEntry,
  AssistantReply,
  AssistantRequest,
  BillingResponse,
  ChatLogEntry,
  Conversation,
  CustomerDetail,
  CustomerFilter,
  CustomerResponse,
  CustomerSummary,
  CustomersResponse,
  EnergyResponse,
  InboxMessage,
  InsightsResponse,
  InstallmentState,
  PayMethod,
  PayState,
  LiveEvent,
  OutboxItem,
  Portfolio,
  QueueItem,
  ReportGroup,
  ReportsResponse,
  StaffAssistantRequest,
  StaffMessageRequest,
  StaffOverview,
  Text,
} from '../shared/contract.ts';
import { brand } from '../src/brand';
import { contract, customer } from '../src/data/customer';
import { POPULATION, PRODUCTS, type PopCustomer } from '../src/data/customers';
import { benchmark, breakdown, daily, hourly, lastMonthSummary, monthly, peakSplit, thisMonth, tomorrowPrices, weekly } from '../src/data/energy';
import { annualOverview, PAY_DEFAULTS, withPayments, type Payment } from '../src/data/billing';
import { insights, notificationsSeed } from '../src/data/insights';
import { TEMPLATES } from '../src/data/templates';
import { staffReply } from '../src/assistant/staff';
import { reply as scriptedReply } from '../src/assistant/mockProvider';
import { DEMO_NOW, DEMO_TZ } from '../src/lib/time';
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
/** Exact amounts (payments), with cents. */
const eur2 = (v: number, lang: 'en' | 'nl') => new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(v);
const PAY_METHODS: Record<PayMethod, Text> = { ideal: T('iDEAL', 'iDEAL'), account: T('Bank account', 'Bankrekening'), card: T('Card', 'Kaart') };

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
};

export { TEMPLATES };

const STAFF: AuditEntry['actor'] = { kind: 'STAFF', name: 'Lotte', role: T('Customer Service', 'Klantenservice') };
/** The customer-service team (Lotte is the one signed in). */
const TEAM: AuditEntry['actor'][] = [STAFF, ...['Daniel Reed', 'Megan Brooks', 'Chris Howard'].map((name) => ({ kind: 'STAFF' as const, name, role: T('Customer Service', 'Klantenservice') }))];
const SYSTEM: AuditEntry['actor'] = { kind: 'SYSTEM', name: brand.portal, role: T('Automatic', 'Automatisch') };

export const LIVE_ID = customer.id;
const FLAGS: AttentionFlag[] = ['installment', 'ev-peak', 'night-use'];
/** What each attention point is called, which message goes with it, and how it looks. */
const FLAG_INFO: Record<AttentionFlag, { label: Text; detail: Text; icon: QueueItem['icon']; tone: QueueItem['tone']; templateId: string }> = {
  installment: { label: T('Installment too low', 'Termijnbedrag te laag'), detail: T('They will have to pay extra at the annual statement. Advise a higher installment.', 'Ze moeten bijbetalen bij de jaarnota. Adviseer een hoger termijnbedrag.'), icon: 'wallet', tone: 'warn', templateId: 'installment' },
  'ev-peak': { label: T('EV charging at peak hours', 'Auto laden in piekuren'), detail: T('They charge in the most expensive hours. Smart charging saves about €142 a year each.', 'Ze laden in de duurste uren. Slim laden bespaart elk zo’n €142 per jaar.'), icon: 'ev', tone: 'info', templateId: 'cheap-hours' },
  'night-use': { label: T('Unusual night-time use', 'Ongebruikelijk nachtverbruik'), detail: T('Several times the normal night load in the past week. Ask if something was left on.', 'Meerdere keren het normale nachtverbruik in de afgelopen week. Vraag of er iets aan bleef staan.'), icon: 'moon', tone: 'alert', templateId: 'night-use' },
};
/** Rows per page the customer list accepts; anything else falls back to 10. */
const PAGE_SIZES = [10, 15, 30, 50];
/** How busy the app is through the day: actions per 100 app users, per hour (Amsterdam time). */
const HOURLY = [1, 1, 0, 0, 1, 2, 5, 9, 11, 9, 8, 8, 10, 9, 8, 8, 9, 12, 15, 17, 14, 10, 6, 3];
const EVA_QUESTIONS = ['Why is my energy bill higher this month?', 'When should I charge my EV?', 'What is my current monthly installment?', 'How can I reduce my electricity costs?', 'Can you explain my latest invoice?'];

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

  /** Back to the starting data. All of it is written in one transaction, so a reset takes milliseconds. */
  seed(): void {
    this.db.transaction(() => this.writeSeed());
  }

  private writeSeed(): void {
    this.db.set<InstallmentState>('installment', { current: contract.installment, advised: contract.advisedInstallment, pending: null });
    this.db.set<PayState>('pay', { ...PAY_DEFAULTS });
    this.db.set<string[]>('plan', ['ev-peak']);
    this.db.set('contact', { email: customer.email, phone: customer.phone });
    this.db.set<string | null>('lastSeen', null);
    this.db.set('charging', false);
    this.db.set('resolved', {});
    this.db.set('seen', {});
    this.db.clear('feed');
    for (const t of ['messages', 'activity', 'conversations', 'outbox', 'audit'] as const) this.db.clear(t);
    for (const n of notificationsSeed) {
      const createdAt = ago(SEED_AGES[n.id] ?? DAY);
      const msg: InboxMessage = { id: n.id, source: 'system', icon: n.icon, title: n.title, body: n.body, to: n.to, createdAt, read: !n.unread };
      this.db.put('messages', msg.id, createdAt, msg);
      // The automatic notifications are the start of the audit trail.
      const entry: AuditEntry = { id: `a-${n.id}`, at: createdAt, actor: SYSTEM, action: 'ALERT_SENT', target: n.title, summary: T(`Automatic notification to ${customer.firstName}: ${n.body.en}`, `Automatische melding aan ${customer.firstName}: ${n.body.nl}`) };
      this.db.put('audit', entry.id, createdAt, entry);
    }
    this.seedHistory();
    this.db.set('seeded', true);
    // Some recent activity across the customer base, so the staff feed is alive from the start.
    let n = 7;
    const rand = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 40; i >= 1; i--) this.simulate(rand, this.now().getTime() - i * 4.5 * 60_000, false);
  }

  /**
   * What happened before today: earlier messages to groups of customers with their final results,
   * and two weeks of the team's audit trail. Same on every start.
   */
  private seedHistory(): void {
    const now = this.now().getTime();
    let n = 11;
    const rand = () => ((n = (n * 16807) % 2147483647) - 1) / 2147483646;
    const pick = <X>(list: X[]) => list[Math.floor(rand() * list.length)]!;
    const iso = (daysAgo: number, hour: number) => new Date(now - daysAgo * DAY - (((now / 3_600_000) % 24) - hour) * 3_600_000).toISOString();
    const put = (e: AuditEntry) => this.db.put('audit', e.id, e.at, e);
    const res = this.resolved();
    const sizeOf = (f: AttentionFlag) => POPULATION.filter((c) => c.flags.includes(f) && !(res[c.id] ?? []).includes(f)).length;
    // Earlier campaigns: [days ago, template, segment, share of today's segment, delivered, opened, acted].
    const past: [number, string, AttentionFlag, number, number, number, number][] = [
      [3, 'cheap-hours', 'ev-peak', 1.0, 0.99, 0.71, 0.22],
      [6, 'installment', 'installment', 1.04, 0.98, 0.66, 0.19],
      [10, 'night-use', 'night-use', 1.5, 1.0, 0.83, 0.42],
      [17, 'cheap-hours', 'ev-peak', 1.08, 0.98, 0.64, 0.17],
      [24, 'installment', 'installment', 1.12, 0.99, 0.61, 0.21],
      [38, 'cheap-hours', 'ev-peak', 1.15, 0.97, 0.58, 0.14],
      [52, 'installment', 'installment', 1.2, 0.98, 0.57, 0.16],
      [96, 'night-use', 'night-use', 2.1, 1.0, 0.79, 0.37],
      [118, 'installment', 'installment', 1.31, 0.97, 0.52, 0.13],
    ];
    past.forEach(([days, templateId, segment, share, delivered, opened, acted], i) => {
      const tpl = TEMPLATES.find((t) => t.id === templateId)!;
      const count = Math.max(3, Math.round(sizeOf(segment) * share));
      const sentAt = iso(days, 9 + (i % 7));
      const staff = TEAM[i % TEAM.length]!;
      const d = Math.round(count * delivered);
      const item: OutboxItem = {
        id: `o-past-${i}`, templateId, title: tpl.title, body: tpl.body, icon: tpl.icon, to: tpl.to, push: true, sender: `${staff.name} · ${brand.name} Klantenservice`,
        status: 'sent', createdAt: sentAt, sendAt: sentAt, sentAt,
        audience: { segment, label: FLAG_INFO[segment].label, count, delivered: d, read: Math.round(d * opened), acted: Math.round(d * acted), includesLive: false, final: true },
      };
      this.db.put('outbox', item.id, sentAt, item);
      if (days <= 14) put({ id: `a-past-${i}`, at: sentAt, actor: staff, action: 'MESSAGE_SENT', target: tpl.title, summary: T(`Sent to ${count} customers (${FLAG_INFO[segment].label.en}).`, `Verstuurd aan ${count} klanten (${FLAG_INFO[segment].label.nl}).`) });
    });
    // The team's ordinary work over the past two weeks.
    const reports = [T('Cost per month against installments', 'Kosten per maand tegenover termijnen'), T('Customers by city', 'Klanten per plaats'), T('Message results', 'Resultaten van berichten'), T('Energy delivered by month', 'Geleverde energie per maand')];
    for (let day = 13; day >= 0; day--) {
      const weekday = new Date(now - day * DAY).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      TEAM.forEach((staff, k) => {
        if (day === 0 && k > 1) return;
        const start = 8 + k * 0.4 + rand() * 0.5;
        put({ id: `a-in-${day}-${k}`, at: iso(day, start), actor: staff, action: 'STAFF_SIGNED_IN', target: T('Customer Service app', 'Klantenservice-app'), summary: T('Signed in.', 'Ingelogd.') });
        const views = 1 + Math.floor(rand() * 2);
        for (let v = 0; v < views; v++) {
          const c = pick(POPULATION);
          put({ id: `a-view-${day}-${k}-${v}`, at: iso(day, start + 0.5 + rand() * 7), actor: staff, action: 'CUSTOMER_VIEWED', target: T(`${c.firstName} ${c.lastName}`, `${c.firstName} ${c.lastName}`), summary: T(`Opened the customer record (${c.customerNo}).`, `Klantdossier geopend (${c.customerNo}).`) });
        }
        if (rand() < 0.22) {
          const r = pick(reports);
          put({ id: `a-exp-${day}-${k}`, at: iso(day, start + 1 + rand() * 6), actor: staff, action: 'REPORT_EXPORTED', target: r, summary: T('Exported the report as CSV.', 'Rapport geëxporteerd als CSV.') });
        }
      });
    }
  }

  /** Something staff did in the browser that belongs in the audit trail (opened a customer record, exported a report). */
  logStaffAction(action: 'CUSTOMER_VIEWED' | 'REPORT_EXPORTED', target: string): void {
    const name = target.trim().slice(0, 120);
    if (!name) throw new HttpError(400, 'Target is required');
    this.audit(action, T(name, name), action === 'CUSTOMER_VIEWED' ? T('Opened the customer record.', 'Klantdossier geopend.') : T('Exported the report as CSV.', 'Rapport geëxporteerd als CSV.'));
  }

  reset(): void {
    this.seed();
    this.audit('DEMO_RESET', T('Demo data', 'Demodata'), T('Messages, conversations, activity and changes restored to the start.', 'Berichten, gesprekken, activiteit en wijzigingen teruggezet naar het begin.'));
    this.emit({ type: 'demo:reset' });
  }

  // ------------------------------------------------------------ reads

  get installment(): InstallmentState {
    return this.db.get<InstallmentState>('installment')!;
  }

  /** Automatic payment on/off and the invoices paid in the app. */
  get pay(): PayState {
    return this.db.get<PayState>('pay') ?? { ...PAY_DEFAULTS };
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
    const pay = this.pay;
    const view = withPayments(pay);
    return { invoices: view.invoices, payments: view.payments, annualOverview, installment: this.installment, pay };
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

  auditLog(limit = 400): AuditEntry[] {
    // Entries are dated up to now; anything the seed placed later today is not shown yet.
    const now = this.now().toISOString();
    return this.db.list<AuditEntry>('audit', limit).filter((e) => e.at <= now);
  }

  /** Add a line to the audit log and tell the staff apps. */
  private audit(action: AuditAction, target: Text, summary: Text, actor: AuditEntry['actor'] = STAFF): void {
    const entry: AuditEntry = { id: `a-${randomUUID().slice(0, 8)}`, at: this.now().toISOString(), actor, action, target, summary };
    this.db.put('audit', entry.id, entry.at, entry);
    this.emit({ type: 'audit:new', entry });
  }

  /**
   * Sent and scheduled messages. Only the live customer really reads theirs; for the rest of an
   * audience (and for other customers) reads are estimated from the time since sending.
   */
  outbox(): OutboxItem[] {
    const now = this.now().getTime();
    return this.db.list<OutboxItem>('outbox', 50).map((o) => {
      if (o.status !== 'sent' || !o.sentAt) return o;
      const secs = (now - new Date(o.sentAt).getTime()) / 1000;
      if (o.audience) {
        if (o.audience.final) return o;
        const others = o.audience.count - (o.audience.includesLive ? 1 : 0);
        const live = o.audience.includesLive ? 1 : 0;
        const delivered = Math.round(others * 0.98 * Math.min(1, secs / 8)) + live;
        const read = Math.round(others * 0.64 * Math.min(1, secs / 150)) + (o.readAt ? 1 : 0);
        const acted = Math.round(others * 0.18 * Math.min(1, secs / 300));
        return { ...o, audience: { ...o.audience, delivered, read, acted } };
      }
      if (o.customer && !o.readAt && secs > 25) return { ...o, readAt: new Date(new Date(o.sentAt).getTime() + 25_000).toISOString() };
      return o;
    });
  }

  outboxById(id: string): OutboxItem | undefined {
    return this.outbox().find((o) => o.id === id);
  }

  // ------------------------------------------------------------ the customer base

  private resolved(): Record<string, AttentionFlag[]> {
    return this.db.get<Record<string, AttentionFlag[]>>('resolved') ?? {};
  }

  /** The live customer's open attention points. */
  private liveFlags(): AttentionFlag[] {
    return this.attention().filter((a) => a.status !== 'done' && (FLAGS as string[]).includes(a.id)).map((a) => a.id as AttentionFlag);
  }

  private summaries(online: number, pushDevices: number): CustomerSummary[] {
    const res = this.resolved();
    const seen = this.db.get<Record<string, string>>('seen') ?? {};
    const now = this.now().getTime();
    const inst = this.installment;
    const live: CustomerSummary = {
      id: customer.id,
      customerNo: customer.customerNo,
      firstName: customer.firstName,
      lastName: customer.lastName,
      initials: customer.initials,
      email: this.customer().customer.email,
      city: customer.address.city,
      product: contract.product,
      installment: inst.pending?.amount ?? inst.current,
      advised: inst.advised,
      hasEv: true,
      flags: this.liveFlags(),
      appUser: true,
      pushOn: pushDevices > 0,
      lastSeen: this.db.get<string | null>('lastSeen') ?? null,
      online: online > 0,
      live: true,
    };
    const rest = POPULATION.map((c): CustomerSummary => {
      const lastSeen = seen[c.id] ?? (c.seenMinAgo === null ? null : new Date(now - c.seenMinAgo * 60_000).toISOString());
      const done = res[c.id] ?? [];
      return {
        id: c.id,
        customerNo: c.customerNo,
        firstName: c.firstName,
        lastName: c.lastName,
        initials: c.initials,
        email: c.email,
        city: c.city,
        product: PRODUCTS[c.product]!,
        installment: done.includes('installment') ? c.advised : c.installment,
        advised: c.advised,
        hasEv: c.hasEv,
        flags: c.flags.filter((f) => !done.includes(f)),
        appUser: c.appUser,
        pushOn: c.pushOn,
        lastSeen,
        online: lastSeen !== null && now - new Date(lastSeen).getTime() < 5 * 60_000,
        live: false,
      };
    });
    return [live, ...rest];
  }

  /** The customer list: search, filter, 10/15/30/50 a page. The live customer first, then most recently seen. */
  customers(query: { q?: string; filter?: CustomerFilter; page?: number; size?: number }, online: number, pushDevices: number): CustomersResponse {
    const PAGE_SIZE = PAGE_SIZES.includes(query.size ?? 0) ? query.size! : 10;
    const all = this.summaries(online, pushDevices);
    const q = (query.q ?? '').trim().toLowerCase();
    const filter = query.filter ?? 'all';
    const matched = all.filter((c) => {
      if (filter === 'attention' && c.flags.length === 0) return false;
      if (filter === 'online' && !c.online) return false;
      if ((FLAGS as string[]).includes(filter) && !c.flags.includes(filter as AttentionFlag)) return false;
      return !q || `${c.firstName} ${c.lastName} ${c.email} ${c.customerNo} ${c.customerNo.replace(/ /g, '')} ${c.city}`.toLowerCase().includes(q);
    });
    matched.sort((a, b) => Number(b.live) - Number(a.live) || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
    const pages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(query.page ?? 1)), pages);
    return { total: all.length, matched: matched.length, page, pageSize: PAGE_SIZE, rows: matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
  }

  /** Everything the customer page shows, for any customer. */
  customerDetail(id: string, online: number, pushDevices: number): CustomerDetail {
    const summary = this.summaries(online, pushDevices).find((c) => c.id === id);
    if (!summary) throw new HttpError(404, `Unknown customer ${id}`);
    if (summary.live) return { summary, overview: this.overview(pushDevices, online), attention: this.attention(), activity: this.activity(), usageScale: 1 };
    const c = POPULATION.find((x) => x.id === id)!;
    const done = this.resolved()[id] ?? [];
    const outbox = this.outbox();
    const name = c.firstName;
    const attention = c.flags.map((f): AttentionItem => {
      const info = FLAG_INFO[f];
      const sent = outbox.some((o) => o.status === 'sent' && ((o.audience?.segment === f && !o.audience.final) || (o.customer?.id === id && o.templateId === info.templateId)));
      return {
        id: f,
        icon: info.icon,
        tone: info.tone,
        templateId: info.templateId,
        title: f === 'installment' && !done.includes(f) ? T(`Installment is ${eur(c.advised - c.installment, 'en')} a month too low`, `Termijnbedrag is ${eur(c.advised - c.installment, 'nl')} per maand te laag`) : info.label,
        detail: info.detail,
        ...(done.includes(f) ? { status: 'done' as const, note: T(`${name} acted on it in the app`, `${name} heeft het in de app geregeld`) } : sent ? { status: 'contacted' as const, note: T('Message sent', 'Bericht verstuurd') } : { status: 'open' as const }),
      };
    });
    const effective = summary.installment;
    const overview: StaffOverview = {
      customer: { ...customer, id: c.id, customerNo: c.customerNo, firstName: c.firstName, lastName: c.lastName, initials: c.initials, email: c.email, address: { street: c.street, postcode: c.postcode, city: c.city } },
      contract: { ...contract, product: PRODUCTS[c.product]!, installment: c.installment, advisedInstallment: c.advised, estimatedAnnualCost: Math.round(contract.estimatedAnnualCost * c.usageScale) },
      installment: { current: c.installment, advised: c.advised, pending: effective !== c.installment ? { amount: effective, from: '2026-12', changedAt: this.now().toISOString() } : null },
      kpis: {
        electricityThisMonth: Math.round(thisMonth.electricity * c.usageScale * (c.hasEv ? 1 : 0.78)),
        gasThisMonth: Math.round(thisMonth.gas * c.usageScale),
        costSoFar: Math.round(thisMonth.costSoFar * c.usageScale),
        expectedSettlement: (c.advised - effective) * 12,
        savingsPlanPerYear: 0,
      },
      plan: [],
      pushDevices: c.pushOn ? 1 : 0,
      unreadMessages: 0,
      lastSeen: summary.lastSeen,
      online: summary.online ? 1 : 0,
    };
    return { summary, overview, attention, activity: this.db.list<Activity>('feed', 400).filter((a) => a.customerId === id), usageScale: c.usageScale };
  }

  /** The customer base at a glance: counts, the attention queue, today's activity. */
  portfolio(online: number, pushDevices: number): Portfolio {
    const all = this.summaries(online, pushDevices);
    const now = this.now();
    const outbox = this.outbox();
    const queue: QueueItem[] = [];
    const conv = this.conversations()[0];
    if (conv && [...conv.entries].reverse().find((e) => e.role === 'assistant')?.intent === 'HUMAN') {
      queue.push({ id: 'eva-agent', icon: 'bell', tone: 'alert', count: 1, contacted: 0, to: `/staff/customers/${LIVE_ID}?tab=eva`, title: T(`Asked ${brand.assistant.name} for an agent`, `Vroeg ${brand.assistant.name} om een medewerker`), detail: T(`${customer.firstName} ${customer.lastName} is waiting for a personal reply.`, `${customer.firstName} ${customer.lastName} wacht op een persoonlijk antwoord.`) });
    }
    for (const f of FLAGS) {
      const count = all.filter((c) => c.flags.includes(f)).length;
      const reached = Math.max(0, ...outbox.filter((o) => o.status === 'sent' && o.audience?.segment === f && !o.audience.final).map((o) => o.audience!.count));
      queue.push({ id: f, icon: FLAG_INFO[f].icon, tone: FLAG_INFO[f].tone, title: FLAG_INFO[f].label, detail: FLAG_INFO[f].detail, count, contacted: Math.min(count, reached), templateId: FLAG_INFO[f].templateId });
    }
    const appUsers = all.filter((c) => c.appUser).length;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: DEMO_TZ }).format(now)) % 24;
    const minute = now.getUTCMinutes();
    const sent = outbox.filter((o) => o.status === 'sent');
    return {
      customers: all.length,
      appUsers,
      onlineNow: all.filter((c) => c.online).length,
      activeToday: all.filter((c) => c.lastSeen && now.getTime() - new Date(c.lastSeen).getTime() < DAY).length,
      needAttention: all.filter((c) => c.flags.length > 0).length,
      queue,
      byHour: HOURLY.slice(0, hour + 1).map((per100, h) => ({ hour: h, actions: Math.round(((per100 * appUsers) / 100) * (h === hour ? Math.max(0.1, minute / 60) : 1)) })),
      products: PRODUCTS.map((label) => ({ label, count: all.filter((c) => c.product.en === label.en).length })),
      installments: { onTrack: all.filter((c) => !c.flags.includes('installment')).length, tooLow: all.filter((c) => c.flags.includes('installment')).length },
      messages: { sent: sent.reduce((n, o) => n + (o.audience?.count ?? 1), 0), read: sent.reduce((n, o) => n + (o.audience ? o.audience.read : o.readAt ? 1 : 0), 0) },
    };
  }

  /** What customers did, across the whole base, newest first (no plain screen views, no staff messages). */
  feed(limit = 60): Activity[] {
    const name = `${customer.firstName} ${customer.lastName}`;
    const live = this.activity().filter((a) => a.kind !== 'page' && a.kind !== 'staff_message').map((a) => ({ ...a, customerId: customer.id, customerName: name }));
    return [...this.db.list<Activity>('feed', limit), ...live].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
  }

  /**
   * One more customer does something in the app (the server calls this every few seconds).
   * Changing the installment or switching on smart charging settles that attention point.
   */
  simulate(rand: () => number = Math.random, atMs = this.now().getTime(), live = true): Activity | null {
    const res = this.resolved();
    const open = (f: AttentionFlag) => POPULATION.filter((c) => c.appUser && c.flags.includes(f) && !(res[c.id] ?? []).includes(f));
    const users = POPULATION.filter((c) => c.appUser);
    const pick = <X>(list: X[]): X | undefined => list[Math.floor(rand() * list.length)];
    const roll = rand();
    let c: PopCustomer | undefined;
    let kind: ActivityKind;
    let text: Text;
    let settles: AttentionFlag | null = null;
    if (roll < 0.1 && live && (c = pick(open('installment')))) {
      kind = 'installment';
      text = T(`Changed installment to ${eur(c.advised, 'en')} from December`, `Termijnbedrag gewijzigd naar ${eur(c.advised, 'nl')} vanaf december`);
      settles = 'installment';
    } else if (roll < 0.18 && live && (c = pick(open('ev-peak')))) {
      kind = 'charging';
      text = T('Scheduled smart charging: 24 kWh ready by 07:00', 'Slim laden ingepland: 24 kWh klaar om 07:00');
      settles = 'ev-peak';
    } else {
      c = pick(users);
      if (!c) return null;
      if (roll < 0.42) {
        const q = pick(EVA_QUESTIONS)!;
        kind = 'chat';
        text = T(`Asked ${brand.assistant.name}: “${q}”`, `Vroeg ${brand.assistant.name}: “${q}”`);
      } else if (roll < 0.58) {
        kind = 'invoice_download';
        text = T('Downloaded an invoice', 'Downloadde een nota');
      } else if (roll < 0.7) {
        const tip = pick(insights.filter((i) => i.saving))!;
        kind = 'plan';
        text = T(`Added “${tip.title.en}” to savings plan`, `“${tip.title.nl}” toegevoegd aan bespaarplan`);
      } else if (roll < 0.76) {
        kind = 'push_subscribed';
        text = T('Turned on phone notifications', 'Zette telefoonmeldingen aan');
      } else {
        kind = 'session';
        text = T(`Signed in to ${brand.portal}`, `Ingelogd bij ${brand.portal}`);
      }
    }
    const ts = new Date(atMs).toISOString();
    const a: Activity = { id: randomUUID(), ts, kind, text, customerId: c.id, customerName: `${c.firstName} ${c.lastName}` };
    this.db.put('feed', a.id, ts, a);
    this.db.set('seen', { ...(this.db.get<Record<string, string>>('seen') ?? {}), [c.id]: ts });
    if (settles) this.db.set('resolved', { ...res, [c.id]: [...(res[c.id] ?? []), settles] });
    if (live) this.emit({ type: 'feed', activity: a });
    return a;
  }

  /** What the annual statement will come to if the installment stays as it is now (positive = to pay). */
  private settlement(): number {
    return annualOverview.estimatedTotal - (annualOverview.paidSoFar + (this.installment.pending?.amount ?? this.installment.current) * 4);
  }

  /**
   * What staff should look at for this customer, each with a suggested message. An item is
   * "contacted" once that message was sent and "done" once the customer acted on it.
   */
  attention(): AttentionItem[] {
    const inst = this.installment;
    const effective = inst.pending?.amount ?? inst.current;
    const gap = inst.advised - effective;
    const outbox = this.outbox();
    const name = customer.firstName;
    const contact = (templateId: string): Pick<AttentionItem, 'status' | 'note'> => {
      // Only messages that reached this customer count: sent to them alone, or to a group they were in.
      const mine = (o: OutboxItem) => !o.customer && (!o.audience || o.audience.includesLive);
      const sent = outbox.find((o) => o.templateId === templateId && o.status === 'sent' && mine(o));
      if (sent) return { status: 'contacted', note: sent.readAt ? T(`Message sent and read by ${name}`, `Bericht verstuurd en gelezen door ${name}`) : T('Message sent, not read yet', 'Bericht verstuurd, nog niet gelezen') };
      if (outbox.some((o) => o.templateId === templateId && o.status === 'scheduled' && mine(o))) return { status: 'contacted', note: T('Message scheduled', 'Bericht ingepland') };
      return { status: 'open' };
    };
    const items: AttentionItem[] = [];

    const conv = this.conversations()[0];
    const lastBot = conv ? [...conv.entries].reverse().find((e) => e.role === 'assistant') : undefined;
    if (lastBot?.intent === 'HUMAN') {
      items.push({ id: 'eva-agent', icon: 'bell', tone: 'alert', status: 'open', to: `/staff/customers/${LIVE_ID}?tab=eva`, title: T(`${name} asked ${brand.assistant.name} for an agent`, `${name} vroeg ${brand.assistant.name} om een medewerker`), detail: T('Read the conversation and follow up with a personal message.', 'Lees het gesprek en reageer met een persoonlijk bericht.') });
    } else if (lastBot?.intent === 'FALLBACK') {
      items.push({ id: 'eva-fallback', icon: 'bell', tone: 'warn', status: 'open', to: `/staff/customers/${LIVE_ID}?tab=eva`, title: T(`${brand.assistant.name} could not answer a question`, `${brand.assistant.name} kon een vraag niet beantwoorden`), detail: T('Read the conversation to see what was asked.', 'Lees het gesprek om te zien wat er gevraagd is.') });
    }

    items.push({
      id: 'installment',
      icon: 'wallet',
      tone: 'warn',
      templateId: 'installment',
      title: gap > 0 ? T(`Installment is ${eur(gap, 'en')} a month too low`, `Termijnbedrag is ${eur(gap, 'nl')} per maand te laag`) : T('Installment matches the advice', 'Termijnbedrag past bij het advies'),
      detail: T(
        `At ${eur(effective, 'en')} a month the annual statement comes to about ${eur(Math.max(0, this.settlement()), 'en')} extra. Advised: ${eur(inst.advised, 'en')}.`,
        `Met ${eur(effective, 'nl')} per maand komt de jaarnota op zo’n ${eur(Math.max(0, this.settlement()), 'nl')} bijbetalen. Advies: ${eur(inst.advised, 'nl')}.`,
      ),
      ...(gap <= 0 ? { status: 'done' as const, note: T(`${name} changed it to ${eur(effective, 'en')} from December`, `${name} heeft het gewijzigd naar ${eur(effective, 'nl')} vanaf december`) } : contact('installment')),
    });

    const charging = this.db.get<boolean>('charging') ?? false;
    items.push({
      id: 'ev-peak',
      icon: 'ev',
      tone: 'info',
      templateId: 'cheap-hours',
      title: T('EV charges in the most expensive hours', 'Auto laadt in de duurste uren'),
      detail: T(`${peakSplit.peakEvPct}% of charging is between 18:00 and 21:00. Smart charging saves about €142 a year.`, `${peakSplit.peakEvPct}% van het laden is tussen 18:00 en 21:00. Slim laden bespaart zo’n €142 per jaar.`),
      ...(charging ? { status: 'done' as const, note: T(`${name} switched on smart charging`, `${name} heeft slim laden aangezet`) } : contact('cheap-hours')),
    });

    const nightSeen = this.messages().find((m) => m.id === 'n1')?.read ?? false;
    items.push({
      id: 'night-use',
      icon: 'moon',
      tone: 'alert',
      templateId: 'night-use',
      title: T('Unusual night-time use on 11 November', 'Ongebruikelijk nachtverbruik op 11 november'),
      detail: T('1.4 kW between 01:40 and 04:10, six times the normal night load.', '1,4 kW tussen 01:40 en 04:10, zes keer het normale nachtverbruik.'),
      ...(nightSeen ? { status: 'done' as const, note: T(`${name} opened the alert in the app`, `${name} heeft de melding in de app geopend`) } : contact('night-use')),
    });

    const order = { open: 0, contacted: 1, done: 2 };
    return items.sort((x, y) => order[x.status] - order[y.status]);
  }

  /** Scripted staff assistant: answers questions about the customer base from the same data the pages show. */
  askStaff(req: StaffAssistantRequest, online = 0, pushDevices = 0): AssistantReply {
    const question = req.question.trim().slice(0, 500);
    if (!question) throw new HttpError(400, 'Empty question');
    return staffReply(question, {
      lang: req.lang,
      lastIntent: req.lastIntent,
      portfolio: this.portfolio(online, pushDevices),
      customers: this.summaries(online, pushDevices),
      campaigns: this.outbox().filter((o) => o.status === 'sent' && o.audience),
      feed: this.feed(5),
    });
  }

  /**
   * Reports for the whole customer base, or the part of it the filters select: `months` back,
   * one city, one contract, or a group (app users, EV drivers, customers needing attention).
   */
  reports(q: { months?: number; week?: boolean; city?: string; product?: string; group?: ReportGroup }, online: number, pushDevices: number): ReportsResponse {
    const all = this.summaries(online, pushDevices);
    const months = q.months === 3 || q.months === 6 ? q.months : 12;
    const scale = new Map(POPULATION.map((c) => [c.id, c.usageScale]));
    const cities = [...new Set(all.map((c) => c.city))].sort();
    const sel = all.filter((c) => (!q.city || c.city === q.city) && (!q.product || c.product.en === q.product) && (q.group === 'app' ? c.appUser : q.group === 'ev' ? c.hasEv : q.group === 'attention' ? c.flags.length > 0 : true));
    const share = sel.length / all.length;
    const sum = sel.reduce((n, c) => n + (scale.get(c.id) ?? 1), 0);
    const sumEv = sel.filter((c) => c.hasEv).reduce((n, c) => n + (scale.get(c.id) ?? 1), 0);
    const appUsers = sel.filter((c) => c.appUser).length;
    const installments = sel.reduce((n, c) => n + c.installment, 0);
    const low = sel.filter((c) => c.flags.includes('installment'));
    const now = this.now().getTime();
    // "Last 7 days" reports per day; the other periods per month.
    const week = q.week === true;
    const since = week ? now - 7 * DAY : now - months * 30.4 * DAY;
    // More customers use the app every month; the latest month is today's figure.
    const USE = [0.5, 0.52, 0.55, 0.57, 0.58, 0.61, 0.63, 0.66, 0.68, 0.7, 0.72, 0.74];
    const active = Math.round(appUsers * USE[11]!);
    const campaigns = this.outbox()
      .filter((o) => o.status === 'sent' && o.audience && o.sentAt && new Date(o.sentAt).getTime() >= since)
      .map((o) => ({ id: o.id, title: o.title, audience: o.audience!.label, sentAt: o.sentAt!, sent: Math.round(o.audience!.count * share), delivered: Math.round(o.audience!.delivered * share), opened: Math.round(o.audience!.read * share), acted: Math.round(o.audience!.acted * share) }))
      .filter((c) => c.sent > 0);
    const funnel = campaigns.reduce((f, c) => ({ sent: f.sent + c.sent, delivered: f.delivered + c.delivered, opened: f.opened + c.opened, acted: f.acted + c.acted }), { sent: 0, delivered: 0, opened: 0, acted: 0 });
    return {
      scope: { customers: sel.length, total: all.length, cities, products: PRODUCTS },
      kpis: {
        customers: sel.length,
        appUsers,
        activePct: appUsers ? Math.round((active / appUsers) * 100) : 0,
        needAttention: sel.filter((c) => c.flags.length > 0).length,
        avgInstallment: sel.length ? Math.round(installments / sel.length) : 0,
        shortfallPerYear: low.reduce((n, c) => n + (c.advised - c.installment) * 12, 0),
        readPct: funnel.delivered ? Math.round((funnel.opened / funnel.delivered) * 100) : 0,
      },
      per: week ? 'day' : 'month',
      months: (week ? daily.slice(-8, -1) : monthly.slice(-months)).map((m, i, list) => {
        // A day carries a thirtieth of the month's fixed cost and installment, and about a third of the month's app users.
        const part = week ? 1 / 30 : 1;
        const ev = m.ev ?? 0;
        const kwh = (m.electricity - ev) * sum + ev * sumEv;
        const m3 = m.gas * sum;
        return {
          key: m.key,
          label: m.label,
          electricityMwh: Math.round(kwh / 100) / 10,
          gasKm3: Math.round(m3 / 100) / 10,
          costK: Math.round((kwh * contract.electricity.avgPrice + m3 * contract.gas.price + contract.fixedPerMonth * sel.length * part) / 100) / 10,
          installmentsK: Math.round((installments * part) / 100) / 10,
          activeUsers: week ? Math.round(appUsers * (0.22 + 0.05 * Math.sin(i * 1.7) + (i === list.length - 1 ? 0.03 : 0))) : Math.round(appUsers * USE[12 - list.length + i]!),
        };
      }),
      attention: FLAGS.map((f) => ({ id: f, label: FLAG_INFO[f].label, count: sel.filter((c) => c.flags.includes(f)).length })),
      cities: cities
        .map((city) => {
          const inCity = sel.filter((c) => c.city === city);
          return { city, customers: inCity.length, attention: inCity.filter((c) => c.flags.length > 0).length, tooLow: inCity.filter((c) => c.flags.includes('installment')).length, evPeak: inCity.filter((c) => c.flags.includes('ev-peak')).length };
        })
        .filter((c) => c.customers > 0)
        .sort((a, b) => b.customers - a.customers),
      funnel,
      campaigns,
    };
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
        expectedSettlement: this.settlement(),
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
    // A reload or coming straight back to the same screen is not a new view.
    const last = this.activity(1)[0];
    if (last?.kind === 'page' && last.to === path && this.now().getTime() - new Date(last.ts).getTime() < 2 * 60_000) {
      this.db.set('lastSeen', this.now().toISOString());
      return;
    }
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

  /** The customer pays an open or scheduled invoice in the app. Simulated: it is only recorded. */
  payInvoice(invoiceId: string, method: PayMethod, bank?: string): PayState {
    const pay = this.pay;
    const inv = withPayments(pay).outstanding.find((i) => i.id === invoiceId);
    if (!inv) throw new HttpError(400, 'This invoice is already paid or does not exist');
    if (!PAY_METHODS[method]) throw new HttpError(400, 'Unknown payment method');
    const label = PAY_METHODS[method];
    const via = method === 'ideal' && bank ? T(`${label.en} · ${bank}`, `${label.nl} · ${bank}`) : label;
    const payment: Payment = { id: `PAY-${90400 + pay.paid.length}`, date: DEMO_NOW.toISOString().slice(0, 10), amount: inv.amount, method: via, invoiceId: inv.id, status: 'success' };
    const next: PayState = { ...pay, paid: [payment, ...pay.paid] };
    this.db.set('pay', next);
    this.emit({ type: 'billing:changed', pay: next });
    this.log('payment', T(`Paid ${inv.period.en} · ${eur2(inv.amount, 'en')} with ${via.en}`, `${inv.period.nl} betaald · ${eur2(inv.amount, 'nl')} met ${via.nl}`), '/billing');
    return next;
  }

  setAutopay(on: boolean): PayState {
    const next: PayState = { ...this.pay, autopay: on };
    this.db.set('pay', next);
    this.emit({ type: 'billing:changed', pay: next });
    this.log('autopay', on ? T('Switched automatic payment on', 'Automatisch betalen aangezet') : T('Switched automatic payment off', 'Automatisch betalen uitgezet'), '/billing');
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
    this.db.set('charging', active);
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
    const staffRead = targets.filter((m) => m.source === 'staff');
    if (staffRead.length > 0) {
      const readAt = this.now().toISOString();
      for (const o of this.outbox()) if (o.messageId && !o.readAt && staffRead.some((m) => m.id === o.messageId)) this.db.put('outbox', o.id, o.createdAt, { ...o, readAt });
      this.emit({ type: 'outbox:changed' });
      this.log('message_read', T(`Read “${staffRead[0]!.title.en}”`, `Las “${staffRead[0]!.title.nl}”`));
    }
  }

  // ------------------------------------------------------------ Eva

  ask(req: AssistantRequest): AssistantReply {
    const question = req.question.trim().slice(0, 500);
    if (!question) throw new HttpError(400, 'Empty question');
    if (!/^[\w-]{4,64}$/.test(req.conversationId)) throw new HttpError(400, 'Invalid conversationId');
    const reply = scriptedReply(question, req.context);
    const ts = this.now().toISOString();
    const existing = this.db.find<Conversation>('conversations', req.conversationId);
    const conv: Conversation = existing ?? { id: req.conversationId, lang: req.context.lang, startedAt: ts, updatedAt: ts, entries: [] };
    const user: ChatLogEntry = { role: 'user', text: question, ts };
    const bot: ChatLogEntry = { role: 'assistant', text: reply.text, intent: reply.intent, ts };
    conv.entries.push(user, bot);
    conv.lang = req.context.lang;
    conv.updatedAt = ts;
    this.db.put('conversations', conv.id, ts, conv);
    this.emit({ type: 'chat:message', conversationId: conv.id, entry: user });
    this.emit({ type: 'chat:message', conversationId: conv.id, entry: bot });
    if (!existing) {
      this.log('chat', T(`Started a chat with ${brand.assistant.name}: “${question}”`, `Startte een chat met ${brand.assistant.name}: “${question}”`), '/assistant');
    }
    return reply;
  }

  // ------------------------------------------------------------ staff

  /** Trimmed, validated copy of a staff message (both languages filled). */
  private checkMessage(req: StaffMessageRequest): { title: Text; body: Text } {
    const title = { en: req.title.en.trim(), nl: req.title.nl.trim() || req.title.en.trim() };
    const body = { en: req.body.en.trim(), nl: req.body.nl.trim() || req.body.en.trim() };
    if (!title.en || !body.en || title.en.length > 120 || body.en.length > 500) throw new HttpError(400, 'Title and body are required (max 120 / 500 characters)');
    if (req.to && !req.to.startsWith('/')) throw new HttpError(400, 'Link must be an in-app route');
    return { title, body };
  }

  private outboxItem(req: StaffMessageRequest, sendAt: string): OutboxItem {
    const { title, body } = this.checkMessage(req);
    let audience: OutboxItem['audience'];
    let other: OutboxItem['customer'];
    if (req.segment) {
      if (!FLAGS.includes(req.segment)) throw new HttpError(400, `Unknown segment ${req.segment}`);
      const res = this.resolved();
      const includesLive = this.liveFlags().includes(req.segment);
      const count = POPULATION.filter((c) => c.flags.includes(req.segment!) && !(res[c.id] ?? []).includes(req.segment!)).length + (includesLive ? 1 : 0);
      if (count === 0) throw new HttpError(400, 'No customers in this segment');
      audience = { segment: req.segment, label: FLAG_INFO[req.segment].label, count, delivered: 0, read: 0, acted: 0, includesLive };
    } else if (req.customerId && req.customerId !== LIVE_ID) {
      const c = POPULATION.find((x) => x.id === req.customerId);
      if (!c) throw new HttpError(404, `Unknown customer ${req.customerId}`);
      other = { id: c.id, name: `${c.firstName} ${c.lastName}` };
    }
    return {
      audience,
      customer: other,
      id: `o-${randomUUID().slice(0, 8)}`,
      templateId: req.templateId,
      title,
      body,
      icon: req.icon ?? 'bell',
      to: req.to ?? '/',
      push: req.push,
      sender: req.sender?.trim() || `Lotte · ${brand.name} Klantenservice`,
      status: 'scheduled',
      createdAt: this.now().toISOString(),
      sendAt,
    };
  }

  /** Puts an outbox item in the customer's inbox now. */
  private deliver(item: OutboxItem, scheduled = false): InboxMessage | null {
    const sentAt = this.now().toISOString();
    // Only the live customer has a real app inbox; everyone else is recorded in the outbox.
    const toLive = item.audience ? item.audience.includesLive : !item.customer;
    const msg: InboxMessage | null = toLive ? { id: `s-${randomUUID().slice(0, 8)}`, source: 'staff', icon: item.icon, title: item.title, body: item.body, to: item.to, createdAt: sentAt, read: false, sender: item.sender } : null;
    if (msg) this.db.put('messages', msg.id, sentAt, msg);
    this.db.put('outbox', item.id, item.createdAt, { ...item, status: 'sent', sentAt, messageId: msg?.id } satisfies OutboxItem);
    if (msg) this.emit({ type: 'message:new', message: msg, banner: true });
    this.emit({ type: 'outbox:changed' });
    if (msg) this.log('staff_message', T(`${brand.name} sent “${item.title.en}”`, `${brand.name} stuurde “${item.title.nl}”`), msg.to);
    const how = item.push ? T('app inbox and phone notification', 'inbox in de app en melding op de telefoon') : T('app inbox', 'inbox in de app');
    const who = item.audience ? T(`${item.audience.count} customers (${item.audience.label.en})`, `${item.audience.count} klanten (${item.audience.label.nl})`) : T(item.customer?.name ?? customer.firstName, item.customer?.name ?? customer.firstName);
    if (scheduled) this.audit('MESSAGE_DISPATCHED', item.title, T(`Scheduled message sent to ${who.en} (${how.en}).`, `Ingepland bericht verstuurd aan ${who.nl} (${how.nl}).`), SYSTEM);
    else this.audit('MESSAGE_SENT', item.title, T(`Sent to ${who.en} (${how.en}).`, `Verstuurd aan ${who.nl} (${how.nl}).`));
    return msg;
  }

  /** Send now, to the live customer, another customer or a whole segment. `message` is null when the live customer is not a recipient. */
  dispatch(req: StaffMessageRequest): { message: InboxMessage | null; outboxId: string } {
    const item = this.outboxItem(req, this.now().toISOString());
    return { message: this.deliver(item), outboxId: item.id };
  }

  /** Send a message to the live customer's inbox at once. */
  sendStaffMessage(req: StaffMessageRequest): InboxMessage {
    const { message } = this.dispatch({ ...req, segment: undefined, customerId: undefined });
    return message!;
  }

  /** Keep a message for later; `dueOutbox` + `sendScheduled` deliver it when its time comes. */
  scheduleStaffMessage(req: StaffMessageRequest): OutboxItem {
    const at = new Date(req.sendAt ?? '');
    const now = this.now().getTime();
    if (Number.isNaN(at.getTime()) || at.getTime() <= now || at.getTime() > now + 2 * DAY) throw new HttpError(400, 'Send time must be within the next 48 hours');
    const item = this.outboxItem(req, at.toISOString());
    this.db.put('outbox', item.id, item.createdAt, item);
    this.emit({ type: 'outbox:changed' });
    const when = (lang: 'en' | 'nl') => new Intl.DateTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: DEMO_TZ }).format(new Date(item.sendAt));
    const who = item.audience ? T(`${item.audience.count} customers`, `${item.audience.count} klanten`) : T(item.customer?.name ?? customer.firstName, item.customer?.name ?? customer.firstName);
    this.audit('MESSAGE_SCHEDULED', item.title, T(`Scheduled for ${who.en} on ${when('en')}.`, `Ingepland voor ${who.nl} op ${when('nl')}.`));
    return item;
  }

  dueOutbox(): OutboxItem[] {
    const now = this.now().toISOString();
    return this.outbox().filter((o) => o.status === 'scheduled' && o.sendAt <= now);
  }

  sendScheduled(id: string): InboxMessage | null {
    const item = this.db.find<OutboxItem>('outbox', id);
    if (!item || item.status !== 'scheduled') throw new HttpError(404, `No scheduled message ${id}`);
    return this.deliver(item, true);
  }

  cancelOutbox(id: string): OutboxItem {
    const item = this.db.find<OutboxItem>('outbox', id);
    if (!item || item.status !== 'scheduled') throw new HttpError(404, `No scheduled message ${id}`);
    const next: OutboxItem = { ...item, status: 'cancelled' };
    this.db.put('outbox', id, item.createdAt, next);
    this.emit({ type: 'outbox:changed' });
    this.audit('MESSAGE_CANCELLED', item.title, T('Scheduled message cancelled before it was sent.', 'Ingepland bericht geannuleerd voordat het verstuurd was.'));
    return next;
  }

  /** Record how many phones a sent message's notification reached. */
  recordPushed(messageId: string, pushed: number): OutboxItem | undefined {
    const item = this.outbox().find((o) => o.messageId === messageId);
    if (!item) return undefined;
    const next: OutboxItem = { ...item, pushed };
    this.db.put('outbox', item.id, item.createdAt, next);
    this.emit({ type: 'outbox:changed' });
    return next;
  }
}
