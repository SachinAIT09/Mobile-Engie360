import { describe, expect, it } from 'vitest';
import {
  ASSISTANT,
  applianceBreakdown,
  fmtEur,
  fmtNum,
  lastMonthSummary,
  monthlyUsage,
  thisMonth,
  type Invoice,
  type UsageProfile,
} from '@engie/shared';
import { annualOverview } from '../billing/billing.service.js';
import { buildContract, buildInvoiceHistory } from '../seed/contracts.js';
import { answerEva, pickMonth, type EvaAnswer, type EvaFacts } from './eva-answers.js';
import { INTENTS, PHRASES } from './eva-intents.js';
import { extractEntities, matchIntent } from './eva-nlu.js';

const NOW = new Date('2026-11-16T13:20:00Z'); // Mon 16 Nov, 14:20 in Amsterdam

const PROFILE: UsageProfile = { seed: 1, elecScale: 1, gasScale: 1, evSince: '2026-08-25T00:00:00Z', elecPrice: 0.25, gasPrice: 1.25, fixedPerMonth: 22.8 };

/** A signed-in customer with an EV, paying `delta` € a month against the advice. */
function customer(lang: 'en' | 'nl' = 'en', over: Partial<EvaFacts> = {}, profile: UsageProfile = PROFILE, delta = -25): EvaFacts {
  const contract = buildContract({ product: 'DYNAMIC_FIXED_GAS', startDate: '2025-03-01', profile, now: NOW, installmentDelta: delta, digits: 48213 });
  const seeded = buildInvoiceHistory(contract, 'K-48213', NOW, contract.installment - 10);
  const invoices: Invoice[] = seeded.map((i, n) => ({
    id: `inv${n}`, number: i.number, kind: i.kind, period: i.period, issued: i.issued.toISOString(), due: i.due.toISOString(),
    amount: i.amount, status: i.status, paidOn: i.paidOn ? i.paidOn.toISOString() : null, lines: i.lines,
  }));
  return {
    audience: 'customer', lang, now: NOW, firstName: 'Sanne', city: 'Utrecht', gridOperator: 'Stedin', ibanMasked: 'NL•• INGB •••• 4821',
    contract, evStatus: profile.evSince ? 'DETECTED_NOT_ENROLLED' : 'NONE',
    thisMonth: thisMonth(profile, NOW), lastMonth: lastMonthSummary(profile, NOW), months: monthlyUsage(profile, NOW),
    breakdown: applianceBreakdown(profile, NOW), peakPct: 61, invoices, annual: annualOverview({ contract }, seeded, NOW), insights: [], activeFlexEvent: null,
    ...over,
  };
}
const visitor = (lang: 'en' | 'nl' = 'en'): EvaFacts => ({ audience: 'visitor', lang, now: NOW });

/** Question string → intent (eva-nlu) → answer, as AssistantService does. */
function ask(question: string, facts: EvaFacts, lastIntent?: string, route?: string): EvaAnswer {
  const m = matchIntent(question, INTENTS, lastIntent);
  return answerEva({ intent: m.intent, entities: m.entities, text: question, route }, facts);
}
const plain = (a: EvaAnswer) => a.text.join(' ').replace(/\*\*/g, '');

