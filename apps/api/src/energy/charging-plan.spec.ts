import { describe, expect, it } from 'vitest';
import { RATE_PLANS, type ChargeSlot } from '@engie/shared';
import { zonedTime } from '../common/time.js';
import {
  avgEvKw,
  baseline,
  defaultNightShift,
  evKwAt,
  localClock,
  planCharging,
  repeatDaily,
  sessionFor,
  slotSteps,
  summarisePlan,
  type PlanInput,
} from './charging-plan.js';

const TZ = 'America/Toronto';
/** Local wall-clock instant in Toronto, October 2026 (Oct 21 = Wednesday, Oct 24 = Saturday). */
const at = (day: number, hour: number, minute = 0) => zonedTime(2026, 10, day, hour, minute, TZ);
const kwhOf = (slots: ChargeSlot[]) => slotSteps(slots, TZ).reduce((s, x) => s + x.kwh, 0);
const localHours = (slots: ChargeSlot[]) => slotSteps(slots, TZ).map((s) => s.hour);
const overlaps = (s: ChargeSlot, w: { start: Date; end: Date }) => Date.parse(s.start) < w.end.getTime() && Date.parse(s.end) > w.start.getTime();

/** Charger power used throughout (EV_CHARGE_KW). */
const KW = 3.7;
const wedNight = { start: at(21, 18), end: at(22, 7) };
const input = (over: Partial<PlanInput> = {}): PlanInput => ({ session: wedNight, needKwh: 30, maxKw: KW, planId: 'DUAL', blocked: [], tz: TZ, ...over });

describe('sessionFor', () => {
  it('during the day returns the coming night (18:00 → 07:00 next day)', () => {
    const s = sessionFor(at(21, 10), '07:00', 18, TZ);
    expect(s).toEqual(wedNight);
  });

  it('is stable within the day, whatever the minute', () => {
    expect(sessionFor(at(21, 10, 37), '07:00', 18, TZ)).toEqual(sessionFor(at(21, 7, 0), '07:00', 18, TZ));
    expect(sessionFor(at(21, 23, 59), '07:00', 18, TZ)).toEqual(wedNight);
  });

  it('before ready-by it is still last night’s session', () => {
    expect(sessionFor(at(22, 6, 59), '07:00', 18, TZ)).toEqual(wedNight);
    expect(sessionFor(at(22, 7, 0), '07:00', 18, TZ).start).toEqual(at(22, 18));
  });

  it('a ready-by before the plug-in hour crosses midnight; one after it stays the same evening', () => {
    expect(sessionFor(at(21, 12), '06:00', 18, TZ)).toEqual({ start: at(21, 18), end: at(22, 6) });
    expect(sessionFor(at(21, 12), '17:00', 18, TZ)).toEqual({ start: at(20, 18), end: at(21, 17) });
    expect(sessionFor(at(21, 17, 30), '17:00', 18, TZ)).toEqual({ start: at(21, 18), end: at(22, 17) });
    expect(sessionFor(at(21, 12), '23:00', 18, TZ)).toEqual({ start: at(21, 18), end: at(21, 23) });
  });

  it('crosses month ends', () => {
    expect(sessionFor(zonedTime(2026, 10, 31, 12, 0, TZ), '07:00', 18, TZ)).toEqual({ start: zonedTime(2026, 10, 31, 18, 0, TZ), end: zonedTime(2026, 11, 1, 7, 0, TZ) });
  });
});

