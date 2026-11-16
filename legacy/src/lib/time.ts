/**
 * Demo clock. The prototype runs on a fixed "now" in Amsterdam time, whatever the presenter's laptop
 * is set to, so charts, totals and assistant answers always agree.
 */
export const DEMO_TZ = 'Europe/Amsterdam';

/** Monday 16 November 2026, 14:20 in Amsterdam (13:20 UTC). */
export const DEMO_NOW = new Date('2026-11-16T13:20:00Z');

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: DEMO_TZ,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hourCycle: 'h23',
});
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Calendar fields of an instant in the demo time zone. */
export function zoned(d: Date): ZonedParts {
  const p = Object.fromEntries(PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday ?? 'Mon'),
  };
}

/** "YYYY-MM-DD" for a calendar day `offset` days from (year, month, day); no time-zone maths involved. */
export function dayKey(year: number, month: number, day: number, offset = 0): string {
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

/** Weekday (0 = Sunday) of a "YYYY-MM-DD" key. */
export function weekdayOf(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

export function greetingKey(d: Date = DEMO_NOW): 'morning' | 'afternoon' | 'evening' {
  const h = zoned(d).hour;
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
