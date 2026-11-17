import type { BillingResponse, EnergyResponse, StaffOverview } from '../../shared/contract';

/**
 * Usage and billing for a customer other than the live one: the sample data, scaled to their
 * yearly usage and installment, without the EV share when they have no electric car.
 */
export function scaleEnergy(e: EnergyResponse, k: number, hasEv: boolean): EnergyResponse {
  const n = (v: number) => Math.round(v * k);
  return {
    ...e,
    monthly: e.monthly.map((m) => {
      const ev = hasEv ? n(m.ev ?? 0) : 0;
      return { ...m, electricity: n(m.electricity - (m.ev ?? 0)) + ev, gas: n(m.gas), prevElectricity: m.prevElectricity === undefined ? undefined : n(m.prevElectricity), prevGas: m.prevGas === undefined ? undefined : n(m.prevGas), ev: ev || undefined };
    }),
    breakdown: e.breakdown.filter((b) => hasEv || b.key !== 'ev').map((b) => ({ ...b, kwh: n(b.kwh) })),
    peakSplit: hasEv ? e.peakSplit : { ...e.peakSplit, peakPct: 48, offPeakPct: 52, peakEvPct: 0 },
    benchmark: { ...e.benchmark, baseloadW: n(e.benchmark.baseloadW) },
  };
}

export function scaleBilling(b: BillingResponse, o: StaffOverview): BillingResponse {
  const inst = o.installment.current;
  const estimatedTotal = o.installment.advised * 12;
  return {
    ...b,
    invoices: b.invoices.map((i) => (i.kind === 'installment' ? { ...i, amount: inst } : { ...i, amount: Math.round((i.amount * inst) / 185) })),
    annualOverview: { ...b.annualOverview, paidSoFar: inst * 8, installmentsTotal: inst * 12, estimatedTotal, expectedSettlement: estimatedTotal - inst * 12 },
    installment: o.installment,
  };
}