describe('planCharging', () => {
  it('DUAL: 20 kWh lands entirely in the dal hours (23:00–07:00) and inside the session', () => {
    const r = planCharging(input({ needKwh: 20 }));
    expect(r.plannedKwh).toBe(20);
    expect(r.shortfallKwh).toBe(0);
    expect(kwhOf(r.slots)).toBeCloseTo(20, 1);
    for (const s of r.slots) {
      expect(s.period).toBe('dal');
      expect(s.ratePerKwh).toBe(0.231);
      expect(Date.parse(s.start)).toBeGreaterThanOrEqual(wedNight.start.getTime());
      expect(Date.parse(s.end)).toBeLessThanOrEqual(wedNight.end.getTime());
    }
    for (const h of localHours(r.slots)) expect(h >= 23 || h < 7).toBe(true);
  });

  it('DUAL: a target larger than the dal hours spills into the cleanest normaal hours', () => {
    const r = planCharging(input({ needKwh: 36 }));
    expect(r.plannedKwh).toBe(36);
    expect(r.slots.map((s) => s.period).sort()).toEqual(['dal', 'normaal']);
    const dal = r.slots.find((s) => s.period === 'dal')!;
    expect(dal.start).toBe(at(21, 23).toISOString());
    expect(dal.end).toBe(at(22, 7).toISOString());
    // Late evening is cleaner than the 18:00 plug-in hour.
    for (const h of localHours(r.slots.filter((s) => s.period === 'normaal'))) expect(h >= 21 && h < 23).toBe(true);
  });

  it('DYNAMIC: picks the cheapest hourly prices of the night', () => {
    const r = planCharging(input({ planId: 'DYNAMIC', needKwh: 20 }));
    expect(r.plannedKwh).toBe(20);
    // 20 kWh at 3.7 kW is 5.4 h: 00:00–06:00 holds the six cheapest hours of the session.
    for (const h of localHours(r.slots)) expect(h < 6).toBe(true);
    for (const s of r.slots) expect(s.ratePerKwh).toBe(RATE_PLANS.DYNAMIC.periods[Math.floor(localClock(Date.parse(s.start), TZ).hour)].rate);
    expect(Math.max(...r.slots.map((s) => s.ratePerKwh))).toBeLessThanOrEqual(0.22);
  });

  it('merges contiguous 15-minute blocks into runs (20 kWh on a weekday DUAL night is one run)', () => {
    const r = planCharging(input({ needKwh: 20 }));
    expect(r.slots).toHaveLength(1);
    expect((Date.parse(r.slots[0].end) - Date.parse(r.slots[0].start)) / 3600000).toBeCloseTo(20 / KW, 1);
    const dyn = planCharging(input({ planId: 'DYNAMIC', needKwh: 20 }));
    for (let i = 1; i < dyn.slots.length; i++) expect(Date.parse(dyn.slots[i].start)).toBeGreaterThanOrEqual(Date.parse(dyn.slots[i - 1].end));
  });

  it('a flex window 19–22 is excluded and the slots move', () => {
    const window = { start: at(21, 19), end: at(21, 22) };
    const free = planCharging(input({ needKwh: 36 }));
    expect(free.slots.some((s) => overlaps(s, window))).toBe(true);
    const r = planCharging(input({ needKwh: 36, blocked: [window] }));
    expect(r.plannedKwh).toBe(36);
    expect(r.slots.some((s) => overlaps(s, window))).toBe(false);
    expect(r.slots).not.toEqual(free.slots);
  });

  it('reports a shortfall when the session cannot fit the target', () => {
    const r = planCharging(input({ needKwh: 200 }));
    expect(r.plannedKwh).toBeCloseTo(13 * KW, 6);
    expect(r.shortfallKwh).toBeCloseTo(200 - 13 * KW, 6);
    const blocked = planCharging(input({ needKwh: 30, blocked: [{ start: at(21, 18), end: at(22, 6) }] }));
    expect(blocked.plannedKwh).toBeCloseTo(KW, 6);
    expect(blocked.shortfallKwh).toBeCloseTo(30 - KW, 6);
  });

  it('a ready-by before plug-in crosses midnight and charges after midnight', () => {
    const session = sessionFor(at(21, 9), '05:00', 18, TZ);
    const r = planCharging(input({ session, planId: 'DYNAMIC' }));
    expect(r.plannedKwh).toBe(30);
    expect(Date.parse(r.slots[r.slots.length - 1].end)).toBeLessThanOrEqual(at(22, 5).getTime());
    expect(localHours(r.slots).some((h) => h < 5)).toBe(true);
  });

  it('is deterministic', () => {
    expect(planCharging(input({ planId: 'DYNAMIC', needKwh: 43 }))).toEqual(planCharging(input({ planId: 'DYNAMIC', needKwh: 43 })));
  });

  it('FIXED: every hour costs the same, so it picks the cleanest hours (not the 18:00 plug-in hour)', () => {
    // 29.6 kWh is exactly 8 h at 3.7 kW (slot ends are rounded to the minute, so a partial block would leave a cent of difference).
    const r = planCharging(input({ planId: 'FIXED', needKwh: 29.6 }));
    for (const s of r.slots) expect(s.ratePerKwh).toBe(0.259);
    for (const h of localHours(r.slots)) expect(h >= 18 && h < 22).toBe(false);
    const base = baseline(wedNight, 29.6, KW, 'FIXED', TZ);
    const sum = summarisePlan(r.slots, base, wedNight, 'FIXED', TZ);
    expect(sum.savings).toBe(0);
    expect(sum.co2SavedKg).toBeGreaterThan(0);
  });

  it('weekend: DUAL is dal all day, so smart charging saves nothing on price', () => {
    const session = sessionFor(at(24, 12), '07:00', 18, TZ);
    expect(localClock(session.start.getTime(), TZ).weekday).toBe(6);
    const r = planCharging(input({ session, needKwh: 29.6 }));
    for (const s of r.slots) expect(s.period).toBe('dal');
    expect(summarisePlan(r.slots, baseline(session, 29.6, KW, 'DUAL', TZ), session, 'DUAL', TZ).savings).toBe(0);
  });

  it('nothing needed → no slots', () => {
    expect(planCharging(input({ needKwh: 0 }))).toEqual({ slots: [], plannedKwh: 0, shortfallKwh: 0 });
  });
});