describe('Eva: usage', () => {
  it('this month, in English, with facts and the 12-month chart', () => {
    const f = customer('en');
    const a = ask('How much energy did I consume this month?', f);
    const tm = f.thisMonth!;
    expect(a.intent).toBe('USAGE');
    expect(a.matched).toBe(true);
    expect(plain(a)).toContain(`So far in November 2026 (day 1–16) you’ve used ${fmtNum(tm.electricity, 'en')} kWh of electricity and ${fmtNum(tm.gas, 'en')} m³ of gas.`);
    expect(a.facts[0]).toEqual({ label: 'Electricity this month', value: `${fmtNum(tm.electricity, 'en')} kWh` });
    expect(a.facts.find((x) => x.label === 'Cost so far')?.value).toBe(fmtEur(tm.costSoFar, 'en', 2));
    expect(a.chart?.points).toHaveLength(12);
    expect(a.chart?.points.map((p) => p.value)).toEqual(f.months!.map((p) => p.electricity));
    expect(a.chart?.points.filter((p) => p.highlight)).toHaveLength(1);
    expect(a.chart?.points[11].highlight).toBe(true);
    expect(a.actions[0]).toEqual({ kind: 'route', label: 'Open usage', route: '/usage' });
    expect(a.disclosure).toBe(ASSISTANT.disclosureCustomer.en);
  });

  it('this month, in Dutch', () => {
    const f = customer('nl');
    const a = ask('Hoeveel energie heb ik deze maand verbruikt?', f);
    expect(a.intent).toBe('USAGE');
    expect(plain(a)).toContain(`In november 2026 (dag 1–16) heb je tot nu toe ${fmtNum(f.thisMonth!.electricity, 'nl')} kWh stroom`);
    expect(a.facts[0].label).toBe('Stroom deze maand');
    expect(a.actions[0]).toEqual({ kind: 'route', label: 'Open verbruik', route: '/usage' });
    expect(a.followUps).toEqual([PHRASES.BILL_WHY_HIGH.nl, PHRASES.SAVE.nl, PHRASES.INVOICE.nl]);
    expect(a.disclosure).toBe(ASSISTANT.disclosureCustomer.nl);
  });

  it('a named month answers for that month', () => {
    const f = customer('en');
    const sep = f.months!.find((p) => p.key === '2026-09')!;
    const a = ask('How much did I use in September?', f);
    expect(a.intent).toBe('USAGE');
    expect(plain(a)).toContain(`In September 2026 you used ${fmtNum(sep.electricity, 'en')} kWh of electricity and ${fmtNum(sep.gas, 'en')} m³ of gas`);
    expect(plain(a)).toContain('electricity than the month before');
    expect(a.facts[0]).toEqual({ label: 'Electricity', value: `${fmtNum(sep.electricity, 'en')} kWh` });
    expect(a.chart).not.toBeNull();
  });

  it('"and last month?" keeps the USAGE intent and answers for October', () => {
    const f = customer('en');
    const a = ask('and last month?', f, 'USAGE');
    expect(a.intent).toBe('USAGE');
    expect(a.context.lastIntent).toBe('USAGE');
    expect(plain(a)).toContain(`In October 2026 you used ${fmtNum(f.lastMonth!.electricity, 'en')} kWh`);
    const nl = ask('en vorige maand?', customer('nl'), 'USAGE');
    expect(nl.intent).toBe('USAGE');
    expect(plain(nl)).toContain('In oktober 2026 verbruikte je');
  });

  it('pickMonth: named month, last month, and null for the current or an unknown month', () => {
    const months = monthlyUsage(PROFILE, NOW);
    expect(pickMonth(extractEntities('in september'), months, NOW)?.point.key).toBe('2026-09');
    expect(pickMonth(extractEntities('in september'), months, NOW)?.prev?.key).toBe('2026-08');
    expect(pickMonth(extractEntities('last month'), months, NOW)?.point.key).toBe('2026-10');
    // The oldest month in the series (November 2025 is skipped: "november" means the running month) has nothing before it.
    expect(months[0].key).toBe('2025-11');
    expect(pickMonth(extractEntities('in december'), months, NOW)).toEqual({ point: months[1], prev: months[0] });
    expect(pickMonth(extractEntities('in november'), months, NOW)).toBeNull();
    expect(pickMonth(extractEntities('how much'), months, NOW)).toBeNull();
  });
});

