import { describe, expect, it } from 'vitest';
import type { CustomerSummary, OutboxItem, Portfolio } from '../../shared/contract';
import { matchIntent } from './nlu';
import { STAFF_INTENTS, STAFF_PHRASES, STAFF_SUGGESTIONS, staffReply, type StaffAssistantState, type StaffIntent } from './staff';

const T = (en: string) => ({ en, nl: en });
const cust = (i: number, over: Partial<CustomerSummary> = {}): CustomerSummary => ({
  id: `C-${i}`, customerNo: `2003 000 00${i}`, firstName: ['Olivia', 'James', 'Mary', 'Tyler'][i]!, lastName: ['Carter', 'White', 'Evans', 'Cook'][i]!, initials: 'XX', email: 'x@example.com',
  city: i < 2 ? 'Utrecht' : 'Zwolle', product: T('Dynamic Electricity & Fixed Gas'), installment: 185, advised: 185, hasEv: false, flags: [], appUser: true, pushOn: false, lastSeen: null, online: false, live: i === 0, ...over,
});
const customers = [cust(0, { installment: 185, advised: 198, flags: ['installment', 'ev-peak'], hasEv: true, online: true }), cust(1, { installment: 290, advised: 300, flags: ['installment'] }), cust(2, { flags: ['night-use'] }), cust(3)];
const portfolio: Portfolio = {
  customers: 4, appUsers: 4, onlineNow: 1, activeToday: 3, needAttention: 3,
  queue: [
    { id: 'installment', icon: 'wallet', tone: 'warn', title: T('Installment too low'), detail: T('Advise a higher installment.'), count: 2, contacted: 0, templateId: 'installment' },
    { id: 'ev-peak', icon: 'ev', tone: 'info', title: T('EV charging at peak hours'), detail: T('Smart charging saves money.'), count: 1, contacted: 0, templateId: 'cheap-hours' },
    { id: 'night-use', icon: 'moon', tone: 'alert', title: T('Unusual night-time use'), detail: T('Ask if something was left on.'), count: 1, contacted: 0, templateId: 'night-use' },
  ],
  byHour: [{ hour: 8, actions: 12 }, { hour: 9, actions: 20 }],
  products: [{ label: T('Dynamic Electricity & Fixed Gas'), count: 4 }],
  installments: { onTrack: 2, tooLow: 2 },
  messages: { sent: 100, read: 60 },
};
const campaign: OutboxItem = { id: 'o1', title: T('Advice'), body: T('Body'), icon: 'wallet', to: '/', push: true, status: 'sent', createdAt: '', sendAt: '', sentAt: '', audience: { segment: 'installment', label: T('Installment too low'), count: 100, delivered: 98, read: 60, acted: 20, includesLive: false, final: true } };

const state = (over: Partial<StaffAssistantState> = {}): StaffAssistantState => ({ lang: 'en', portfolio, customers, campaigns: [campaign], feed: [], ...over });

describe('staff assistant (whole customer base)', () => {
  it('every phrase matches its own intent, in both languages, and every chip is a known phrase', () => {
    for (const [id, text] of Object.entries(STAFF_PHRASES) as [StaffIntent, { en: string; nl: string }][]) {
      expect(matchIntent(text.en, STAFF_INTENTS).intent, text.en).toBe(id);
      expect(matchIntent(text.nl, STAFF_INTENTS).intent, text.nl).toBe(id);
    }
    expect(STAFF_SUGGESTIONS.every((id) => STAFF_PHRASES[id])).toBe(true);
  });

  it('answers about the base with numbers from the data', () => {
    const inst = staffReply('How many customers have an installment that is too low?', state());
    expect(inst.text).toContain('2 customers');
    expect(inst.text).toContain('€276'); // (13 + 10) × 12
    expect(inst.actions?.[0]?.to).toBe('/staff/messages?segment=installment&template=installment');
    expect(inst.bars?.points[0]).toMatchObject({ label: 'Utrecht', value: 2, hi: true });
    expect(staffReply('How are our messages performing?', state()).text).toContain('61%'); // 60 of 98 opened
    expect(staffReply('Give me an overview of the customer base', state()).text).toContain('4 customers');
    expect(staffReply('Which customers had unusual night-time use?', state()).text).toContain('Mary Evans, Zwolle');
  });

  it('what needs attention starts with the largest open group and links to messaging all of them', () => {
    const r = staffReply('What needs attention first?', state());
    expect(r.text).toContain('Installment too low');
    expect(r.actions?.[0]).toMatchObject({ label: 'Message all 2', to: '/staff/messages?segment=installment&template=installment' });
    const done = { ...portfolio, queue: portfolio.queue.map((q) => ({ ...q, contacted: q.count })) };
    expect(staffReply('What needs attention first?', state({ portfolio: done })).text).toContain('Nothing is waiting');
  });

  it('looks up one customer by full name', () => {
    const r = staffReply('Tell me about james white', state());
    expect(r.intent).toBe('CUSTOMER');
    expect(r.text).toContain('€10 a month too low');
    expect(r.actions?.[0]?.to).toBe('/staff/customers/C-1');
  });

  it('drafts for the right group and hands off to the composer', () => {
    expect(staffReply('Draft a message about smart charging', state()).draft?.to).toBe('/staff/messages?segment=ev-peak&template=cheap-hours');
    expect(staffReply('Schrijf een bericht over het nachtverbruik', state({ lang: 'nl' })).draft?.to).toBe('/staff/messages?segment=night-use&template=night-use');
    expect(staffReply('write a message', state()).draft?.to).toBe('/staff/messages?segment=installment&template=installment');
  });

  it('answers in Dutch and falls back politely', () => {
    expect(staffReply('Hoeveel klanten hebben een te laag termijnbedrag?', state({ lang: 'nl' })).text).toContain('klanten');
    expect(staffReply('qwerty', state()).intent).toBe('FALLBACK');
  });
});
