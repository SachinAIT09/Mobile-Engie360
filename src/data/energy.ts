/**
 * Mock smart-meter + Net2Grid disaggregation data for the demo household.
 * Deterministic (seeded) so the charts and the assistant's answers always match.
 */
import type { Text } from '../lib/i18n';
import { contract } from './customer';
import { DEMO_NOW, dayKey, weekdayOf, zoned } from '../lib/time';

export type Period = 'hour' | 'day' | 'week' | 'month';

export interface UsagePoint {
  key: string; // ISO date or hour key
  label: Text;
  electricity: number; // kWh
  gas: number; // m³
  prevElectricity?: number;
  prevGas?: number;
  /** Dynamic electricity price € / kWh (hourly view only). */
  price?: number;
  /** kWh of EV charging inside `electricity`. */
  ev?: number;
  forecast?: boolean;
}

function rng(seed: number) {
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

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_NL = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

/* ---------------------------------------------------------------- months */
// Nov 2025 … Oct 2026 (last 12 complete months) and the same months a year earlier.
const ELEC_12 = [305, 342, 338, 296, 281, 236, 212, 196, 201, 207, 274, 307];
const ELEC_PREV = [298, 329, 331, 290, 272, 229, 204, 190, 194, 199, 214, 262];
const GAS_12 = [128, 171, 184, 158, 121, 72, 38, 22, 18, 19, 31, 76];
const GAS_PREV = [135, 178, 192, 169, 133, 80, 41, 24, 19, 21, 36, 84];
// EV charging (detected by Net2Grid from late Aug 2026).
const EV_12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 52, 78];

export const monthly: UsagePoint[] = ELEC_12.map((e, i) => {
  const m = (10 + i) % 12; // starts at Nov
  const year = i < 2 ? 2025 : 2026;
  return {
    key: `${year}-${String(m + 1).padStart(2, '0')}`,
    label: { en: `${MONTHS_EN[m]} ${String(year).slice(2)}`, nl: `${MONTHS_NL[m]} ${String(year).slice(2)}` },
    electricity: e,
    gas: GAS_12[i] as number,
    prevElectricity: ELEC_PREV[i],
    prevGas: GAS_PREV[i],
    ev: EV_12[i],
  };
});

/* ------------------------------------------------------------------ days */
// Last 30 days up to and including today (today is partial). EV charges Mon/Wed/Fri/Sun evenings.
export const daily: UsagePoint[] = (() => {
  const r = rng(1116);
  const out: UsagePoint[] = [];
  const today = zoned(DEMO_NOW);
  for (let back = 29; back >= 0; back--) {
    const key = dayKey(today.year, today.month, today.day, -back);
    const [, mm, dd] = key.split('-').map(Number) as [number, number, number];
    const dow = weekdayOf(key);
    const coldness = (30 - back) / 30; // getting colder towards mid-November
    const weekend = dow === 0 || dow === 6;
    const ev = [0, 1, 3, 5].includes(dow) ? round(6.8 + r() * 2.4) : 0;
    let elec = 8.4 + r() * 2.2 + (weekend ? 1.4 : 0) + ev;
    let gas = 3.1 + coldness * 2.6 + r() * 1.1 + (weekend ? 0.6 : 0);
    // Unusual night-time consumption on 11 Nov (anomaly in the insights).
    if (dd === 11 && mm === 11) elec += 3.6;
    const isToday = back === 0;
    if (isToday) {
      elec *= 0.58;
      gas *= 0.55;
    }
    out.push({
      key,
      label: {
        en: `${DAYS_EN[dow]} ${dd} ${MONTHS_EN[mm - 1]}`,
        nl: `${DAYS_NL[dow]} ${dd} ${MONTHS_NL[mm - 1]}`,
      },
      electricity: round(elec),
      gas: round(gas),
      ev: isToday ? 0 : ev,
      prevElectricity: round(9.1 + r() * 2),
      prevGas: round(3.4 + coldness * 2.4 + r() * 1),
      forecast: isToday,
    });
  }
  return out;
})();

/* ----------------------------------------------------------------- weeks */
export const weekly: UsagePoint[] = (() => {
  const r = rng(4242);
  const out: UsagePoint[] = [];
  const startWeek = 35;
  for (let i = 0; i < 12; i++) {
    const wk = startWeek + i;
    const evOn = wk >= 36;
    const cold = i / 11;
    out.push({
      key: `2026-W${wk}`,
      label: { en: `Wk ${wk}`, nl: `Wk ${wk}` },
      electricity: round(47 + r() * 6 + cold * 12 + (evOn ? 15 + r() * 6 : 0)),
      gas: round(5 + cold * 31 + r() * 4),
      prevElectricity: round(46 + r() * 5 + cold * 11),
      prevGas: round(6 + cold * 33 + r() * 4),
      ev: evOn ? round(15 + r() * 6) : 0,
      forecast: i === 11,
    });
  }
  return out;
})();

