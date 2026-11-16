import { describe, expect, it } from 'vitest';
import type { AssistantLogEntry } from '@engie/shared';
import { INTENTS } from './eva-intents.js';
import { INTENT_LABEL, summariseLog } from './log-summary.js';

const NOW = new Date('2026-11-16T13:20:00Z');
const HOUR = 3600000;

let n = 0;
/** A logged question `minutesAgo` before NOW; matched unless it is a FALLBACK. */
function entry(intent: string, over: Partial<AssistantLogEntry> & { minutesAgo?: number } = {}): AssistantLogEntry {
  const { minutesAgo = 5, ...rest } = over;
  return {
    id: `q${n++}`, at: new Date(NOW.getTime() - minutesAgo * 60000).toISOString(), channel: 'APP', customerId: 'c1', customerName: 'Sanne de Vries',
    question: intent.toLowerCase(), intent, matched: intent !== 'FALLBACK', signInPrompt: false, handoff: false, lang: 'nl', ...rest,
  };
}

// Newest first, as the service passes them.
const LOG: AssistantLogEntry[] = [
  entry('USAGE', { minutesAgo: 1 }),
  entry('GREETING', { minutesAgo: 2 }),
  entry('USAGE', { minutesAgo: 10 }),
  entry('HUMAN', { minutesAgo: 30, handoff: true }),
  entry('INSTALLMENT', { minutesAgo: 70, channel: 'WEBSITE', customerId: null, customerName: null, signInPrompt: true }),
  entry('FALLBACK', { minutesAgo: 80, channel: 'WEBSITE', customerId: null, customerName: null }),
  entry('PRODUCTS', { minutesAgo: 90, channel: 'WEBSITE', customerId: null, customerName: null }),
  entry('USAGE', { minutesAgo: 200, channel: 'WEBSITE_SIGNED_IN' }),
  entry('THANKS', { minutesAgo: 201, channel: 'WEBSITE_SIGNED_IN' }),
  entry('INSTALLMENT', { minutesAgo: 23 * 60 }),
  entry('FALLBACK', { minutesAgo: 23 * 60 + 10 }),
];

