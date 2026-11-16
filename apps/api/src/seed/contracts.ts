/**
 * Pure helpers that build an ENGIE energy contract and its invoice history from a household's usage.
 * No I/O, so they can be unit-tested.
 */
import {
  MONTHS_EN,
  MONTHS_NL,
  MONTHS_LONG_EN,
  MONTHS_LONG_NL,
  annualUsage,
  type Contract,
  type InvoiceKind,
  type InvoiceStatus,
  type ProductId,
  type Text,
  type UsageProfile,
} from '@engie/shared';
import { round2 } from '../common/numbers.js';

export interface ProductDef {
  name: Text;
  elecType: Text;
  gasType: (fixedUntil: string | null) => Text;
  elecPrice: number;
  gasPrice: number;
  /** Years the fixed part runs, null when nothing is fixed. */
  fixedYears: number | null;
}

const monthYear = (iso: string): Text => {
  const d = new Date(iso);
  const m = d.getUTCMonth();
  return { en: `${d.getUTCDate()} ${MONTHS_EN[m]} ${d.getUTCFullYear()}`, nl: `${d.getUTCDate()} ${MONTHS_NL[m]} ${d.getUTCFullYear()}` };
};

export const PRODUCTS: Record<ProductId, ProductDef> = {
  DYNAMIC: {
    name: { en: 'Dynamic Electricity & Gas', nl: 'Dynamische Stroom & Gas' },
    elecType: { en: 'Dynamic (hourly price)', nl: 'Dynamisch (uurprijs)' },
    gasType: () => ({ en: 'Dynamic (daily price)', nl: 'Dynamisch (dagprijs)' }),
    elecPrice: 0.25,
    gasPrice: 1.21,
    fixedYears: null,
  },
  DYNAMIC_FIXED_GAS: {
    name: { en: 'Dynamic Electricity & Fixed Gas', nl: 'Dynamische Stroom & Vast Gas' },
    elecType: { en: 'Dynamic (hourly price)', nl: 'Dynamisch (uurprijs)' },
    gasType: (until) => {
      const d = until ? monthYear(until) : { en: '', nl: '' };
      return { en: `Fixed until ${d.en}`, nl: `Vast tot ${d.nl}` };
    },
    elecPrice: 0.25,
    gasPrice: 1.25,
    fixedYears: 2,
  },
  FIXED: {
    name: { en: 'Fixed Electricity & Gas', nl: 'Vaste Stroom & Gas' },
    elecType: { en: 'Fixed price', nl: 'Vaste prijs' },
    gasType: (until) => {
      const d = until ? monthYear(until) : { en: '', nl: '' };
      return { en: `Fixed until ${d.en}`, nl: `Vast tot ${d.nl}` };
    },
    elecPrice: 0.27,
    gasPrice: 1.29,
    fixedYears: 3,
  },
  VARIABLE: {
    name: { en: 'Variable Electricity & Gas', nl: 'Variabele Stroom & Gas' },
    elecType: { en: 'Variable (monthly price)', nl: 'Variabel (maandprijs)' },
    gasType: () => ({ en: 'Variable (monthly price)', nl: 'Variabel (maandprijs)' }),
    elecPrice: 0.28,
    gasPrice: 1.31,
    fixedYears: null,
  },
};

/** Fixed costs per month: supply + network − energy tax reduction. */
export const FIXED_PER_MONTH = 22.8;

export interface ContractInput {
  product: ProductId;
  startDate: string;
  profile: UsageProfile;
  now: Date;
  /** Installment minus the advice in € (negative = paying too little). */
  installmentDelta: number;
  /** Deterministic digits for the EAN codes and meter readings. */
  digits: number;
}

const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** € per year at the contract prices for the last 12 months of usage. */
export function estimatedAnnualCost(p: UsageProfile, now: Date): number {
  const u = annualUsage(p, now);
  return Math.round(u.electricityKwh * p.elecPrice + u.gasM3 * p.gasPrice + p.fixedPerMonth * 12);
}

export function advisedInstallment(annualCost: number): number {
  return roundTo(annualCost / 12, 1);
}

export function buildContract(i: ContractInput): Contract {
  const def = PRODUCTS[i.product];
  const fixedUntil = def.fixedYears
    ? new Date(Date.UTC(new Date(i.startDate).getUTCFullYear() + def.fixedYears, new Date(i.startDate).getUTCMonth(), 1)).toISOString().slice(0, 10)
    : null;
  const annual = annualUsage(i.profile, i.now);
  const cost = estimatedAnnualCost(i.profile, i.now);
  const advised = advisedInstallment(cost);
  const installment = Math.max(40, advised + i.installmentDelta);
  const years = Math.max(1, (i.now.getTime() - new Date(i.startDate).getTime()) / (365 * 86400000));
  const ean = (prefix: string) => `${prefix}${String(i.digits).padStart(6, '0').slice(-6)} ${String(i.digits * 7).slice(-3).padStart(3, '0')} ${String(i.digits * 13).slice(-3).padStart(3, '0')}`;
  return {
    product: i.product,
    productName: def.name,
    startDate: i.startDate,
    fixedUntil,
    electricity: {
      type: def.elecType,
      origin: { en: 'Dutch green electricity', nl: 'Nederlandse groene stroom' },
      avgPrice: def.elecPrice,
      ean: ean('871687120'),
    },
    gas: { type: def.gasType(fixedUntil), price: def.gasPrice, ean: ean('871687140') },
    fixedPerMonth: FIXED_PER_MONTH,
    installment,
    advisedInstallment: advised,
    installmentRange: { min: roundTo(advised * 0.7, 5), max: roundTo(advised * 1.65, 5) },
    pendingInstallment: null,
    pendingFrom: null,
    estimatedAnnualCost: cost,
    annualUsage: annual,
    meter: {
      type: { en: 'Smart meter (DSMR 5.0)', nl: 'Slimme meter (DSMR 5.0)' },
      lastReading: new Date(Math.floor(i.now.getTime() / 3600000) * 3600000).toISOString(),
      electricityT1: Math.round(annual.electricityKwh * 0.52 * (years + 4)),
      electricityT2: Math.round(annual.electricityKwh * 0.48 * (years + 4)),
      gas: Math.round(annual.gasM3 * (years + 6) * 10) / 10,
    },
  };
}

