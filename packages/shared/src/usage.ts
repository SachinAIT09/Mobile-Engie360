/**
 * ENGIE household usage model: smart-meter history (electricity + gas), the dynamic hourly price and the
 * Net2Grid appliance breakdown. Deterministic per customer (seeded) and relative to "now", so the charts,
 * the API totals and the assistant's answers always agree.
 */
import type { Text } from './i18n';
import { dayKey, weekdayOf, zoned } from './format';

export type UsagePeriod = 'hour' | 'day' | 'week' | 'month';

export interface UsagePoint {
  key: string;
  label: Text;
  /** kWh */
  electricity: number;
  /** m³ */
  gas: number;
  prevElectricity: number;
  prevGas: number;
  /** Dynamic electricity price € / kWh incl. taxes (hour view only). */
  price: number | null;
  /** kWh of EV charging inside `electricity`. */
  ev: number;
  /** True for the current, still running period. */
  forecast: boolean;
}

export type ApplianceKey = 'ev' | 'heatpump' | 'always' | 'laundry' | 'cooking' | 'media' | 'fridge' | 'light' | 'other';

export interface BreakdownItem {
  key: ApplianceKey;
  label: Text;
  kwh: number;
}

/** Inputs that make one household different from another. */
export interface UsageProfile {
  seed: number;
  /** Multiplier on the reference household (3 people, terraced house): 1 = ~3,000 kWh / 1,050 m³ a year. */
  elecScale: number;
  gasScale: number;
  /** When the EV started charging at home (ISO), or null for no EV. */
  evSince: string | null;
  /** € / kWh, € / m³ incl. VAT and energy tax, and fixed costs per month. */
  elecPrice: number;
  gasPrice: number;
  fixedPerMonth: number;
}

export const APPLIANCE_LABELS: Record<ApplianceKey, Text> = {
  ev: { en: 'EV charging', nl: 'Elektrische auto laden' },
  heatpump: { en: 'Heat pump', nl: 'Warmtepomp' },
  always: { en: 'Always-on', nl: 'Sluipverbruik' },
  laundry: { en: 'Laundry & drying', nl: 'Wassen & drogen' },
  cooking: { en: 'Cooking', nl: 'Koken' },
  media: { en: 'Entertainment & IT', nl: 'Entertainment & IT' },
  fridge: { en: 'Refrigeration', nl: 'Koelen & vriezen' },
  light: { en: 'Lighting', nl: 'Verlichting' },
  other: { en: 'Other', nl: 'Overig' },
};

export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_LONG_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

/** Reference household, by calendar month (Jan … Dec), without EV. */
const ELEC_BY_MONTH = [338, 296, 281, 236, 212, 196, 201, 198, 222, 229, 300, 335];
const GAS_BY_MONTH = [184, 158, 121, 72, 38, 22, 18, 19, 31, 76, 128, 171];
/** EV charging kWh in a full month. */
const EV_PER_MONTH = 78;
/** EV charging evenings (weekday numbers) and kWh per session. */
const EV_DAYS = [0, 1, 3, 5];

/** Dynamic all-in electricity price by hour (€ / kWh): cheap at night and midday, expensive at the evening peak. */
export const DYNAMIC_PRICE = [
  0.22, 0.21, 0.2, 0.19, 0.19, 0.2, 0.24, 0.31, 0.33, 0.28, 0.24, 0.2, 0.18, 0.17, 0.18, 0.22, 0.27, 0.34, 0.39, 0.38, 0.33,
  0.29, 0.26, 0.24,
];
const BASE_HOURLY = [
  0.24, 0.22, 0.21, 0.21, 0.22, 0.23, 0.38, 0.62, 0.58, 0.44, 0.39, 0.42, 0.51, 0.4, 0.36, 0.38, 0.47, 0.82, 0.96, 0.88, 0.72,
  0.61, 0.44, 0.31,
];
const GAS_HOURLY = [
  0.05, 0.04, 0.04, 0.04, 0.05, 0.12, 0.42, 0.58, 0.44, 0.26, 0.18, 0.16, 0.15, 0.14, 0.15, 0.2, 0.31, 0.42, 0.46, 0.44, 0.38,
  0.3, 0.18, 0.08,
];
/** Net2Grid share of non-EV electricity per appliance group. */
const APPLIANCE_SHARE: [ApplianceKey, number][] = [
  ['always', 0.215],
  ['laundry', 0.162],
  ['cooking', 0.149],
  ['media', 0.136],
  ['fridge', 0.127],
  ['light', 0.1],
  ['other', 0.111],
];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/** Dynamic price for a local hour (0–23). */
export function priceAt(hour: number): number {
  return DYNAMIC_PRICE[((Math.floor(hour) % 24) + 24) % 24] as number;
}