describe('Eva: bill and installment', () => {
  it('why-higher mentions EV charging when the home charged an EV last month', () => {
    const f = customer('en');
    expect(f.lastMonth!.ev).toBeGreaterThan(0);
    const a = ask('Why is my energy bill higher this month?', f);
    expect(a.intent).toBe('BILL_WHY_HIGH');
    expect(plain(a)).toContain('Your electricity use in October 2026 was');
    expect(plain(a)).toContain(`EV charging: Net2Grid recognises an electric car at your home, which used ${fmtNum(f.lastMonth!.ev, 'en')} kWh`);
    expect(a.facts.map((x) => x.label)).toContain('EV share');
    expect(a.actions).toContainEqual({ kind: 'route', label: 'Set up smart charging', route: '/smart-charging' });
    // Breakdown chart, with the EV bar highlighted.
    expect(a.chart?.points.filter((p) => p.highlight).map((p) => p.label)).toEqual([f.breakdown!.find((b) => b.key === 'ev')!.label.en]);
  });

  it('why-higher leaves the EV out for a home without one', () => {
    const f = customer('nl', {}, { ...PROFILE, evSince: null });
    expect(f.lastMonth!.ev).toBe(0);
    const a = ask('Waarom is mijn energierekening hoger deze maand?', f);
    expect(a.intent).toBe('BILL_WHY_HIGH');
    expect(plain(a)).not.toContain('auto');
    expect(plain(a)).toContain('Kouder weer');
    expect(a.facts.map((x) => x.label)).not.toContain('Aandeel auto');
    expect(a.actions.every((x) => x.kind !== 'route')).toBe(true);
  });

  it('why-higher for a named month compares it with the month before', () => {
    const a = ask('Why was my usage higher in September?', customer('en'));
    expect(a.intent).toBe('BILL_WHY_HIGH');
    expect(plain(a)).toMatch(/^(Your September 2026 costs were|Good news: September 2026 was actually cheaper than August 2026)/);
    expect(a.facts.map((x) => x.label)).toEqual(['September 2026 cost', 'August 2026 cost']);
  });

  it('installment quotes the current and the advised amount when the gap is €5 or more', () => {
    const f = customer('en');
    const c = f.contract!;
    expect(c.advisedInstallment - c.installment).toBe(25);
    const a = ask('What is my current monthly installment?', f);
    expect(a.intent).toBe('INSTALLMENT');
    expect(plain(a)).toContain(`Your monthly installment is ${fmtEur(c.installment, 'en', 2)}, collected by direct debit on the 28th.`);
    expect(plain(a)).toContain(`Our advice is ${fmtEur(c.advisedInstallment, 'en', 0)} a month.`);
    expect(a.facts.slice(0, 2)).toEqual([
      { label: 'Current installment', value: fmtEur(c.installment, 'en', 2) },
      { label: 'Advised installment', value: fmtEur(c.advisedInstallment, 'en', 2) },
    ]);
    expect(a.facts[2].tone).toBe(f.annual!.expectedSettlement > 60 ? 'warn' : 'good');
    expect(a.actions).toEqual([{ kind: 'route', label: 'Adjust installment', route: '/billing?adjust=1' }]);
    const nl = ask('Wat is mijn huidige termijnbedrag?', customer('nl'));
    expect(plain(nl)).toContain(`Ons advies is ${fmtEur(c.advisedInstallment, 'nl', 0)} per maand.`);
  });

  it('installment on the advice says it fits', () => {
    const a = ask('What is my monthly payment?', customer('en', {}, PROFILE, 0));
    expect(a.intent).toBe('INSTALLMENT');
    expect(plain(a)).toContain('That fits your usage');
    expect(plain(a)).not.toContain('Our advice is');
  });

  it('invoices: the latest paid installment, a named month, and the next payment', () => {
    const f = customer('en');
    const october = f.invoices!.find((i) => i.kind === 'INSTALLMENT' && i.status === 'PAID')!;
    const latest = ask('Can you explain my latest invoice?', f);
    expect(latest.intent).toBe('INVOICE');
    expect(plain(latest)).toContain(`Your latest invoice is the installment note for October 2026 (${october.number}) of ${fmtEur(october.amount, 'en', 2)}.`);
    expect(plain(latest)).toContain('Your last annual statement (12 March 2026)');
    expect(latest.facts).toHaveLength(2);
    const sep = ask('Show me my September invoice', f);
    expect(plain(sep)).toContain('Your September 2026 installment invoice');
    expect(plain(sep)).toContain('Paid by direct debit on 28 September 2026.');
    const pay = ask('When is my next payment?', f);
    expect(pay.intent).toBe('PAYMENT');
    expect(plain(pay)).toContain(`Your next payment is ${fmtEur(f.contract!.installment, 'en', 2)} for November 2026, collected by direct debit from NL•• INGB •••• 4821 on 28 November 2026.`);
  });
});

