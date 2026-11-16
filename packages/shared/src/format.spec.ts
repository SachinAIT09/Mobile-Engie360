import { describe, expect, it } from 'vitest';
import { dayKey, fmtDate, fmtInt, fmtKw, fmtKwh, fmtMoney, fmtRelative, fmtTime, fmtWindow, minutesUntil, weekdayOf, zoned } from './format';
import { fmtEur, fmtNum } from './i18n';

// Instants are UTC; labels come out in Europe/Amsterdam (CET in November = UTC+1, CEST in October = UTC+2).

describe('times and windows', () => {
  it('uses the 24-hour clock in Amsterdam time', () => {
    expect(fmtTime('2026-11-16T16:00:00Z')).toBe('17:00');
    expect(fmtTime('2026-10-16T15:00:00Z')).toBe('17:00');
  });

  it('formats a window as "17:00–20:00"', () => {
    expect(fmtWindow('2026-11-16T16:00:00Z', '2026-11-16T19:00:00Z')).toBe('17:00–20:00');
  });
});

describe('fmtRelative', () => {
  const now = new Date('2026-11-16T13:20:00Z'); // Mon 16 Nov, 14:20 CET

  it('shows the time for today', () => {
    expect(fmtRelative('2026-11-16T08:05:00Z', now)).toBe('09:05');
  });

  it('says Yesterday / Gisteren', () => {
    expect(fmtRelative('2026-11-15T20:00:00Z', now)).toBe('Yesterday');
    expect(fmtRelative('2026-11-15T20:00:00Z', now, 'nl')).toBe('Gisteren');
  });

  it('shows day and month before that', () => {
    expect(fmtRelative('2026-11-02T10:00:00Z', now)).toBe('2 Nov');
    expect(fmtRelative('2026-11-02T10:00:00Z', now, 'nl')).toBe('2 nov');
  });
});

describe('money and numbers', () => {
  it('formats euros in Dutch and English', () => {
    expect(fmtEur(1234.5, 'nl').replace(/\s/g, ' ')).toBe('€ 1.234,50');
    expect(fmtMoney(1234.5)).toBe('€1,234.50');
  });

  it('formats numbers, kWh and kW', () => {
    expect(fmtNum(3195, 'nl')).toBe('3.195');
    expect(fmtInt(3195)).toBe('3,195');
    expect(fmtKwh(7.25)).toBe('7.3 kWh');
    expect(fmtKwh(7.25, 1, 'nl')).toBe('7,3 kWh');
    expect(fmtKw(11)).toBe('11.0 kW');
  });

  it('formats dates', () => {
    expect(fmtDate('2026-11-28T10:00:00Z')).toBe('28 Nov 2026');
    expect(fmtDate('2026-11-28T10:00:00Z', undefined, 'nl')).toBe('28 nov 2026');
  });
});

describe('calendar helpers', () => {
  it('reads Amsterdam wall-clock parts', () => {
    expect(zoned(new Date('2026-11-16T23:30:00Z'))).toMatchObject({ day: 17, hour: 0, minute: 30, weekday: 2 });
  });

  it('steps calendar days without time-zone drift', () => {
    expect(dayKey(2026, 11, 1, -1)).toBe('2026-10-31');
    expect(weekdayOf('2026-11-16')).toBe(1);
  });

  it('counts minutes until a time, never negative', () => {
    expect(minutesUntil('2026-11-16T14:00:00Z', Date.parse('2026-11-16T13:20:00Z'))).toBe(40);
    expect(minutesUntil('2026-11-16T13:00:00Z', Date.parse('2026-11-16T13:20:00Z'))).toBe(0);
  });
});