/** Tomorrow's day-ahead prices (published around 13:00): slightly cheaper nights, pricier peak. */
export function tomorrowPrices(): { hour: number; price: number }[] {
  return DYNAMIC_PRICE.map((p, h) => ({ hour: h, price: round(p + (h >= 1 && h <= 5 ? -0.02 : h >= 17 && h <= 20 ? 0.02 : 0), 3) }));
}

function evShareOfMonth(year: number, month: number, evSince: string | null): number {
  if (!evSince) return 0;
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1);
  const since = new Date(evSince).getTime();
  if (since >= end) return 0;
  if (since <= start) return 1;
  return (end - since) / (end - start);
}

function evOnDay(key: string, evSince: string | null): boolean {
  return !!evSince && key >= evSince.slice(0, 10) && EV_DAYS.includes(weekdayOf(key));
}

function monthLabel(m: number, year: number): Text {
  return { en: `${MONTHS_EN[m - 1]} ${String(year).slice(2)}`, nl: `${MONTHS_NL[m - 1]} ${String(year).slice(2)}` };
}

/** The last 12 complete months, oldest first. */
export function monthlyUsage(p: UsageProfile, now: Date): UsagePoint[] {
  const z = zoned(now);
  const r = rng(p.seed * 31 + 7);
  const out: UsagePoint[] = [];
  for (let back = 12; back >= 1; back--) {
    const d = new Date(Date.UTC(z.year, z.month - 1 - back, 1));
    const year = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const noise = 0.96 + r() * 0.08;
    const base = (ELEC_BY_MONTH[m - 1] as number) * p.elecScale * noise;
    const ev = round(EV_PER_MONTH * evShareOfMonth(year, m, p.evSince), 0);
    const gas = (GAS_BY_MONTH[m - 1] as number) * p.gasScale * (0.95 + r() * 0.1);
    out.push({
      key: `${year}-${String(m).padStart(2, '0')}`,
      label: monthLabel(m, year),
      electricity: round(base + ev, 0),
      gas: round(gas, 0),
      prevElectricity: round(base * (0.95 + r() * 0.06), 0),
      prevGas: round(gas * (1.03 + r() * 0.06), 0),
      price: null,
      ev,
      forecast: false,
    });
  }
  return out;
}

/** The last 30 days up to and including today (today is partial). */
export function dailyUsage(p: UsageProfile, now: Date): UsagePoint[] {
  const z = zoned(now);
  const r = rng(p.seed * 17 + 1116);
  const dayShare = Math.max(0.15, (z.hour + z.minute / 60) / 24);
  const out: UsagePoint[] = [];
  for (let back = 29; back >= 0; back--) {
    const key = dayKey(z.year, z.month, z.day, -back);
    const [, mm, dd] = key.split('-').map(Number) as [number, number, number];
    const dow = weekdayOf(key);
    const season = (GAS_BY_MONTH[mm - 1] as number) / 100;
    const weekend = dow === 0 || dow === 6;
    const ev = evOnDay(key, p.evSince) ? round(6.8 + r() * 2.4) : 0;
    let elec = (8.4 + r() * 2.2 + (weekend ? 1.4 : 0)) * p.elecScale + ev;
    let gas = (1.2 + season * 2.4 + r() * 1.1 + (weekend ? 0.6 : 0)) * p.gasScale;
    // Unusual night-time consumption five days ago (the anomaly shown in the insights).
    if (back === 5) elec += 3.6;
    const isToday = back === 0;
    if (isToday) {
      elec *= dayShare;
      gas *= dayShare;
    }
    out.push({
      key,
      label: { en: `${DAYS_EN[dow]} ${dd} ${MONTHS_EN[mm - 1]}`, nl: `${DAYS_NL[dow]} ${dd} ${MONTHS_NL[mm - 1]}` },
      electricity: round(elec),
      gas: round(gas),
      prevElectricity: round((9.1 + r() * 2) * p.elecScale),
      prevGas: round((1.4 + season * 2.3 + r()) * p.gasScale),
      price: null,
      ev: isToday ? 0 : ev,
      forecast: isToday,
    });
  }
  return out;
}

