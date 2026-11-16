import { describe, expect, it } from 'vitest';
import type { Contract, InvoiceKind, InvoiceStatus, UsageProfile } from '@engie/shared';
import { buildContract, buildInvoiceHistory } from '../seed/contracts.js';
import { COLLECTION_DAY, annualOverview, nextCollection } from './billing.service.js';

// Pure helpers exported next to BillingService; the service itself (Nest DI, database) is never instantiated here.

const NOW = new Date('2026-11-16T13:20:00Z');
const PROFILE: UsageProfile = { seed: 1, elecScale: 1, gasScale: 1, evSince: '2026-08-25T00:00:00Z', elecPrice: 0.25, gasPrice: 1.25, fixedPerMonth: 22.8 };
const contractOf = (delta: number, startDate = '2025-03-01'): Contract => buildContract({ product: 'DYNAMIC_FIXED_GAS', startDate, profile: PROFILE, now: NOW, installmentDelta: delta, digits: 48213 });
const inv = (issued: string, amount: number, status: InvoiceStatus = 'PAID', kind: InvoiceKind = 'INSTALLMENT') => ({ kind, status, issued: new Date(issued), amount });

describe('nextCollection', () => {
  it('is the 28th of this month while that is still ahead', () => {
    expect(COLLECTION_DAY).toBe(28);
    expect(nextCollection(NOW).toISOString()).toBe('2026-11-28T09:00:00.000Z');
    expect(nextCollection(new Date('2026-11-01T00:00:00Z')).toISOString()).toBe('2026-11-28T09:00:00.000Z');
    expect(nextCollection(new Date('2026-11-28T08:59:59Z')).toISOString()).toBe('2026-11-28T09:00:00.000Z');
  });

  it('moves to next month once the 28th has passed', () => {
    expect(nextCollection(new Date('2026-11-28T09:00:00Z')).toISOString()).toBe('2026-12-28T09:00:00.000Z');
    expect(nextCollection(new Date('2026-11-30T12:00:00Z')).toISOString()).toBe('2026-12-28T09:00:00.000Z');
    expect(nextCollection(new Date('2026-02-28T12:00:00Z')).toISOString()).toBe('2026-03-28T09:00:00.000Z');
  });

  it('rolls over the year in December', () => {
    expect(nextCollection(new Date('2026-12-27T12:00:00Z')).toISOString()).toBe('2026-12-28T09:00:00.000Z');
    expect(nextCollection(new Date('2026-12-29T12:00:00Z')).toISOString()).toBe('2027-01-28T09:00:00.000Z');
  });
});

describe('annualOverview', () => {
  it('counts PAID installments since the contract anniversary', () => {
    const contract = contractOf(-25);
    const invoices = [
      inv('2026-11-14T09:00:00Z', contract.installment, 'SCHEDULED'), // not collected yet
      inv('2026-10-14T09:00:00Z', 180),
      inv('2026-09-14T09:00:00Z', 180),
      inv('2026-03-14T09:00:00Z', 170.5),
      inv('2026-03-12T09:00:00Z', 412.3, 'PAID', 'ANNUAL'), // not an installment
      inv('2026-02-14T09:00:00Z', 160), // previous contract year
      inv('2026-04-14T09:00:00Z', 180, 'OPEN'), // unpaid
    ];
    const a = annualOverview({ contract }, invoices, NOW);
    expect(a.monthsPaid).toBe(3);
    expect(a.paidSoFar).toBe(530.5);
    expect(a.year).toEqual({ en: 'Contract year Mar 2026 – Feb 2027', nl: 'Contractjaar mrt 2026 – feb 2027' });
    expect(a.estimatedTotal).toBe(contract.estimatedAnnualCost);
    expect(a.installmentsTotal).toBe(530.5 + 9 * contract.installment);
  });

  it('expectedSettlement is the estimated total minus the installments of the year', () => {
    const contract = contractOf(-25);
    const a = annualOverview({ contract }, buildInvoiceHistory(contract, 'K-48213', NOW, contract.installment), NOW);
    // March–October are paid; November is scheduled.
    expect(a.monthsPaid).toBe(8);
    expect(a.paidSoFar).toBe(8 * contract.installment);
    expect(a.installmentsTotal).toBe(12 * contract.installment);
    expect(a.expectedSettlement).toBe(a.estimatedTotal - a.installmentsTotal);
    expect(a.expectedSettlement).toBeCloseTo(contract.estimatedAnnualCost - 12 * contract.installment, 2);
    expect(a.expectedSettlement).toBeGreaterThan(0);
  });

  it('settlementWithAdvised is lower when the advice is higher than the installment', () => {
    const contract = contractOf(-25);
    const a = annualOverview({ contract }, buildInvoiceHistory(contract, 'K-48213', NOW, contract.installment), NOW);
    expect(contract.advisedInstallment).toBeGreaterThan(contract.installment);
    expect(a.settlementWithAdvised).toBeLessThan(a.expectedSettlement);
    // Four collections remain (November–February), each €25 higher on the advice.
    expect(a.expectedSettlement - a.settlementWithAdvised).toBeCloseTo(4 * 25, 2);
  });

  it('on the advice both settlements match; overpaying gives a refund (negative)', () => {
    const on = contractOf(0);
    const a = annualOverview({ contract: on }, buildInvoiceHistory(on, 'K-48213', NOW, on.installment), NOW);
    expect(a.settlementWithAdvised).toBe(a.expectedSettlement);
    const over = contractOf(40);
    const b = annualOverview({ contract: over }, buildInvoiceHistory(over, 'K-48213', NOW, over.installment), NOW);
    expect(b.expectedSettlement).toBeLessThan(0);
    expect(b.settlementWithAdvised).toBeGreaterThan(b.expectedSettlement);
  });

  it('an anniversary later in the year than today started last calendar year; no invoices means nothing paid', () => {
    const contract = contractOf(-25, '2024-12-01');
    const a = annualOverview({ contract }, buildInvoiceHistory(contract, 'K-48213', NOW, contract.installment), NOW);
    expect(a.year.en).toBe('Contract year Dec 2025 – Nov 2026');
    expect(a.monthsPaid).toBe(11); // December 2025 – October 2026
    const empty = annualOverview({ contract }, [], NOW);
    expect(empty).toMatchObject({ monthsPaid: 0, paidSoFar: 0, installmentsTotal: 12 * contract.installment });
  });
});
