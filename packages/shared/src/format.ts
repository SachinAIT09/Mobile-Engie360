import { type Lang, localeOf, fmtEur } from './i18n';

/** Formatting helpers used by both front ends and the API. Timezone is the Netherlands. */
export const DEMO_TZ = 'Europe/Amsterdam';

export function fmtMoney(n: number, lang: Lang = 'en'): string {
  return fmtEur(n, lang);
}

export function fmtInt(n: number, lang: Lang = 'en'): string {
  return Math.round(n).toLocaleString(localeOf(lang));
}

export function fmtKwh(n: number, digits = 1, lang: Lang = 'en'): string {
  return `${n.toLocaleString(localeOf(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits })} kWh`;
}

export function fmtKw(n: number, digits = 1, lang: Lang = 'en'): string {
  return `${n.toLocaleString(localeOf(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits })} kW`;
}

/** 24-hour clock, as used in the Netherlands: "17:00". */
export function fmtTime(iso: string, lang: Lang = 'en'): string {
  return new Date(iso).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: DEMO_TZ });
}

export function fmtDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  lang: Lang = 'en',
): string {
  return new Date(iso).toLocaleDateString(localeOf(lang), { ...opts, timeZone: DEMO_TZ });
}

/** "17:00–20:00" window label. */
export function fmtWindow(startIso: string, endIso: string, lang: Lang = 'en'): string {
  return `${fmtTime(startIso, lang)}–${fmtTime(endIso, lang)}`;
}

/** "Yesterday" / "15 Oct" / "16:12" relative label for inbox items. */
export function fmtRelative(iso: string, now = new Date(), lang: Lang = 'en'): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: DEMO_TZ });
  if (day(d) === day(now)) return fmtTime(iso, lang);
  const y = new Date(now.getTime() - 86400000);
  if (day(d) === day(y)) return lang === 'nl' ? 'Gisteren' : 'Yesterday';
  return fmtDate(iso, { day: 'numeric', month: 'short' }, lang);
}

export function minutesUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));
}

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

/** Calendar fields of an instant in Dutch local time. */
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

export function greetingKey(d: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = zoned(d).hour;
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}
