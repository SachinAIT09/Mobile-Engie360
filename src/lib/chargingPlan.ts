/**
 * Smart EV charging planner (pure, unit-tested in chargingPlan.spec.ts).
 * Works in 15-minute blocks, like the Dutch day-ahead market since October 2025: the car plugs in
 * at `plugInHour` and must hold `kwh` more energy by `readyBy` the next morning.
 */

export const STEP_MIN = 15;
const STEPS_PER_HOUR = 60 / STEP_MIN;

/** Average Dutch grid carbon intensity by hour (g CO₂/kWh): solar dip at midday, gas peak in the evening. Illustrative. */
export const GRID_CO2_G_PER_KWH = [
  310, 300, 295, 290, 292, 300, 330, 370, 360, 300, 240, 200, 185, 190, 215, 270, 340, 410, 430, 420, 390, 360, 335, 320,
];

export interface Block {
  /** Minutes after the plug-in day's midnight (may exceed 1440 for the next morning). */
  start: number;
  price: number; // € / kWh
  co2: number; // g / kWh
}

export interface PlanInput {
  kwh: number;
  /** Hourly prices for 24 hours (€ / kWh); quarter prices are interpolated within each hour. */
  hourPrices: readonly number[];
  plugInHour: number;
  readyBy: number;
  chargerKw?: number;
}

export interface Plan {
  window: (Block & { charging: boolean; direct: boolean })[];
  smartCost: number;
  directCost: number;
  smartCo2Kg: number;
  directCo2Kg: number;
  /** Contiguous charging periods, e.g. [{ from: 61*15, to: 81*15 }] in minutes. */
  sessions: { from: number; to: number }[];
  /** Energy actually delivered (less than `kwh` if the window is too short). */
  deliveredKwh: number;
}

/** Quarter-hour price: drifts from this hour's price towards the next hour's, as a 15-minute market does. */
export function quarterPrice(hourPrices: readonly number[], minute: number): number {
  const h = Math.floor(minute / 60) % 24;
  const q = Math.floor((minute % 60) / STEP_MIN);
  const now = hourPrices[h] ?? 0;
  const next = hourPrices[(h + 1) % 24] ?? now;
  return Math.round((now + ((next - now) * q) / (STEPS_PER_HOUR * 2)) * 1000) / 1000;
}

export function planCharging({ kwh, hourPrices, plugInHour, readyBy, chargerKw = 3.3 }: PlanInput): Plan {
  const startMin = plugInHour * 60;
  const endMin = (readyBy <= plugInHour ? readyBy + 24 : readyBy) * 60;
  const blocks: Block[] = [];
  for (let m = startMin; m < endMin; m += STEP_MIN) {
    blocks.push({ start: m, price: quarterPrice(hourPrices, m), co2: GRID_CO2_G_PER_KWH[Math.floor(m / 60) % 24] ?? 0 });
  }
  const perBlock = (chargerKw * STEP_MIN) / 60;
  const needed = Math.min(blocks.length, Math.ceil(kwh / perBlock - 1e-9));

  // Cheapest blocks first; ties go to the earlier block so the plan is stable.
  const smart = new Set([...blocks].sort((a, b) => a.price - b.price || a.start - b.start).slice(0, needed).map((b) => b.start));
  const direct = new Set(blocks.slice(0, needed).map((b) => b.start));

  const totals = (chosen: Set<number>) => {
    let left = kwh;
    let cost = 0;
    let co2 = 0;
    // The last (partial) block is the most expensive chosen one, so fill cheapest first.
    for (const b of blocks.filter((x) => chosen.has(x.start)).sort((a, c) => a.price - c.price)) {
      const e = Math.min(perBlock, left);
      cost += e * b.price;
      co2 += e * b.co2;
      left -= e;
    }
    return { cost, co2Kg: co2 / 1000, delivered: kwh - Math.max(0, left) };
  };
  const s = totals(smart);
  const d = totals(direct);

  const sessions: { from: number; to: number }[] = [];
  for (const b of blocks) {
    if (!smart.has(b.start)) continue;
    const last = sessions[sessions.length - 1];
    if (last && last.to === b.start) last.to = b.start + STEP_MIN;
    else sessions.push({ from: b.start, to: b.start + STEP_MIN });
  }

  return {
    window: blocks.map((b) => ({ ...b, charging: smart.has(b.start), direct: direct.has(b.start) })),
    smartCost: s.cost,
    directCost: d.cost,
    smartCo2Kg: s.co2Kg,
    directCo2Kg: d.co2Kg,
    sessions,
    deliveredKwh: s.delivered,
  };
}

/** "02:15" for minutes after midnight (wraps past 24 h). */
export function clock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
