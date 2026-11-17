import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LiveEvent } from '../shared/contract.ts';
import { Db } from './db.ts';
import { resolvePort } from './config.ts';
import { HttpError, Store, TEMPLATES } from './store.ts';

let db: Db;
let events: LiveEvent[];
let store: Store;
const clock = () => new Date('2026-11-16T13:30:00Z');

beforeEach(() => {
  db = new Db(':memory:');
  events = [];
  store = new Store(db, (e) => events.push(e), clock);
});
afterEach(() => db.close());

const types = () => events.map((e) => e.type);

describe('seed', () => {
  it('starts from the mock-up data', () => {
    expect(store.customer().customer.firstName).toBe('Olivia');
    expect(store.installment).toEqual({ current: 185, advised: 198, pending: null });
    expect(store.plan).toEqual(['ev-peak']);
    expect(store.messages()).toHaveLength(4);
    expect(store.messages()[0]?.id).toBe('n2'); // newest first (1 hour ago)
    expect(store.billing().invoices.length).toBe(13);
    expect(store.energy().thisMonth.costSoFar).toBeGreaterThan(100);
  });

  it('does not reseed an existing database', () => {
    store.setInstallment(198);
    const again = new Store(db, () => {}, clock);
    expect(again.installment.pending?.amount).toBe(198);
  });
});

describe('customer actions', () => {
  it('installment change is validated, stored, broadcast and logged', () => {
    const s = store.setInstallment(198);
    expect(s.pending).toEqual({ amount: 198, from: '2026-12', changedAt: clock().toISOString() });
    expect(types()).toEqual(['installment:changed', 'activity']);
    expect(store.activity()[0]?.text.en).toBe('Changed installment to €198 from December');
    expect(() => store.setInstallment(50)).toThrow(HttpError);
    expect(() => store.setInstallment(198.5)).toThrow(HttpError);
    expect(store.setInstallment(185).pending).toBeNull();
  });

  it('paying an invoice in the app marks it paid, adds a payment, broadcasts and logs it', () => {
    const open = store.billing().invoices.find((i) => i.status !== 'paid')!;
    expect(open.status).toBe('scheduled'); // automatic payment is on at the start
    const before = store.billing().payments.length;
    const pay = store.payInvoice(open.id, 'ideal', 'ING');
    expect(pay.paid[0]).toMatchObject({ invoiceId: open.id, amount: 185, method: { en: 'iDEAL · ING' }, date: '2026-11-16' });
    expect(types()).toEqual(['billing:changed', 'activity']);
    expect(store.activity()[0]).toMatchObject({ kind: 'payment', text: { en: 'Paid November 2026 · €185.00 with iDEAL · ING' } });
    const after = store.billing();
    expect(after.invoices.find((i) => i.id === open.id)).toMatchObject({ status: 'paid', paidOn: '2026-11-16' });
    expect(after.payments).toHaveLength(before + 1);
    expect(after.payments[0]?.invoiceId).toBe(open.id); // newest first
    // Paying twice, an unknown invoice or an unknown method is refused.
    expect(() => store.payInvoice(open.id, 'ideal')).toThrow(HttpError);
    expect(() => store.payInvoice('nope', 'card')).toThrow(HttpError);
    store.reset();
    expect(store.billing().pay).toEqual({ autopay: true, paid: [] });
  });

  it('automatic payment off makes the due invoice open; on schedules it again', () => {
    const due = () => store.billing().invoices.find((i) => i.status !== 'paid')!;
    expect(store.setAutopay(false).autopay).toBe(false);
    expect(due().status).toBe('open');
    expect(store.activity()[0]).toMatchObject({ kind: 'autopay', text: { en: 'Switched automatic payment off' } });
    store.setAutopay(true);
    expect(due().status).toBe('scheduled');
    expect(types().filter((x) => x === 'billing:changed')).toHaveLength(2);
  });

  it('savings plan toggles and reports', () => {
    expect(store.setPlan('baseload', true)).toEqual(['ev-peak', 'baseload']);
    expect(store.setPlan('ev-peak', false)).toEqual(['baseload']);
    expect(() => store.setPlan('nope', true)).toThrow(HttpError);
    expect(store.overview(0, 0).kpis.savingsPlanPerYear).toBe(96);
  });

  it('page views need a known route', () => {
    store.trackPage('/billing?adjust=1');
    expect(store.activity()[0]?.text.nl).toBe('Bekeek Nota’s & betalingen');
    expect(() => store.trackPage('/admin')).toThrow(HttpError);
  });

  it('marks messages read', () => {
    store.markRead('n1');
    expect(store.messages().find((m) => m.id === 'n1')?.read).toBe(true);
    store.markRead('all');
    expect(store.messages().every((m) => m.read)).toBe(true);
    expect(() => store.markRead('missing')).toThrow(HttpError);
  });

  it('contact details are validated', () => {
    store.setContact('sanne@example.nl', '+31 6 1111 2222');
    expect(store.customer().customer.phone).toBe('+31 6 1111 2222');
    expect(() => store.setContact('not-an-email', '123456')).toThrow(HttpError);
  });
});