/* ----------------------------------------------------------------- hours */
// Yesterday (Sun 15 Nov), full 24 h with the dynamic hourly price.
const PRICE = [
  0.22, 0.21, 0.2, 0.19, 0.19, 0.2, 0.24, 0.31, 0.33, 0.28, 0.24, 0.2, 0.18, 0.17, 0.18, 0.22, 0.27, 0.34, 0.39,
  0.38, 0.33, 0.29, 0.26, 0.24,
];
const BASE = [
  0.24, 0.22, 0.21, 0.21, 0.22, 0.23, 0.38, 0.62, 0.58, 0.44, 0.39, 0.42, 0.51, 0.4, 0.36, 0.38, 0.47, 0.82,
  0.96, 0.88, 0.72, 0.61, 0.44, 0.31,
];
const EV_HOURS: Record<number, number> = { 18: 3.1, 19: 3.4, 20: 2.2 };
const GAS_H = [
  0.05, 0.04, 0.04, 0.04, 0.05, 0.12, 0.42, 0.58, 0.44, 0.26, 0.18, 0.16, 0.15, 0.14, 0.15, 0.2, 0.31, 0.42, 0.46,
  0.44, 0.38, 0.3, 0.18, 0.08,
];
export const hourly: UsagePoint[] = BASE.map((b, h) => {
  const ev = EV_HOURS[h] ?? 0;
  return {
    key: `h${h}`,
    label: { en: `${String(h).padStart(2, '0')}:00`, nl: `${String(h).padStart(2, '0')}:00` },
    electricity: round(b + ev, 2),
    gas: GAS_H[h] as number,
    prevElectricity: round(b * 0.97, 2),
    prevGas: round((GAS_H[h] as number) * 0.92, 2),
    price: PRICE[h],
    ev,
  };
});

/** Tomorrow's dynamic prices (published day-ahead) — used by smart charging. */
export const tomorrowPrices: { hour: number; price: number }[] = PRICE.map((p, h) => ({
  hour: h,
  price: round(p + (h >= 1 && h <= 5 ? -0.02 : h >= 17 && h <= 20 ? 0.02 : 0), 3),
}));

export function series(p: Period): UsagePoint[] {
  return p === 'hour' ? hourly : p === 'day' ? daily : p === 'week' ? weekly : monthly;
}

/* -------------------------------------------------------------- summaries */
export const costOf = (kwh: number, m3: number, months = 1) =>
  kwh * contract.electricity.avgPrice + m3 * contract.gas.price + contract.fixedPerMonth * months;

const lastMonth = monthly[11] as UsagePoint; // Oct 26
const prevMonth = monthly[10] as UsagePoint; // Sep 26

export const thisMonth = {
  label: { en: 'November 2026', nl: 'november 2026' } as Text,
  daysElapsed: 16,
  daysInMonth: 30,
  electricity: 171,
  gas: 79,
  forecastElectricity: 335,
  forecastGas: 152,
  /** Same period (1–16 Nov) last year. */
  prevElectricity: 158,
  prevGas: 86,
  get costSoFar() {
    return costOf(this.electricity, this.gas, this.daysElapsed / this.daysInMonth);
  },
  get forecastCost() {
    return costOf(this.forecastElectricity, this.forecastGas);
  },
};

export const lastMonthSummary = {
  label: { en: 'October 2026', nl: 'oktober 2026' } as Text,
  electricity: lastMonth.electricity,
  gas: lastMonth.gas,
  ev: lastMonth.ev ?? 0,
  elecVsPrevMonthPct: Math.round(((lastMonth.electricity - prevMonth.electricity) / prevMonth.electricity) * 100), // 12
  elecVsLastYearPct: Math.round(
    ((lastMonth.electricity - (lastMonth.prevElectricity ?? 1)) / (lastMonth.prevElectricity ?? 1)) * 100,
  ),
  gasVsLastYearPct: Math.round(((lastMonth.gas - (lastMonth.prevGas ?? 1)) / (lastMonth.prevGas ?? 1)) * 100),
  cost: costOf(lastMonth.electricity, lastMonth.gas),
  prevCost: costOf(prevMonth.electricity, prevMonth.gas),
};

/** Peak (07–23 weekdays) vs off-peak share, last 30 days. */
export const peakSplit = { peakPct: 63, offPeakPct: 37, peakKwh: 214, offPeakKwh: 126, peakEvPct: 81 };

export interface BreakdownItem {
  key: string;
  label: Text;
  kwh: number;
  color: string;
}
/** Net2Grid appliance-level disaggregation for October 2026 (sums to 307 kWh). */
export const breakdown: BreakdownItem[] = [
  { key: 'ev', label: { en: 'EV charging', nl: 'Elektrische auto laden' }, kwh: 78, color: '#7b61ff' },
  { key: 'always', label: { en: 'Always-on', nl: 'Sluipverbruik' }, kwh: 49, color: '#5a7090' },
  { key: 'laundry', label: { en: 'Laundry & drying', nl: 'Wassen & drogen' }, kwh: 37, color: '#00aaff' },
  { key: 'cooking', label: { en: 'Cooking', nl: 'Koken' }, kwh: 34, color: '#ff8a3d' },
  { key: 'media', label: { en: 'Entertainment & IT', nl: 'Entertainment & IT' }, kwh: 31, color: '#23d2b5' },
  { key: 'fridge', label: { en: 'Refrigeration', nl: 'Koelen & vriezen' }, kwh: 29, color: '#5bc8ff' },
  { key: 'light', label: { en: 'Lighting', nl: 'Verlichting' }, kwh: 23, color: '#ffc845' },
  { key: 'other', label: { en: 'Other', nl: 'Overig' }, kwh: 26, color: '#b6c2cf' },
];

export const benchmark = {
  similarHomesKwh: 2780,
  similarHomesM3: 1110,
  baseloadW: 205,
  similarBaseloadW: 150,
};