describe('summariseLog', () => {
  const s = summariseLog(LOG, 412, NOW);

  it('leaves greetings and thanks out of the counts', () => {
    expect(s.total).toBe(412);
    expect(s.last24h).toBe(9);
    expect(s.topIntents.map((t) => t.intent)).not.toContain('GREETING');
    expect(s.topIntents.map((t) => t.intent)).not.toContain('THANKS');
    expect(s.byChannel.APP + s.byChannel.WEBSITE + s.byChannel.WEBSITE_SIGNED_IN).toBe(9);
    expect(s.hourly.reduce((sum, h) => sum + h.count, 0)).toBe(9);
  });

  it('self-service % is answered without a hand-off; matched % includes hand-offs', () => {
    // 9 questions: 2 fallbacks, 1 hand-off, 6 answered by Eva.
    expect(s.matchedPct).toBe(78);
    expect(s.selfServicePct).toBe(67);
    expect(s.handoffs).toBe(1);
  });

  it('counts sign-in prompts and questions per channel', () => {
    expect(s.signInPrompts).toBe(1);
    expect(s.byChannel).toEqual({ APP: 5, WEBSITE: 3, WEBSITE_SIGNED_IN: 1 });
  });

  it('ranks the top intents by count, without FALLBACK, with staff labels', () => {
    expect(s.topIntents.map((t) => t.intent)).not.toContain('FALLBACK');
    expect(s.topIntents.slice(0, 2)).toEqual([
      { intent: 'USAGE', label: 'Usage this month', count: 3, matchedPct: 100 },
      { intent: 'INSTALLMENT', label: 'Monthly installment', count: 2, matchedPct: 100 },
    ]);
    expect(s.topIntents.map((t) => t.intent).sort()).toEqual(['HUMAN', 'INSTALLMENT', 'PRODUCTS', 'USAGE']);
    for (let i = 1; i < s.topIntents.length; i++) expect(s.topIntents[i - 1].count).toBeGreaterThanOrEqual(s.topIntents[i].count);
  });

  it('keeps at most eight intents, falls back to the id as label and reports a per-intent matched %', () => {
    const many = ['USAGE', 'INSTALLMENT', 'SAVE', 'INVOICE', 'SOLAR', 'CONTRACT', 'EV', 'FLEX', 'PAYMENT', 'METER'].flatMap((id, i) =>
      Array.from({ length: 10 - i }, () => entry(id)),
    );
    const top = summariseLog([...many, entry('NEW_INTENT'), entry('SAVE', { matched: false })], 0, NOW).topIntents;
    expect(top).toHaveLength(8);
    expect(top.map((t) => t.intent)).toEqual(['USAGE', 'INSTALLMENT', 'SAVE', 'INVOICE', 'SOLAR', 'CONTRACT', 'EV', 'FLEX']);
    expect(top[2]).toMatchObject({ count: 9, matchedPct: 89 });
    const odd = summariseLog([entry('NEW_INTENT')], 0, NOW).topIntents[0];
    expect(odd).toEqual({ intent: 'NEW_INTENT', label: 'NEW_INTENT', count: 1, matchedPct: 100 });
  });

  it('has 24 hourly buckets, oldest first, ending with the current hour', () => {
    expect(s.hourly).toHaveLength(24);
    expect(s.hourly[23].hour).toBe('2026-11-16T13:00:00.000Z');
    expect(s.hourly[0].hour).toBe('2026-11-15T14:00:00.000Z');
    for (let i = 1; i < 24; i++) expect(Date.parse(s.hourly[i].hour) - Date.parse(s.hourly[i - 1].hour)).toBe(HOUR);
    // 13:19 and 13:10 land in the current hour (the 13:18 greeting is not counted); 12:50, 12:10 and 12:00 in the one before.
    expect(s.hourly[23].count).toBe(2);
    expect(s.hourly[22].count).toBe(3);
    expect(s.hourly[21].count).toBe(1); // 11:50
    expect(s.hourly[20].count).toBe(1); // 10:00
    expect(s.hourly[0].count).toBe(2); // 14:20 and 14:10 yesterday
  });

  it('drops anything outside the 24 buckets from the hourly series only', () => {
    const old = summariseLog([entry('USAGE', { minutesAgo: 30 * 60 }), entry('USAGE', { minutesAgo: -90 })], 2, NOW);
    expect(old.last24h).toBe(2);
    expect(old.hourly.reduce((sum, h) => sum + h.count, 0)).toBe(0);
  });

  it('lists recent questions (greetings included) and unanswered ones', () => {
    expect(s.recent).toEqual(LOG);
    expect(s.unanswered.map((e) => e.intent)).toEqual(['FALLBACK', 'FALLBACK']);
    const long = Array.from({ length: 40 }, (_, i) => entry('FALLBACK', { minutesAgo: i }));
    const r = summariseLog(long, 40, NOW);
    expect(r.recent).toHaveLength(25);
    expect(r.unanswered).toHaveLength(10);
    expect(r.selfServicePct).toBe(0);
    expect(r.topIntents).toEqual([]);
  });

  it('an empty log is all zeros, not NaN', () => {
    const e = summariseLog([], 0, NOW);
    expect(e).toMatchObject({ total: 0, last24h: 0, selfServicePct: 0, matchedPct: 0, handoffs: 0, signInPrompts: 0, topIntents: [], recent: [], unanswered: [] });
    expect(e.byChannel).toEqual({ APP: 0, WEBSITE: 0, WEBSITE_SIGNED_IN: 0 });
    expect(e.hourly).toHaveLength(24);
    // Only greetings and thanks: still nothing to count.
    expect(summariseLog([entry('GREETING'), entry('THANKS')], 2, NOW)).toMatchObject({ total: 2, last24h: 0, selfServicePct: 0 });
  });

  it('has a staff label for every Eva intent and the fallback', () => {
    for (const d of INTENTS) expect(INTENT_LABEL[d.id]).toBeTruthy();
    expect(INTENT_LABEL.FALLBACK).toBe('Not understood');
  });
});
