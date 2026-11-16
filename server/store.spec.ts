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
    expect(store.customer().customer.firstName).toBe('Sanne');
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