/** The last 12 ISO-style weeks (7-day blocks ending today), the current one partial. */
export function weeklyUsage(p: UsageProfile, now: Date): UsagePoint[] {
  // The four most recent weeks are summed from the daily series so both views agree.
  const days = dailyUsage(p, now);
  const z = zoned(now);
  const r = rng(p.seed * 13 + 4242);
  const out: UsagePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const endKey = dayKey(z.year, z.month, z.day, -i * 7);
    const startKey = dayKey(z.year, z.month, z.day, -i * 7 - 6);
    const [, mm] = startKey.split('-').map(Number) as [number, number];
    const season = (GAS_BY_MONTH[mm - 1] as number) / 100;
    let ev = 0;
    for (let d = 0; d < 7; d++) {
      const k = dayKey(z.year, z.month, z.day, -i * 7 - d);
      if (evOnDay(k, p.evSince)) ev += 7.6;
    }
    const recent = i < 4 ? days.slice(23 - i * 7, 30 - i * 7) : null;
    if (recent) ev = recent.reduce((s, x) => s + x.ev, 0);
    const elec = recent ? recent.reduce((s, x) => s + x.electricity, 0) : (62 + r() * 6) * p.elecScale + ev;
    const gas = recent ? recent.reduce((s, x) => s + x.gas, 0) : (8 + season * 17 + r() * 4) * p.gasScale;
    const [, , ed] = endKey.split('-').map(Number) as [number, number, number];
    const [, em] = endKey.split('-').map(Number) as [number, number];
    out.push({
      key: `w-${endKey}`,
      label: { en: `to ${ed} ${MONTHS_EN[em - 1]}`, nl: `t/m ${ed} ${MONTHS_NL[em - 1]}` },
      electricity: round(elec),
      gas: round(gas),
      prevElectricity: round((61 + r() * 5) * p.elecScale),
      prevGas: round((9 + season * 18 + r() * 4) * p.gasScale),
      price: null,
      ev: round(ev),
      forecast: i === 0,
    });
  }
  return out;
}

/** Yesterday, hour by hour, with the dynamic price. */
export function hourlyUsage(p: UsageProfile, now: Date): UsagePoint[] {
  const z = zoned(now);
  const yesterday = dayKey(z.year, z.month, z.day, -1);
  const evNight = evOnDay(yesterday, p.evSince);
  return BASE_HOURLY.map((b, h) => {
    const ev = evNight && h >= 18 && h <= 20 ? [3.1, 3.4, 2.2][h - 18] as number : 0;
    const base = b * p.elecScale;
    const gas = (GAS_HOURLY[h] as number) * p.gasScale;
    return {
      key: `h${h}`,
      label: { en: `${String(h).padStart(2, '0')}:00`, nl: `${String(h).padStart(2, '0')}:00` },
      electricity: round(base + ev, 2),
      gas: round(gas, 2),
      prevElectricity: round(base * 0.97, 2),
      prevGas: round(gas * 0.92, 2),
      price: DYNAMIC_PRICE[h] as number,
      ev,
      forecast: false,
    };
  });
}

export function usageSeries(p: UsageProfile, period: UsagePeriod, now: Date): UsagePoint[] {
  switch (period) {
    case 'hour':
      return hourlyUsage(p, now);
    case 'day':
      return dailyUsage(p, now);
    case 'week':
      return weeklyUsage(p, now);
    default:
      return monthlyUsage(p, now);
  }
}

export function costOf(p: UsageProfile, kwh: number, m3: number, months = 1): number {
  return kwh * p.elecPrice + m3 * p.gasPrice + p.fixedPerMonth * months;
}

/** Net2Grid appliance breakdown for last month. Sums to that month's electricity. */
export function applianceBreakdown(p: UsageProfile, now: Date, hasHeatPump = false): BreakdownItem[] {
  const last = monthlyUsage(p, now)[11] as UsagePoint;
  const nonEv = last.electricity - last.ev;
  const heat = hasHeatPump ? round(nonEv * 0.28, 0) : 0;
  const rest = nonEv - heat;
  const items: BreakdownItem[] = [];
  if (last.ev > 0) items.push({ key: 'ev', label: APPLIANCE_LABELS.ev, kwh: last.ev });
  if (heat > 0) items.push({ key: 'heatpump', label: APPLIANCE_LABELS.heatpump, kwh: heat });
  for (const [k, share] of APPLIANCE_SHARE) items.push({ key: k, label: APPLIANCE_LABELS[k], kwh: round(rest * share, 0) });
  return items.sort((a, b) => b.kwh - a.kwh);
}