export interface SeedInvoice {
  number: string;
  kind: InvoiceKind;
  period: Text;
  periodKey: string;
  issued: Date;
  due: Date;
  amount: number;
  status: InvoiceStatus;
  paidOn: Date | null;
  lines: { label: Text; amount: number }[];
}

const utc = (y: number, m: number, d: number, h = 9) => new Date(Date.UTC(y, m - 1, d, h));

/** Advance payment split over electricity and gas. */
export function installmentLines(total: number): { label: Text; amount: number }[] {
  const elec = round2(total * 0.39);
  return [
    { label: { en: 'Advance payment electricity', nl: 'Voorschot stroom' }, amount: elec },
    { label: { en: 'Advance payment gas', nl: 'Voorschot gas' }, amount: round2(total - elec) },
  ];
}

/**
 * The last 12 monthly installment invoices (issued on the 14th, collected on the 28th; this month's
 * is SCHEDULED until the 28th) and the annual statement at the last contract anniversary.
 * `previousInstallment` applies before that anniversary.
 */
export function buildInvoiceHistory(c: Contract, customerNo: string, now: Date, previousInstallment: number): SeedInvoice[] {
  const start = new Date(c.startDate);
  const ny = now.getUTCFullYear();
  const nm = now.getUTCMonth() + 1;
  let annYear = ny;
  const annMonth = start.getUTCMonth() + 1;
  if (annMonth > nm) annYear--;
  const anniversary = utc(annYear, annMonth, 1);
  const out: SeedInvoice[] = [];
  const seq = Number(customerNo.replace(/\D/g, '').slice(-5)) || 48213;
  for (let back = 11; back >= 0; back--) {
    const d = new Date(Date.UTC(ny, nm - 1 - back, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const amount = d.getTime() < anniversary.getTime() ? previousInstallment : c.installment;
    const due = utc(y, m, 28);
    const paid = due.getTime() <= now.getTime();
    out.push({
      number: `TN-${y}${String(m).padStart(2, '0')}-${seq + back * 7}`,
      kind: 'INSTALLMENT',
      period: { en: `${MONTHS_LONG_EN[m - 1]} ${y}`, nl: `${MONTHS_LONG_NL[m - 1]} ${y}` },
      periodKey: `${y}-${String(m).padStart(2, '0')}`,
      issued: utc(y, m, 14),
      due,
      amount,
      status: paid ? 'PAID' : 'SCHEDULED',
      paidOn: paid ? due : null,
      lines: installmentLines(amount),
    });
  }
  // Annual statement over the previous contract year, settled two weeks after it was issued.
  const prevStart = new Date(Date.UTC(annYear - 1, annMonth - 1, 1));
  const prevEnd = new Date(Date.UTC(annYear, annMonth - 2, 1));
  const label = (d: Date, lang: 'en' | 'nl') => `${(lang === 'nl' ? MONTHS_NL : MONTHS_EN)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const u = c.annualUsage;
  const elec = round2(u.electricityKwh * 0.88 * c.electricity.avgPrice);
  const gas = round2(u.gasM3 * 1.06 * c.gas.price);
  const fixed = round2(166.8);
  const network = round2(735.6);
  const taxBack = -628.8;
  const advances = -round2(previousInstallment * 12);
  const total = round2(elec + gas + fixed + network + taxBack + advances);
  const issued = utc(annYear, annMonth, 12);
  out.push({
    number: `JN-${annYear}-${String(annMonth).padStart(2, '0')}-${seq % 10000 + 10000}`,
    kind: 'ANNUAL',
    period: { en: `Annual statement ${label(prevStart, 'en')} – ${label(prevEnd, 'en')}`, nl: `Jaarnota ${label(prevStart, 'nl')} – ${label(prevEnd, 'nl')}` },
    periodKey: `${annYear}-${String(annMonth).padStart(2, '0')}-annual`,
    issued,
    due: utc(annYear, annMonth, 26),
    amount: total,
    status: 'PAID',
    paidOn: utc(annYear, annMonth, 24),
    lines: [
      { label: { en: `Electricity ${Math.round(u.electricityKwh * 0.88)} kWh`, nl: `Stroom ${Math.round(u.electricityKwh * 0.88)} kWh` }, amount: elec },
      { label: { en: `Gas ${Math.round(u.gasM3 * 1.06)} m³`, nl: `Gas ${Math.round(u.gasM3 * 1.06)} m³` }, amount: gas },
      { label: { en: 'Fixed delivery costs', nl: 'Vaste leveringskosten' }, amount: fixed },
      { label: { en: 'Network costs', nl: 'Netbeheerkosten' }, amount: network },
      { label: { en: 'Energy tax reduction', nl: 'Vermindering energiebelasting' }, amount: taxBack },
      { label: { en: 'Advance payments received', nl: 'Ontvangen voorschotten' }, amount: advances },
    ],
  });
  return out.sort((a, b) => b.issued.getTime() - a.issued.getTime());
}