describe('baseline, evKwAt, summarisePlan', () => {
  it('baseline charges from plug-in at full power', () => {
    const b = baseline(wedNight, 30, KW, 'DUAL', TZ);
    expect(b).toHaveLength(1);
    expect(b[0].start).toBe(wedNight.start.toISOString());
    expect(b[0].period).toBe('normaal');
    expect(kwhOf(b)).toBeCloseTo(30, 1);
  });

  it('evKwAt / avgEvKw read the plan', () => {
    const r = planCharging(input({ needKwh: 20 }));
    const first = r.slots[0];
    expect(evKwAt(r.slots, Date.parse(first.start))).toBe(KW);
    expect(evKwAt(r.slots, at(21, 12))).toBe(0);
    expect(avgEvKw(r.slots, wedNight.start.getTime(), wedNight.end.getTime()) * 13).toBeCloseTo(20, 1);
    expect(evKwAt(repeatDaily(r.slots), Date.parse(first.start) + 86400000)).toBe(KW);
  });

  it('weekday DYNAMIC: savings and CO₂ saved against charging at plug-in, 24 hourly points', () => {
    const r = planCharging(input({ planId: 'DYNAMIC', needKwh: 20 }));
    const base = baseline(wedNight, 20, KW, 'DYNAMIC', TZ);
    const sum = summarisePlan(r.slots, base, wedNight, 'DYNAMIC', TZ);
    expect(sum.cost).toBeLessThan(20 * 0.22);
    expect(sum.baselineCost).toBeGreaterThan(20 * 0.26);
    expect(sum.savings).toBeCloseTo(sum.baselineCost - sum.cost, 2);
    expect(sum.co2Kg).toBeLessThan(sum.baselineCo2Kg);
    expect(sum.co2SavedKg).toBeGreaterThan(0);
    expect(sum.hourly).toHaveLength(24);
    expect(sum.hourly[0].hour).toBe(wedNight.start.toISOString());
    expect(sum.hourly[0]).toMatchObject({ period: 'piek', rate: 0.39 });
    expect(sum.hourly.reduce((s, h) => s + h.kw, 0)).toBeCloseTo(20, 1);
  });
});

describe('defaultNightShift', () => {
  it('moves the default 30 kWh out of the 17–21 peak on a weekday', () => {
    const r = defaultNightShift(at(21, 10), TZ, KW);
    expect(r.shiftedKwh).toBeCloseTo(3 * KW, 2);
    expect(r.peakKwAvoided).toBeCloseTo(KW, 6);
  });
});