export interface MonthSummary {
  label: Text;
  electricity: number;
  gas: number;
  ev: number;
  cost: number;
  prevCost: number;
  /** Electricity vs the month before, %. */
  elecVsPrevMonthPct: number;
  elecVsLastYearPct: number;
  gasVsLastYearPct: number;
}

export function lastMonthSummary(p: UsageProfile, now: Date): MonthSummary {
  const months = monthlyUsage(p, now);
  const last = months[11] as UsagePoint;
  const prev = months[10] as UsagePoint;
  const pct = (a: number, b: number) => Math.round(((a - b) / Math.max(1, b)) * 100);
  const [y, m] = last.key.split('-').map(Number) as [number, number];
  return {
    label: { en: `${MONTHS_LONG_EN[m - 1]} ${y}`, nl: `${MONTHS_LONG_NL[m - 1]} ${y}` },
    electricity: last.electricity,
    gas: last.gas,
    ev: last.ev,
    cost: round(costOf(p, last.electricity, last.gas), 2),
    prevCost: round(costOf(p, prev.electricity, prev.gas), 2),
    elecVsPrevMonthPct: pct(last.electricity, prev.electricity),
    elecVsLastYearPct: pct(last.electricity, last.prevElectricity),
    gasVsLastYearPct: pct(last.gas, last.prevGas),
  };
}

export interface ThisMonth {
  label: Text;
  daysElapsed: number;
  daysInMonth: number;
  electricity: number;
  gas: number;
  forecastElectricity: number;
  forecastGas: number;
  prevElectricity: number;
  prevGas: number;
  costSoFar: number;
  forecastCost: number;
}

/** Month to date, with a straight-line forecast to the end of the month. */
export function thisMonth(p: UsageProfile, now: Date): ThisMonth {
  const z = zoned(now);
  const daysInMonth = new Date(Date.UTC(z.year, z.month, 0)).getUTCDate();
  const days = dailyUsage(p, now).filter((d) => d.key.startsWith(`${z.year}-${String(z.month).padStart(2, '0')}`));
  const sum = (k: 'electricity' | 'gas' | 'prevElectricity' | 'prevGas') => days.reduce((s, d) => s + d[k], 0);
  const elapsed = z.day - 1 + (z.hour + z.minute / 60) / 24;
  const factor = daysInMonth / Math.max(0.5, elapsed);
  const electricity = round(sum('electricity'), 0);
  const gas = round(sum('gas'), 0);
  return {
    label: { en: `${MONTHS_LONG_EN[z.month - 1]} ${z.year}`, nl: `${MONTHS_LONG_NL[z.month - 1]} ${z.year}` },
    daysElapsed: z.day,
    daysInMonth,
    electricity,
    gas,
    forecastElectricity: round(electricity * factor, 0),
    forecastGas: round(gas * factor, 0),
    prevElectricity: round(sum('prevElectricity'), 0),
    prevGas: round(sum('prevGas'), 0),
    costSoFar: round(costOf(p, electricity, gas, elapsed / daysInMonth), 2),
    forecastCost: round(costOf(p, electricity * factor, gas * factor), 2),
  };
}

/** Peak (07–23 weekdays) vs off-peak share of the last 30 days. */
export function peakSplit(p: UsageProfile, now: Date): { peakPct: number; offPeakPct: number; peakKwh: number; offPeakKwh: number; peakEvPct: number } {
  const total = dailyUsage(p, now).reduce((s, d) => s + d.electricity, 0);
  const hasEv = !!p.evSince;
  const peakPct = hasEv ? 63 : 58;
  return {
    peakPct,
    offPeakPct: 100 - peakPct,
    peakKwh: round((total * peakPct) / 100, 0),
    offPeakKwh: round((total * (100 - peakPct)) / 100, 0),
    peakEvPct: hasEv ? 81 : 0,
  };
}

export function annualUsage(p: UsageProfile, now: Date): { electricityKwh: number; gasM3: number } {
  const m = monthlyUsage(p, now);
  return { electricityKwh: m.reduce((s, x) => s + x.electricity, 0), gasM3: m.reduce((s, x) => s + x.gas, 0) };
}

export const BENCHMARK = { similarHomesKwh: 2780, similarHomesM3: 1110, similarBaseloadW: 150 };

export function baseloadW(p: UsageProfile): number {
  return Math.round(205 * p.elecScale);
}
