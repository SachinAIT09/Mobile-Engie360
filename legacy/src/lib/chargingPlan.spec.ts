import { describe, expect, it } from 'vitest';
import { tomorrowPrices } from '../data/energy';
import { clock, planCharging, quarterPrice, STEP_MIN } from './chargingPlan';

const hourPrices = tomorrowPrices.map((p) => p.price);
const base = { hourPrices, plugInHour: 18, readyBy: 7 };

describe('quarterPrice', () => {
  it('starts each hour at the hourly price and drifts towards the next hour', () => {
    expect(quarterPrice(hourPrices, 18 * 60)).toBe(hourPrices[18]);
    const q3 = quarterPrice(hourPrices, 18 * 60 + 45);
    const h18 = hourPrices[18] as number;
    const h19 = hourPrices[19] as number;
    expect(q3).toBeGreaterThanOrEqual(Math.min(h18, h19));
    expect(q3).toBeLessThanOrEqual(Math.max(h18, h19));
  });
});

describe('planCharging', () => {
  it('uses 15-minute blocks from plug-in to ready-by', () => {
    const p = planCharging({ ...base, kwh: 24 });
    expect(p.window).toHaveLength(13 * 4); // 18:00 → 07:00
    expect(p.window[0]?.start).toBe(18 * 60);
    expect(p.window.at(-1)?.start).toBe(31 * 60 - STEP_MIN);
  });

  it('delivers the requested energy', () => {
    const p = planCharging({ ...base, kwh: 24 });
    expect(p.deliveredKwh).toBeCloseTo(24, 6);
    expect(p.window.filter((b) => b.charging)).toHaveLength(Math.ceil(24 / 0.825));
  });

  it('is never more expensive than charging on plug-in', () => {
    for (const kwh of [6, 12, 24, 40]) {
      const p = planCharging({ ...base, kwh });
      expect(p.smartCost).toBeLessThanOrEqual(p.directCost + 1e-9);
    }
  });

  it('avoids the evening peak and finishes before ready-by', () => {
    const p = planCharging({ ...base, kwh: 12 });
    for (const s of p.sessions) {
      expect(s.from).toBeGreaterThanOrEqual(22 * 60);
      expect(s.to).toBeLessThanOrEqual(31 * 60);
    }
  });

  it('caps delivery when the window is too short', () => {
    const p = planCharging({ ...base, readyBy: 20, kwh: 40 });
    expect(p.deliveredKwh).toBeCloseTo(2 * 3.3, 6);
  });
});

describe('clock', () => {
  it('formats minutes and wraps past midnight', () => {
    expect(clock(18 * 60)).toBe('18:00');
    expect(clock(25 * 60 + 15)).toBe('01:15');
  });
});