describe('Eva conversations', () => {
  const ask = (question: string, conversationId = 'conv-1', lastIntent?: string) =>
    store.ask({ question, conversationId, context: { lang: 'en', route: '/', lastIntent } });

  it('answers from the scripted assistant and logs the conversation', () => {
    const r = ask('Why is my energy bill higher this month?');
    expect(r.intent).toBe('BILL_WHY_HIGH');
    expect(r.text).toContain('12% higher');
    const [conv] = store.conversations();
    expect(conv?.entries.map((e) => e.role)).toEqual(['user', 'assistant']);
    expect(types()).toEqual(['chat:message', 'chat:message', 'activity']);
  });

  it('follow-ups continue the topic; only the first message is logged as activity', () => {
    ask('How much energy did I consume this month?');
    const r = ask('and last month?', 'conv-1', 'USAGE');
    expect(r.text).toContain('October 2026');
    expect(store.conversations()[0]?.entries).toHaveLength(4);
    expect(store.activity().filter((a) => a.kind === 'chat')).toHaveLength(1);
  });

  it('rejects empty questions and bad ids', () => {
    expect(() => ask('   ')).toThrow(HttpError);
    expect(() => ask('hi', 'x')).toThrow(HttpError);
  });
});

describe('activity noise', () => {
  it('a reload of the same screen is not logged again, another screen is', () => {
    store.trackPage('/');
    store.trackPage('/');
    store.trackPage('/billing');
    store.trackPage('/');
    expect(store.activity().map((a) => a.to)).toEqual(['/', '/billing', '/']);
  });
});

describe('staff', () => {
  it('sends a message the customer sees as a banner', () => {
    const t = TEMPLATES[0]!;
    const msg = store.sendStaffMessage({ title: t.title, body: t.body, icon: t.icon, to: t.to, push: false });
    expect(msg.source).toBe('staff');
    expect(msg.sender).toContain('Klantenservice');
    const live = events.find((e) => e.type === 'message:new');
    expect(live).toMatchObject({ type: 'message:new', banner: true });
    expect(store.overview(1, 2)).toMatchObject({ unreadMessages: 4, pushDevices: 1, online: 2 });
  });

  it('validates staff messages', () => {
    expect(() => store.sendStaffMessage({ title: { en: '', nl: '' }, body: { en: 'x', nl: '' }, push: false })).toThrow(HttpError);
    expect(() => store.sendStaffMessage({ title: { en: 'Hi', nl: '' }, body: { en: 'x', nl: '' }, to: 'https://evil.example', push: false })).toThrow(HttpError);
    // Dutch falls back to English when left empty.
    expect(store.sendStaffMessage({ title: { en: 'Hi', nl: '' }, body: { en: 'Body', nl: '' }, push: false }).title.nl).toBe('Hi');
  });

  it('expected settlement follows a pending installment', () => {
    expect(store.overview(0, 0).kpis.expectedSettlement).toBe(156);
    store.setInstallment(198);
    expect(store.overview(0, 0).kpis.expectedSettlement).toBe(104);
  });
});

