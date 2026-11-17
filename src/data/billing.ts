/** Mock invoices and payments. Swap for a billing API later; shapes are what the UI needs. */
import type { Text } from '../lib/i18n';

export type InvoiceKind = 'installment' | 'annual';
export type InvoiceStatus = 'paid' | 'open' | 'scheduled';

export interface InvoiceLine {
  label: Text;
  amount: number;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  period: Text;
  issued: string;
  due: string;
  amount: number;
  status: InvoiceStatus;
  paidOn?: string;
  lines: InvoiceLine[];
}

const MONTHS: [Text, string][] = [
  [{ en: 'December 2025', nl: 'december 2025' }, '2025-12'],
  [{ en: 'January 2026', nl: 'januari 2026' }, '2026-01'],
  [{ en: 'February 2026', nl: 'februari 2026' }, '2026-02'],
  [{ en: 'March 2026', nl: 'maart 2026' }, '2026-03'],
  [{ en: 'April 2026', nl: 'april 2026' }, '2026-04'],
  [{ en: 'May 2026', nl: 'mei 2026' }, '2026-05'],
  [{ en: 'June 2026', nl: 'juni 2026' }, '2026-06'],
  [{ en: 'July 2026', nl: 'juli 2026' }, '2026-07'],
  [{ en: 'August 2026', nl: 'augustus 2026' }, '2026-08'],
  [{ en: 'September 2026', nl: 'september 2026' }, '2026-09'],
  [{ en: 'October 2026', nl: 'oktober 2026' }, '2026-10'],
  [{ en: 'November 2026', nl: 'november 2026' }, '2026-11'],
];

function installmentLines(total: number): InvoiceLine[] {
  const elec = Math.round(total * 0.39 * 100) / 100;
  const gas = Math.round((total - elec) * 100) / 100;
  return [
    { label: { en: 'Advance payment electricity', nl: 'Voorschot stroom' }, amount: elec },
    { label: { en: 'Advance payment gas', nl: 'Voorschot gas' }, amount: gas },
  ];
}

const installments: Invoice[] = MONTHS.map(([period, ym], i) => {
  const amount = i < 3 ? 172 : 185; // raised after the annual statement in March 2026
  const isCurrent = i === MONTHS.length - 1;
  return {
    id: `TN-${ym.replace('-', '')}-${48213 + i * 7}`,
    kind: 'installment',
    period,
    issued: `${ym}-14`,
    due: `${ym}-28`,
    amount,
    status: isCurrent ? 'scheduled' : 'paid',
    paidOn: isCurrent ? undefined : `${ym}-28`,
    lines: installmentLines(amount),
  };
});

const annual: Invoice = {
  id: 'JN-2026-03-10422',
  kind: 'annual',
  period: { en: 'Annual statement Mar 2025 – Feb 2026', nl: 'Jaarnota mrt 2025 – feb 2026' },
  issued: '2026-03-12',
  due: '2026-03-26',
  amount: 64.18,
  status: 'paid',
  paidOn: '2026-03-24',
  lines: [
    { label: { en: 'Electricity 2,812 kWh', nl: 'Stroom 2.812 kWh' }, amount: 703.0 },
    { label: { en: 'Gas 1,104 m³', nl: 'Gas 1.104 m³' }, amount: 1380.0 },
    { label: { en: 'Fixed delivery costs', nl: 'Vaste leveringskosten' }, amount: 166.8 },
    { label: { en: 'Network costs', nl: 'Netbeheerkosten' }, amount: 735.6 },
    { label: { en: 'Energy tax reduction', nl: 'Vermindering energiebelasting' }, amount: -628.8 },
    { label: { en: 'Advance payments received', nl: 'Ontvangen voorschotten' }, amount: -2292.42 },
  ],
};

export const invoices: Invoice[] = [...installments, annual].sort((a, b) => b.issued.localeCompare(a.issued));

export const outstanding = invoices.filter((i) => i.status !== 'paid');

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: Text;
  invoiceId: string;
  status: 'success';
}

export const payments: Payment[] = invoices
  .filter((i) => i.status === 'paid' && i.paidOn)
  .map((i, n) => ({
    id: `PAY-${90311 + n}`,
    date: i.paidOn as string,
    amount: i.amount,
    method: { en: 'Direct debit', nl: 'Automatische incasso' },
    invoiceId: i.id,
    status: 'success' as const,
  }));

/** The customer's own payment choices; the server keeps them, the app falls back to these without a server. */
export interface PayChoices {
  autopay: boolean;
  paid: Payment[];
}

export const PAY_DEFAULTS: PayChoices = { autopay: true, paid: [] };

/**
 * Invoices and payments as the customer sees them: an invoice paid in the app is "paid", and one that is
 * still due is "scheduled" with automatic payment on and "open" with it off. Used by the server and the app.
 */
export function withPayments(pay: PayChoices): { invoices: Invoice[]; payments: Payment[]; outstanding: Invoice[] } {
  const list = invoices.map((inv): Invoice => {
    if (inv.status === 'paid') return inv;
    const p = pay.paid.find((x) => x.invoiceId === inv.id);
    if (p) return { ...inv, status: 'paid', paidOn: p.date };
    return { ...inv, status: pay.autopay ? 'scheduled' : 'open' };
  });
  return { invoices: list, payments: [...pay.paid, ...payments], outstanding: list.filter((i) => i.status !== 'paid') };
}

/** Annual cost overview (contract year Mar 2026 – Feb 2027) as monthly estimate vs advance paid. */
export const annualOverview = {
  year: { en: 'Contract year Mar 2026 – Feb 2027', nl: 'Contractjaar mrt 2026 – feb 2027' } as Text,
  paidSoFar: 185 * 8,
  estimatedTotal: 2376,
  installmentsTotal: 185 * 12,
  /** Expected settlement at the annual statement if the installment stays the same. */
  expectedSettlement: 2376 - 185 * 12, // +156 to pay
};
