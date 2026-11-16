import { describe, expect, it } from 'vitest';
import { DYNAMIC_PRICE, GRID_CO2_G_PER_KWH, RATE_PLANS } from '@engie/shared';
import { RATE_PLAN_IDS, co2At, comparePlans, costOfSteps, periodAt, type PlanProfile } from './tariff.js';

const WED = 3;
const SAT = 6;

describe('periodAt', () => {
  it('DYNAMIC: one price per hour from the day-ahead table, the same every day', () => {
    for (let h = 0; h < 24; h++) {
      expect(periodAt('DYNAMIC', h + 0.5, WED).rate).toBe(DYNAMIC_PRICE[h]);
      expect(periodAt('DYNAMIC', h, SAT)).toEqual(periodAt('DYNAMIC', h, WED));
    }
    expect(periodAt('DYNAMIC', 13, WED)).toEqual({ period: 'goedkoop', rate: 0.17 });
    expect(periodAt('DYNAMIC', 18, WED)).toEqual({ period: 'piek', rate: 0.39 });
    expect(periodAt('DYNAMIC', 22, WED).period).toBe('normaal');
  });

  it('DUAL weekday: dal 23–07 (wrapping midnight), normaal 07–23', () => {
    expect(periodAt('DUAL', 23.5, WED)).toEqual({ period: 'dal', rate: 0.231 });
    expect(periodAt('DUAL', 3, WED).period).toBe('dal');
    expect(periodAt('DUAL', 6.75, WED).period).toBe('dal');
    expect(periodAt('DUAL', 7, WED)).toEqual({ period: 'normaal', rate: 0.268 });
    expect(periodAt('DUAL', 22.75, WED).period).toBe('normaal');
  });

  it('DUAL weekend is dal all day (first matching rule wins)', () => {
    for (let h = 0; h < 24; h += 0.5) expect(periodAt('DUAL', h, SAT).period).toBe('dal');
    expect(periodAt('DUAL', 18, 0).period).toBe('dal');
  });

  it('FIXED is one rate at any hour; hours wrap', () => {
    expect(periodAt('FIXED', 4, WED)).toEqual({ period: 'vast', rate: 0.259 });
    expect(periodAt('FIXED', 19, SAT)).toEqual({ period: 'vast', rate: 0.259 });
    expect(periodAt('DUAL', 27, WED).period).toBe('dal');
    expect(periodAt('DUAL', -1, WED).period).toBe('dal');
  });

  it('every plan covers every hour of every day', () => {
    expect(RATE_PLAN_IDS).toEqual(['DYNAMIC', 'DUAL', 'FIXED']);
    for (const id of RATE_PLAN_IDS)
      for (let d = 0; d < 7; d++)
        for (let h = 0; h < 24; h += 0.25) {
          const p = periodAt(id, h, d);
          expect(RATE_PLANS[id].periods.some((r) => r.name === p.period && r.rate === p.rate)).toBe(true);
        }
  });
});

describe('co2At', () => {
  it('reads the hourly table and wraps', () => {
    expect(co2At(18.9)).toBe(GRID_CO2_G_PER_KWH[18]);
    expect(co2At(25)).toBe(GRID_CO2_G_PER_KWH[1]);
    expect(co2At(3)).toBeLessThan(co2At(19));
    expect(co2At(12)).toBeLessThan(co2At(3));
  });
});

describe('costOfSteps', () => {
  it('charges each step at the rate of its hour', () => {
    expect(costOfSteps([], 'DUAL')).toBe(0);
    expect(costOfSteps([{ hour: 20, weekday: WED, kwh: 10 }], 'DUAL')).toBeCloseTo(2.68, 10);
    expect(costOfSteps([{ hour: 8, weekday: WED, kwh: 10 }, { hour: 1, weekday: WED, kwh: 10 }], 'DUAL')).toBeCloseTo(2.68 + 2.31, 10);
    expect(costOfSteps([{ hour: 8, weekday: SAT, kwh: 10 }], 'DUAL')).toBeCloseTo(2.31, 10);
    expect(costOfSteps([{ hour: 18, weekday: WED, kwh: 10 }, { hour: 3, weekday: WED, kwh: 10 }], 'DYNAMIC')).toBeCloseTo(3.9 + 1.9, 10);
  });

  it('FIXED depends only on the total kWh', () => {
    const one = costOfSteps([{ hour: 0, weekday: WED, kwh: 100 }], 'FIXED');
    const split = costOfSteps([{ hour: 18, weekday: SAT, kwh: 40 }, { hour: 1, weekday: WED, kwh: 60 }], 'FIXED');
    expect(one).toBeCloseTo(25.9, 10);
    expect(split).toBeCloseTo(one, 10);
  });
});

describe('comparePlans', () => {
  const profile: PlanProfile = {
    basisKwhPerMonth: 600,
    homeShape: Array.from({ length: 24 }, (_, h) => (h >= 17 && h < 22 ? 2 : 1)),
    evKwhPerNight: 8,
    evKw: 3.7,
    plugInHour: 18,
    readyByHour: 7,
    current: 'DUAL',
  };

  it('costs each plan with and without smart charging; smart never costs more; the single rate is unaffected', () => {
    const r = comparePlans(profile);
    expect(r.basisKwhPerMonth).toBe(600);
    expect(r.plans.map((p) => p.id)).toEqual(['DYNAMIC', 'DUAL', 'FIXED']);
    for (const p of r.plans) expect(p.withSmartCharging).toBeLessThanOrEqual(p.monthlyCost);
    const dynamic = r.plans.find((p) => p.id === 'DYNAMIC')!;
    const dual = r.plans.find((p) => p.id === 'DUAL')!;
    const fixed = r.plans.find((p) => p.id === 'FIXED')!;
    expect(dynamic.withSmartCharging).toBeLessThan(dynamic.monthlyCost);
    expect(dual.withSmartCharging).toBeLessThan(dual.monthlyCost);
    expect(fixed.withSmartCharging).toBe(fixed.monthlyCost);
    expect(fixed.monthlyCost).toBeCloseTo(600 * 0.259, 1);
    expect(r.plans.filter((p) => p.best)).toHaveLength(1);
    expect(r.plans.filter((p) => p.current).map((p) => p.id)).toEqual(['DUAL']);
    const best = r.plans.find((p) => p.best)!;
    expect(Math.min(...r.plans.map((p) => p.withSmartCharging))).toBe(best.withSmartCharging);
  });

  it('without an EV both columns match and the best plan is the cheapest monthly cost', () => {
    const r = comparePlans({ ...profile, evKwhPerNight: 0, current: 'FIXED' });
    for (const p of r.plans) expect(p.withSmartCharging).toBe(p.monthlyCost);
    const best = r.plans.find((p) => p.best)!;
    expect(Math.min(...r.plans.map((p) => p.monthlyCost))).toBe(best.monthlyCost);
    expect(r.plans.find((p) => p.current)!.id).toBe('FIXED');
  });

  it('is deterministic', () => {
    expect(comparePlans(profile)).toEqual(comparePlans(profile));
  });
});