describe('needs attention', () => {
  const byId = (id: string) => store.attention().find((a) => a.id === id)!;

  it('starts with three open points and a suggested message for each', () => {
    const items = store.attention();
    expect(items.map((a) => a.id)).toEqual(['installment', 'ev-peak', 'night-use']);
    expect(items.every((a) => a.status === 'open' && TEMPLATES.some((t) => t.id === a.templateId))).toBe(true);
    expect(byId('installment').title.en).toBe('Installment is €13 a month too low');
  });

  it('moves to contacted when the suggested message is sent, and to done when the customer acts', () => {
    const tpl = TEMPLATES.find((t) => t.id === 'installment')!;
    const msg = store.sendStaffMessage({ title: tpl.title, body: tpl.body, push: false, templateId: tpl.id });
    expect(byId('installment')).toMatchObject({ status: 'contacted', note: { en: 'Message sent, not read yet' } });
    store.markRead(msg.id);
    expect(byId('installment').note?.en).toBe('Message sent and read by Olivia');
    store.setInstallment(198);
    expect(byId('installment').status).toBe('done');
    store.setCharging(true, 24, 7);
    expect(byId('ev-peak').status).toBe('done');
    store.markRead('n1');
    expect(byId('night-use').status).toBe('done');
    // Followed-up points sink below open ones.
    expect(store.attention().every((a) => a.status === 'done')).toBe(true);
  });

  it('flags a request for an agent in the Eva chat', () => {
    store.ask({ question: 'I want to speak to customer service', context: { lang: 'en', route: '/' }, conversationId: 'conv-1234' });
    expect(store.attention()[0]).toMatchObject({ id: 'eva-agent', to: '/staff/customers/C-2003418762?tab=eva' });
  });
});

describe('outbox', () => {
  it('tracks a sent message: sent, phones reached, read', () => {
    const msg = store.sendStaffMessage({ title: { en: 'Hi', nl: 'Hoi' }, body: { en: 'Body', nl: 'Tekst' }, push: true });
    expect(store.outbox()[0]).toMatchObject({ status: 'sent', messageId: msg.id });
    expect(store.recordPushed(msg.id, 2)?.pushed).toBe(2);
    store.markRead(msg.id);
    expect(store.outbox()[0]?.readAt).toBeTruthy();
    expect(types()).toContain('outbox:changed');
  });

  it('schedules, delivers when due, and cancels', () => {
    let nowMs = clock().getTime();
    const s = new Store(new Db(':memory:'), (e) => events.push(e), () => new Date(nowMs));
    const req = { title: { en: 'Later', nl: 'Later' }, body: { en: 'Body', nl: 'Tekst' }, push: false };
    const item = s.scheduleStaffMessage({ ...req, sendAt: new Date(nowMs + 60_000).toISOString() });
    expect(item.status).toBe('scheduled');
    expect(s.messages()).toHaveLength(4); // not in the inbox yet
    expect(s.dueOutbox()).toHaveLength(0);
    nowMs += 61_000;
    expect(s.dueOutbox().map((o) => o.id)).toEqual([item.id]);
    s.sendScheduled(item.id);
    expect(s.messages()).toHaveLength(5);
    expect(s.dueOutbox()).toHaveLength(0);

    const second = s.scheduleStaffMessage({ ...req, sendAt: new Date(nowMs + 60_000).toISOString() });
    expect(s.cancelOutbox(second.id).status).toBe('cancelled');
    expect(() => s.sendScheduled(second.id)).toThrow(HttpError);
    // Only the near future is accepted.
    expect(() => s.scheduleStaffMessage({ ...req, sendAt: new Date(nowMs - 1000).toISOString() })).toThrow(HttpError);
    expect(() => s.scheduleStaffMessage({ ...req, sendAt: new Date(nowMs + 3 * 86_400_000).toISOString() })).toThrow(HttpError);
  });

  it('the staff assistant answers from the current state', () => {
    const low = () => store.portfolio(0, 0).queue.find((q) => q.id === 'installment')!.count;
    const ask = () => store.askStaff({ question: 'How many customers have an installment that is too low?', lang: 'en' }).text;
    expect(ask()).toContain(`**${low()} customers**`);
    const before = low();
    store.setInstallment(198);
    expect(low()).toBe(before - 1);
    expect(ask()).toContain(`**${before - 1} customers**`);
    expect(store.askStaff({ question: 'Tell me about Olivia Carter', lang: 'en' }).actions?.[0]?.to).toBe('/staff/customers/C-2003418762');
    expect(() => store.askStaff({ question: ' ', lang: 'en' })).toThrow(HttpError);
  });
});

