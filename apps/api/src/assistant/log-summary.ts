import type { AssistantChannel, AssistantInsights, AssistantLogEntry } from '@engie/shared';

/** Staff-facing names for Eva's intents. */
export const INTENT_LABEL: Record<string, string> = {
  BILL_WHY_HIGH: 'Why is my bill higher?',
  USAGE: 'Usage this month',
  INSTALLMENT: 'Monthly installment',
  SAVE: 'Ways to save',
  INVOICE: 'Explain my invoice',
  SOLAR: 'Solar panels',
  CONTRACT: 'My contract',
  EV: 'EV charging',
  FLEX: 'Slim Laden & flex moments',
  PAYMENT: 'Payments',
  METER: 'Meter readings',
  OUTAGE: 'Power outage',
  MOVING: 'Moving house',
  HUMAN: 'Speak to customer service',
  PRODUCTS: 'Which contract suits me?',
  SWITCH: 'Switching to ENGIE',
  GREEN: 'Green electricity',
  GREETING: 'Greeting',
  THANKS: 'Thanks',
  FALLBACK: 'Not understood',
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Assistant insights over the last 24 hours of questions (newest first in `entries`).
 * Self-service = answered by Eva without a hand-off to customer service.
 */
export function summariseLog(entries: AssistantLogEntry[], allTimeTotal: number, now: Date): AssistantInsights {
  const real = entries.filter((e) => e.intent !== 'GREETING' && e.intent !== 'THANKS');
  const byChannel: Record<AssistantChannel, number> = { APP: 0, WEBSITE: 0, WEBSITE_SIGNED_IN: 0 };
  const intents = new Map<string, { count: number; matched: number }>();
  for (const e of real) {
    byChannel[e.channel]++;
    const i = intents.get(e.intent) ?? { count: 0, matched: 0 };
    i.count++;
    if (e.matched) i.matched++;
    intents.set(e.intent, i);
  }
  const hourStart = Math.floor(now.getTime() / 3600000) * 3600000;
  const hourly = Array.from({ length: 24 }, (_, k) => ({ hour: new Date(hourStart - (23 - k) * 3600000).toISOString(), count: 0 }));
  for (const e of real) {
    const idx = 23 - Math.floor((hourStart + 3600000 - 1 - new Date(e.at).getTime()) / 3600000);
    if (idx >= 0 && idx < 24) hourly[idx]!.count++;
  }
  const matched = real.filter((e) => e.matched).length;
  const handoffs = real.filter((e) => e.handoff).length;
  return {
    total: allTimeTotal,
    last24h: real.length,
    selfServicePct: pct(real.filter((e) => e.matched && !e.handoff).length, real.length),
    matchedPct: pct(matched, real.length),
    handoffs,
    signInPrompts: real.filter((e) => e.signInPrompt).length,
    byChannel,
    topIntents: [...intents.entries()]
      .filter(([id]) => id !== 'FALLBACK')
      .map(([intent, v]) => ({ intent, label: INTENT_LABEL[intent] ?? intent, count: v.count, matchedPct: pct(v.matched, v.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    hourly,
    recent: entries.slice(0, 25),
    unanswered: real.filter((e) => !e.matched).slice(0, 10),
  };
}
