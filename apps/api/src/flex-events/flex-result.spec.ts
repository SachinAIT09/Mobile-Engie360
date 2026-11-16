import { describe, expect, it } from 'vitest';
import { CHARGING_DUTY, MAX_CREDITED_HOURS, creditedHours, kwhShifted, peakReducedKwPerHousehold, peakReducedMw } from './flex-result.js';

describe('creditedHours', () => {
  it('defaults to 3 h and caps at 3 h', () => {
    expect(creditedHours(null)).toBe(3);
    expect(creditedHours(undefined)).toBe(3);
    expect(creditedHours(0)).toBe(3);
    expect(creditedHours(2)).toBe(2);
    expect(creditedHours(5)).toBe(MAX_CREDITED_HOURS);
  });
});

describe('kwhShifted', () => {
  it('a 3-hour window shifts 10.2 kWh per paused household', () => {
    expect(kwhShifted(3)).toBe(10.2);
    expect(kwhShifted(null)).toBe(10.2);
    expect(kwhShifted(6)).toBe(10.2);
  });

  it('scales with shorter windows to one decimal', () => {
    expect(kwhShifted(1)).toBe(3.4);
    expect(kwhShifted(2)).toBe(6.8);
    expect(kwhShifted(1.5)).toBe(5.1);
  });

  it('is derived from 3.7 kW × hours × duty', () => {
    expect(3.7 * 3 * CHARGING_DUTY).toBeCloseTo(10.2, 1);
  });
});

describe('peak reduction', () => {
  it('credits a full charger per paused household', () => {
    expect(peakReducedKwPerHousehold).toBe(3.7);
  });

  it('is paused × 3.7 / 1000 MW to three decimals', () => {
    expect(peakReducedMw(0)).toBe(0);
    expect(peakReducedMw(1)).toBe(0.004);
    expect(peakReducedMw(118)).toBe(0.437);
    expect(peakReducedMw(284)).toBe(1.051);
    expect(peakReducedMw(1000)).toBe(3.7);
  });
});