describe('customer base', () => {
  const queue = (id: string) => store.portfolio(0, 0).queue.find((q) => q.id === id)!;

  it('has 1,248 customers with US names, the live customer first', () => {
    const page = store.customers({}, 1, 0);
    expect(page).toMatchObject({ total: 1248, matched: 1248, page: 1, pageSize: 10 });
    expect(page.rows).toHaveLength(10);
    // Rows per page: 10, 15, 30 or 50; anything else falls back to 10.
    expect(store.customers({ size: 30 }, 0, 0).rows).toHaveLength(30);
    expect(store.customers({ size: 7 }, 0, 0).pageSize).toBe(10);
    expect(page.rows[0]).toMatchObject({ firstName: 'Olivia', lastName: 'Carter', live: true, online: true });
    const all = store.customers({ page: 99, size: 50 }, 0, 0); // past the end: the last page
    expect(all.page).toBe(25);
    expect(all.rows).toHaveLength(1248 - 24 * 50);
    // Unique names.
    const names = new Set<string>();
    for (let p = 1; p <= 25; p++) for (const c of store.customers({ page: p, size: 50 }, 0, 0).rows) names.add(`${c.firstName} ${c.lastName}`);
    expect(names.size).toBe(1248);
  });

  it('searches and filters, and the filters agree with the attention queue', () => {
    expect(store.customers({ q: 'olivia carter' }, 0, 0).rows[0]?.live).toBe(true);
    expect(store.customers({ q: '2003418762' }, 0, 0).matched).toBe(1);
    expect(store.customers({ q: 'zzzz' }, 0, 0).matched).toBe(0);
    for (const f of ['installment', 'ev-peak', 'night-use'] as const) {
      const n = store.customers({ filter: f }, 0, 0).matched;
      expect(n).toBeGreaterThan(5);
      expect(queue(f).count).toBe(n);
    }
    const p = store.portfolio(0, 0);
    expect(p.customers).toBe(1248);
    expect(p.needAttention).toBe(store.customers({ filter: 'attention' }, 0, 0).matched);
    expect(p.installments.onTrack + p.installments.tooLow).toBe(1248);
    expect(p.products.reduce((n, x) => n + x.count, 0)).toBe(1248);
  });

  it('the feed covers every customer; a customer acting settles their attention point', () => {
    const before = queue('installment').count;
    expect(store.feed().length).toBe(40); // seeded history
    expect(store.feed().every((a) => a.customerName && a.kind !== 'page')).toBe(true);
    const a = store.simulate(() => 0.05)!; // forces "changed installment"
    expect(a).toMatchObject({ kind: 'installment' });
    expect(events.at(-1)).toMatchObject({ type: 'feed', activity: { id: a.id } });
    expect(queue('installment').count).toBe(before - 1);
    expect(store.feed()[0]?.id).toBe(a.id);
    const detail = store.customerDetail(a.customerId!, 0, 0);
    expect(detail.summary).toMatchObject({ live: false, online: true });
    expect(detail.attention.find((x) => x.id === 'installment')?.status).toBe('done');
    expect(detail.activity[0]?.id).toBe(a.id);
    // The live customer's own actions are in the feed too.
    store.setInstallment(198);
    expect(store.feed().some((x) => x.customerName === 'Olivia Carter' && x.kind === 'installment')).toBe(true);
    expect(() => store.customerDetail('C-nope', 0, 0)).toThrow(HttpError);
  });

  it('a message to a segment reaches the live customer for real and estimates the rest', () => {
    let nowMs = clock().getTime();
    const s = new Store(new Db(':memory:'), (e) => events.push(e), () => new Date(nowMs));
    const count = s.portfolio(0, 0).queue.find((q) => q.id === 'installment')!.count;
    const { message, outboxId } = s.dispatch({ title: { en: 'Advice', nl: 'Advies' }, body: { en: 'Body', nl: 'Tekst' }, push: false, segment: 'installment', templateId: 'installment' });
    expect(message).not.toBeNull(); // the live customer's installment is too low
    expect(s.outboxById(outboxId)?.audience).toMatchObject({ segment: 'installment', count, delivered: 1, read: 0, acted: 0, includesLive: true }); // the live customer has it at once
    expect(s.portfolio(0, 0).queue.find((q) => q.id === 'installment')?.contacted).toBe(count);
    expect(s.auditLog()[0]?.summary.en).toContain(`${count} customers (Installment too low)`);
    nowMs += 200_000;
    expect(s.outboxById(outboxId)!.audience!.read).toBe(Math.round((count - 1) * 0.64));
    // Another customer: recorded and audited, nothing in the live customer's inbox.
    const other = s.customers({ page: 2 }, 0, 0).rows[0]!;
    const inbox = s.messages().length;
    expect(s.dispatch({ title: { en: 'Hi', nl: 'Hoi' }, body: { en: 'Body', nl: 'Tekst' }, push: false, customerId: other.id }).message).toBeNull();
    expect(s.messages()).toHaveLength(inbox);
    expect(s.outbox()[0]?.customer?.name).toBe(`${other.firstName} ${other.lastName}`);
    expect(() => s.dispatch({ title: { en: 'Hi', nl: 'Hoi' }, body: { en: 'Body', nl: 'Tekst' }, push: false, customerId: 'C-nope' })).toThrow(HttpError);
  });
});

