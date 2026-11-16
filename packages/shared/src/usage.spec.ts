import { describe, expect, it } from 'vitest';
import {
  applianceBreakdown,
  dailyUsage,
  hourlyUsage,
  lastMonthSummary,
  monthlyUsage,
  priceAt,
  thisMonth,
  weeklyUsage,
  type UsageProfile,
} from './usage';

const now = new Date('2026-11-16T13:20:00Z');
const base: UsageProfile = { seed: 1, elecScale: 1, gasScale: 1, evSince: null, elecPrice: 0.25, gasPrice: 1.25, fixedPerMonth: 22.8 };
const withEv: UsageProfile = { ...base, evSince: '2026-08-25T00:00:00Z' };

describe('usage model', () => {
  it('is deterministic per seed', () => {
    expect(monthlyUsage(base, now)).toEqual(monthlyUsage(base, now));
    expect(monthlyUsage({ ...base, seed: 2 }, now)).not.toEqual(monthlyUsage(base, now));
  });

  it('gives the last 12 complete months, oldest first', () => {
    const m = monthlyUsage(base, now);
    expect(m).toHaveLength(12);
    expect(m[0]?.key).toBe('2025-11');
    expect(m[11]?.key).toBe('2026-10');
    expect(m[11]?.label).toEqual({ en: 'Oct 26', nl: 'okt 26' });
  });

  it('adds EV charging only from the month the EV arrived', () => {
    const m = monthlyUsage(withEv, now);
    expect(m.find((x) => x.key === '2026-07')?.ev).toBe(0);
    expect(m.find((x) => x.key === '2026-08')?.ev).toBeGreaterThan(0);
    expect(m.find((x) => x.key === '2026-10')?.ev).toBe(78);
    expect(monthlyUsage(base, now).every((x) => x.ev === 0)).toBe(true);
  });

  it('daily: 30 days ending with a partial today', () => {
    const d = dailyUsage(withEv, now);
    expect(d).toHaveLength(30);
    expect(d[29]?.key).toBe('2026-11-16');
    expect(d[29]?.forecast).toBe(true);
    expect(d[29]?.ev).toBe(0);
  });

  it('weekly: the latest weeks agree with the daily series', () => {
    const d = dailyUsage(withEv, now);
    const w = weeklyUsage(withEv, now);
    expect(w).toHaveLength(12);
    const last7 = d.slice(23).reduce((s, x) => s + x.electricity, 0);
    expect(w[11]?.electricity).toBeCloseTo(last7, 0);
  });

  it('hourly: 24 hours with the dynamic price', () => {
    const h = hourlyUsage(withEv, now);
    expect(h).toHaveLength(24);
    expect(h.every((x) => x.price !== null)).toBe(true);
    expect(priceAt(18)).toBe(0.39);
    expect(priceAt(13)).toBe(0.17);
  });

  it('breakdown sums to last month and lists EV first when present', () => {
    const b = applianceBreakdown(withEv, now);
    const total = monthlyUsage(withEv, now)[11]?.electricity ?? 0;
    expect(Math.abs(b.reduce((s, x) => s + x.kwh, 0) - total)).toBeLessThanOrEqual(3);
    expect(b[0]?.key).toBe('ev');
    expect(applianceBreakdown(base, now).some((x) => x.key === 'ev')).toBe(false);
    expect(applianceBreakdown(base, now, true).some((x) => x.key === 'heatpump')).toBe(true);
  });

  it('summaries: last month vs before, and month to date', () => {
    const s = lastMonthSummary(withEv, now);
    expect(s.label.nl).toBe('oktober 2026');
    expect(s.elecVsPrevMonthPct).toBeGreaterThan(0);
    const t = thisMonth(withEv, now);
    expect(t.daysElapsed).toBe(16);
    expect(t.forecastElectricity).toBeGreaterThan(t.electricity);
    expect(t.forecastCost).toBeGreaterThan(t.costSoFar);
  });
});
