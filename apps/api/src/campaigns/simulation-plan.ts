import { prng } from '../common/numbers.js';

export type SimulatedCampaignType = 'ENROLL_OFFER' | 'FLEX_REQUEST' | 'INSTALLMENT_ADVICE';

/** When (which tick, 1-based) a synthetic recipient delivers/opens/acts; -1 means never. */
export interface SimulationPlan<T> {
  c: T;
  deliver: number;
  open: number;
  act: number;
  response?: 'PAUSE' | 'OPT_OUT';
}

/** Number of ticks a simulated campaign plays out over, and the gap between them (~25 s in total). */
export const SIMULATION_TICKS = 10;
export const SIMULATION_TICK_MS = 2500;

/** Target behaviour rates (fractions of the sent audience) the plan is tuned to. */
export const SIMULATION_RATES = {
  delivered: 0.98,
  ENROLL_OFFER: { opened: 0.62, enrolled: 0.18 },
  FLEX_REQUEST: { opened: 0.88, responded: 0.84, paused: 0.76 },
  INSTALLMENT_ADVICE: { opened: 0.71, changed: 0.34 },
} as const;

/** Seed derived from a campaign id (its last 8 hex digits), so a campaign always replays the same way. */
export function seedFromId(id: string): number {
  return parseInt(id.slice(-8), 16);
}

/**
 * Plans realistic delivery/open/response behaviour for synthetic recipients.
 * Deterministic for a given seed. Offers: ~98% delivered, ~62% opened, ~18% enroll.
 * Flex requests: ~84% respond, ~76% shift, the remaining responders opt out.
 * Installment advice: ~71% opened, ~34% change their installment.
 * `rateScale` multiplies the act-once-opened probability (synthetic A/B difference for variant B).
 */
export function planSimulation<T>(
  type: SimulatedCampaignType,
  targets: readonly T[],
  seed: number,
  ticks = SIMULATION_TICKS,
  rateScale = 1,
): SimulationPlan<T>[] {
  const rnd = prng(seed);
  const rates = SIMULATION_RATES;
  // rateScale (A/B variant B) scales the chance of acting once opened; 1 keeps the baseline exactly.
  const k = Math.max(0, rateScale);
  const pEnroll = Math.min(1, (rates.ENROLL_OFFER.enrolled / rates.ENROLL_OFFER.opened) * k);
  const pChange = Math.min(1, (rates.INSTALLMENT_ADVICE.changed / rates.INSTALLMENT_ADVICE.opened) * k);
  const pRespond = Math.min(1, (rates.FLEX_REQUEST.responded / rates.FLEX_REQUEST.opened) * k);
  const pPause = Math.min(pRespond, (rates.FLEX_REQUEST.paused / rates.FLEX_REQUEST.opened) * k);
  return targets.map((c) => {
    const deliver = rnd() < rates.delivered ? 1 + Math.floor(rnd() * 2) : -1;
    const pOpen = rates[type].opened;
    const open = deliver > 0 && rnd() < pOpen ? deliver + Math.floor(rnd() * 4) : -1;
    let act = -1;
    let response: SimulationPlan<T>['response'];
    if (open > 0) {
      const r = rnd();
      if (type === 'ENROLL_OFFER') {
        if (r < pEnroll) act = open + 1 + Math.floor(rnd() * 4);
      } else if (type === 'INSTALLMENT_ADVICE') {
        if (r < pChange) act = open + 1 + Math.floor(rnd() * 4);
      } else if (r < pRespond) {
        act = open + Math.floor(rnd() * 4);
        response = r < pPause ? 'PAUSE' : 'OPT_OUT';
      }
    }
    return { c, deliver, open: Math.min(open, ticks), act: Math.min(act, ticks), response };
  });
}