describe('audit log', () => {
  const actions = () => store.auditLog().map((e) => e.action);

  it('starts with two weeks of the team\'s work and the automatic notifications', () => {
    const log = store.auditLog();
    expect(actions().filter((a) => a === 'ALERT_SENT')).toHaveLength(4);
    expect(log.length).toBeGreaterThan(40);
    expect(new Set(log.filter((e) => e.actor.kind === 'STAFF').map((e) => e.actor.name)).size).toBe(4);
    expect(new Set(actions())).toEqual(new Set(['ALERT_SENT', 'STAFF_SIGNED_IN', 'CUSTOMER_VIEWED', 'REPORT_EXPORTED', 'MESSAGE_SENT']));
    // Nothing is dated in the future, and the newest entry is first.
    expect(log.every((e) => e.at <= clock().toISOString())).toBe(true);
    expect(log[0]!.at >= log[log.length - 1]!.at).toBe(true);
  });

  it('records what staff do in the browser', () => {
    store.logStaffAction('CUSTOMER_VIEWED', 'James White');
    expect(store.auditLog()[0]).toMatchObject({ action: 'CUSTOMER_VIEWED', actor: { name: 'Lotte' }, target: { en: 'James White' } });
    store.logStaffAction('REPORT_EXPORTED', 'Customers by city');
    expect(store.auditLog()[0]).toMatchObject({ action: 'REPORT_EXPORTED', target: { en: 'Customers by city' } });
    expect(() => store.logStaffAction('REPORT_EXPORTED', '  ')).toThrow(HttpError);
  });

  it('message history: earlier campaigns with final results, and reports that follow the filters', () => {
    const past = store.outbox().filter((o) => o.audience?.final);
    expect(past).toHaveLength(9);
    expect(past.every((o) => o.audience!.delivered <= o.audience!.count && o.audience!.read <= o.audience!.delivered && o.audience!.acted <= o.audience!.read)).toBe(true);
    // Earlier campaigns do not count as "already contacted today".
    expect(store.portfolio(0, 0).queue.every((q) => q.contacted === 0)).toBe(true);
    const all = store.reports({}, 0, 0);
    expect(all.scope).toMatchObject({ customers: 1248, total: 1248 });
    expect(all.months).toHaveLength(12);
    expect(all.campaigns).toHaveLength(9);
    expect(all.funnel.sent).toBeGreaterThan(all.funnel.delivered);
    expect(all.funnel.delivered).toBeGreaterThan(all.funnel.opened);
    expect(all.funnel.opened).toBeGreaterThan(all.funnel.acted);
    expect(all.cities.reduce((n, c) => n + c.customers, 0)).toBe(1248);
    // Last 7 days: one point per day, and only that week's messages.
    const week = store.reports({ week: true }, 0, 0);
    expect(week.per).toBe('day');
    expect(week.months).toHaveLength(7);
    expect(week.campaigns).toHaveLength(2);
    expect(week.months[0]!.electricityMwh).toBeLessThan(all.months[0]!.electricityMwh / 10);
    expect(week.months[0]!.installmentsK).toBeCloseTo(all.months[0]!.installmentsK / 30, 0);
    expect(all.per).toBe('month');
    const three = store.reports({ months: 3 }, 0, 0);
    expect(three.months).toHaveLength(3);
    expect(three.campaigns.length).toBeLessThan(9);
    const city = store.reports({ city: 'Utrecht' }, 0, 0);
    expect(city.cities).toHaveLength(1);
    expect(city.scope.customers).toBe(city.cities[0]!.customers);
    expect(city.months[0]!.electricityMwh).toBeLessThan(all.months[0]!.electricityMwh);
    const ev = store.reports({ group: 'ev' }, 0, 0);
    expect(ev.scope.customers).toBeLessThan(400);
    expect(store.reports({ city: 'Nowhere' }, 0, 0).scope.customers).toBe(0);
  });

  it('records sending, scheduling, cancelling and the demo reset, with who did it', () => {
    const req = { title: { en: 'Hi', nl: 'Hoi' }, body: { en: 'Body', nl: 'Tekst' }, push: true };
    store.sendStaffMessage(req);
    expect(store.auditLog()[0]).toMatchObject({ action: 'MESSAGE_SENT', actor: { kind: 'STAFF', name: 'Lotte' }, target: { en: 'Hi' }, summary: { en: 'Sent to Olivia (app inbox and phone notification).' } });
    expect(events.at(-1)).toMatchObject({ type: 'audit:new', entry: { action: 'MESSAGE_SENT' } });
    const item = store.scheduleStaffMessage({ ...req, sendAt: new Date(clock().getTime() + 60_000).toISOString() });
    store.cancelOutbox(item.id);
    const second = store.scheduleStaffMessage({ ...req, sendAt: new Date(clock().getTime() + 60_000).toISOString() });
    store.sendScheduled(second.id);
    for (const a of ['MESSAGE_SENT', 'MESSAGE_SCHEDULED', 'MESSAGE_CANCELLED', 'MESSAGE_DISPATCHED']) expect(actions()).toContain(a);
    // A scheduled message going out is the system's doing, not a person's.
    expect(store.auditLog().find((e) => e.action === 'MESSAGE_DISPATCHED')?.actor.kind).toBe('SYSTEM');
    store.reset();
    expect(actions().filter((a) => a === 'DEMO_RESET')).toHaveLength(1);
    expect(actions()[0]).toBe('DEMO_RESET');
    expect(actions()).not.toContain('MESSAGE_CANCELLED');
  });
});

describe('reset', () => {
  it('restores the seed and broadcasts demo:reset', () => {
    store.setInstallment(210);
    store.sendStaffMessage({ title: { en: 'Hi', nl: 'Hoi' }, body: { en: 'x', nl: 'x' }, push: false });
    store.reset();
    expect(store.installment.pending).toBeNull();
    expect(store.messages()).toHaveLength(4);
    expect(store.activity()).toHaveLength(0);
    expect(store.conversations()).toHaveLength(0);
    expect(types().at(-1)).toBe('demo:reset');
  });
});

describe('resolvePort', () => {
  it('prefers the Catalyst port, then PORT, then 3000', () => {
    expect(resolvePort({ X_ZOHO_CATALYST_LISTEN_PORT: '9000', PORT: '8080' })).toBe(9000);
    expect(resolvePort({ PORT: '8080' })).toBe(8080);
    expect(resolvePort({})).toBe(3000);
  });
});