describe('Eva: visitors, hand-off and fallback', () => {
  it('a visitor asking a personal question gets a sign-in action', () => {
    for (const q of ['How much energy did I consume this month?', 'What is my current monthly installment?', 'When should I charge my EV?']) {
      const a = ask(q, visitor('en'));
      expect(a.matched).toBe(true);
      expect(a.signInPrompt).toBe(true);
      expect(a.handoff).toBe(false);
      expect(a.actions).toEqual([{ kind: 'signIn', label: 'Sign in (demo)' }]);
      expect(a.chart).toBeNull();
      expect(a.facts).toEqual([]);
      expect(a.followUps).toEqual([PHRASES.PRODUCTS.en, PHRASES.SWITCH.en, PHRASES.GREEN.en]);
    }
    expect(ask('Wat is mijn huidige termijnbedrag?', visitor('nl')).actions).toEqual([{ kind: 'signIn', label: 'Inloggen (demo)' }]);
  });

  it('a visitor asking about products gets a general answer', () => {
    const a = ask('Which energy contract suits me?', visitor('en'));
    expect(a.intent).toBe('PRODUCTS');
    expect(a.signInPrompt).toBe(false);
    expect(a.text[0]).toBe('ENGIE offers four ways to buy energy:');
    expect(a.text.filter((l) => l.startsWith('•'))).toHaveLength(4);
    expect(a.actions.every((x) => x.kind === 'prompt')).toBe(true);
    expect(a.followUps).toEqual([PHRASES.SWITCH.en, PHRASES.GREEN.en]);
    // A visitor has no contract, so a contract question gets the product overview too.
    const contract = ask('I want a fixed contract', visitor('nl'));
    expect(contract.intent).toBe('CONTRACT');
    expect(contract.signInPrompt).toBe(false);
    expect(contract.text[0]).toBe('ENGIE heeft vier manieren om energie af te nemen:');
  });

  it('a signed-in customer gets their own contract and no sign-in prompt', () => {
    const a = ask('What contract do I have?', customer('en'));
    expect(a.intent).toBe('CONTRACT');
    expect(a.signInPrompt).toBe(false);
    expect(plain(a)).toContain('You have Dynamic Electricity & Fixed Gas.');
    expect(plain(a)).toContain('fixed until 1 March 2027');
  });

  it('asking for a person hands off to customer service', () => {
    for (const f of [customer('en'), visitor('en')]) {
      const a = ask('I want to speak to customer service', f);
      expect(a.intent).toBe('HUMAN');
      expect(a.handoff).toBe(true);
      expect(a.signInPrompt).toBe(false);
      expect(plain(a)).toContain('Customer Service is available');
    }
    expect(ask('Ik wil de klantenservice spreken', customer('nl')).handoff).toBe(true);
    expect(ask('How much energy did I consume this month?', customer('en')).handoff).toBe(false);
  });

  it('an unknown question is a fallback, worded for the audience', () => {
    const a = ask('What is the capital of France?', customer('en'));
    expect(a.intent).toBe('FALLBACK');
    expect(a.matched).toBe(false);
    expect(a.handoff).toBe(false);
    expect(plain(a)).toContain('I’m not sure I understood that.');
    expect(plain(a)).toContain('Shall I put you through to Customer Service?');
    expect(a.actions.map((x) => x.kind)).toEqual(['prompt', 'prompt']);
    const v = ask('blah blah', visitor('nl'));
    expect(v.matched).toBe(false);
    expect(plain(v)).toContain('zodra je inlogt');
    expect(v.followUps).toEqual([PHRASES.PRODUCTS.nl, PHRASES.SWITCH.nl, PHRASES.GREEN.nl]);
  });
});

describe('Eva: answer envelope', () => {
  it('splits answers into paragraphs: text is a list of non-empty lines', () => {
    const f = customer('en');
    for (const q of Object.values(PHRASES)) {
      for (const a of [ask(q.en, f), ask(q.nl, customer('nl')), ask(q.en, visitor('en'))]) {
        expect(Array.isArray(a.text)).toBe(true);
        expect(a.text.length).toBeGreaterThan(0);
        for (const line of a.text) {
          expect(line.trim().length).toBeGreaterThan(0);
          expect(line).not.toContain('\n');
        }
        expect(a.followUps.length).toBeLessThanOrEqual(4);
      }
    }
    const why = ask('Why is my energy bill higher this month?', f);
    expect(why.text.length).toBeGreaterThanOrEqual(4);
    expect(why.text.filter((l) => l.startsWith('•'))).toHaveLength(2);
  });

  it('every suggestion phrase is answered (not a fallback) for a customer in both languages', () => {
    for (const [id, q] of Object.entries(PHRASES)) {
      expect(ask(q.en, customer('en')).intent).toBe(id);
      expect(ask(q.nl, customer('nl')).matched).toBe(true);
    }
  });

  it('carries the intent, route and timestamp, and never suggests the question just asked', () => {
    const a = ask('When should I charge my EV?', customer('en'), undefined, '/smart-charging');
    expect(a.context).toEqual({ lastIntent: 'EV', route: '/smart-charging' });
    expect(a.generatedAt).toBe(NOW.toISOString());
    expect(a.followUps).toEqual([PHRASES.FLEX.en, PHRASES.SAVE.en, PHRASES.BILL_WHY_HIGH.en]);
    expect(ask('Is your electricity green?', visitor('en')).followUps).not.toContain(PHRASES.GREEN.en);
  });

  it('greets by name and answers a flex question from the active flex event', () => {
    expect(plain(ask('hoi', customer('nl')))).toContain('Hoi Sanne! Ik ben Eva.');
    expect(plain(ask('hello', visitor('en')))).toContain(ASSISTANT.customerIntro.en);
    const none = ask('Is there a flex moment today?', customer('en'));
    expect(none.intent).toBe('FLEX');
    expect(plain(none)).toContain('Slim Laden charges your car at the cheapest hours');
    const active = ask('Is there a flex moment today?', customer('en', {
      evStatus: 'ENROLLED',
      activeFlexEvent: { id: 'e1', title: 'Later laden', windowStart: '2026-11-16T16:00:00Z', windowEnd: '2026-11-16T19:00:00Z', status: 'SCHEDULED', myResponse: null },
    }));
    expect(plain(active)).toContain('the grid in your neighbourhood is busy today between 17:00–20:00');
    expect(active.actions).toEqual([{ kind: 'route', label: 'Open flex request', route: '/flex-events/e1' }]);
  });
});
