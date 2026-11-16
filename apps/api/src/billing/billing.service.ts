import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  MONTHS_EN,
  MONTHS_LONG_EN,
  MONTHS_LONG_NL,
  MONTHS_NL,
  fmtMoney,
  type AnnualOverview,
  type BillingOverview,
  type Invoice,
  type PaymentRecord,
} from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { round2 } from '../common/numbers.js';
import { Db } from '../db/db.service.js';
import type { CustomerDoc, InvoiceDoc } from '../db/schemas.js';
import { MessagesService } from '../messages/messages.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';

/** Day of the month the installment is collected. */
export const COLLECTION_DAY = 28;

export function invoiceDto(i: InvoiceDoc): Invoice {
  return {
    id: String(i._id),
    number: i.number,
    kind: i.kind,
    period: i.period,
    issued: i.issued.toISOString(),
    due: i.due.toISOString(),
    amount: i.amount,
    status: i.status,
    paidOn: i.paidOn ? i.paidOn.toISOString() : null,
    lines: i.lines,
  };
}

/** Next collection date (the 28th of this month, or next month once it has passed). */
export function nextCollection(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), COLLECTION_DAY, 9));
  return d.getTime() > now.getTime() ? d : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, COLLECTION_DAY, 9));
}

/**
 * Contract-year overview: installments paid since the last anniversary, the expected total for the year
 * and what that means at the annual statement (+ = to pay, − = refund).
 */
export function annualOverview(c: Pick<CustomerDoc, 'contract'>, invoices: Pick<InvoiceDoc, 'kind' | 'status' | 'issued' | 'amount'>[], now: Date): AnnualOverview {
  const start = new Date(c.contract.startDate);
  const annMonth = start.getUTCMonth();
  let y = now.getUTCFullYear();
  if (annMonth > now.getUTCMonth()) y--;
  const yearStart = new Date(Date.UTC(y, annMonth, 1));
  const yearEnd = new Date(Date.UTC(y + 1, annMonth, 1));
  const paid = invoices.filter((i) => i.kind === 'INSTALLMENT' && i.status === 'PAID' && i.issued.getTime() >= yearStart.getTime());
  const paidSoFar = round2(paid.reduce((s, i) => s + i.amount, 0));
  const remaining = 12 - paid.length;
  const estimatedTotal = c.contract.estimatedAnnualCost;
  const installmentsTotal = round2(paidSoFar + remaining * c.contract.installment);
  const withAdvised = round2(paidSoFar + remaining * c.contract.advisedInstallment);
  const m = (d: Date, names: string[]) => `${names[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const last = new Date(yearEnd.getTime() - 86400000);
  return {
    year: { en: `Contract year ${m(yearStart, MONTHS_EN)} – ${m(last, MONTHS_EN)}`, nl: `Contractjaar ${m(yearStart, MONTHS_NL)} – ${m(last, MONTHS_NL)}` },
    paidSoFar,
    monthsPaid: paid.length,
    estimatedTotal,
    installmentsTotal,
    expectedSettlement: round2(estimatedTotal - installmentsTotal),
    settlementWithAdvised: round2(estimatedTotal - withAdvised),
  };
}

@Injectable()
export class BillingService {
  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
    private readonly messages: MessagesService,
    private readonly activity: ActivityService,
  ) {}

  async customer(customerId: string): Promise<CustomerDoc> {
    const c = await this.db.customers.findById(customerId).lean();
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  private invoiceDocs(customerId: Types.ObjectId) {
    return this.db.invoices.find({ customerId }).sort({ issued: -1 }).lean();
  }

  async overview(customerId: string, now = new Date()): Promise<BillingOverview> {
    const c = await this.customer(customerId);
    const invoices = await this.invoiceDocs(c._id);
    const payments = await this.db.payments.find({ customerId: c._id }).lean();
    const byInvoice = new Map(payments.map((p) => [String(p.invoiceId), p]));
    const records: PaymentRecord[] = invoices
      .filter((i) => i.status === 'PAID' && i.paidOn)
      .map((i, n) => {
        const p = byInvoice.get(String(i._id));
        return {
          id: p ? String(p._id) : `PAY-${90311 + n}`,
          date: (p?.createdAt ?? (i.paidOn as Date)).toISOString(),
          amount: i.amount,
          method: p?.method ?? (c.autoPay?.enabled ? 'DIRECT_DEBIT' : 'TRANSFER'),
          invoiceId: String(i._id),
          invoiceNumber: i.number,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    const open = invoices.filter((i) => i.status === 'OPEN');
    const next = nextCollection(now);
    return {
      installment: c.contract.installment,
      advisedInstallment: c.contract.advisedInstallment,
      installmentRange: c.contract.installmentRange,
      pendingInstallment: c.contract.pendingInstallment ?? null,
      pendingFrom: c.contract.pendingFrom ?? null,
      nextCollection: { date: next.toISOString(), amount: c.contract.installment },
      outstanding: { count: open.length, amount: round2(open.reduce((s, i) => s + i.amount, 0)) },
      annual: annualOverview(c, invoices, now),
      invoices: invoices.map(invoiceDto),
      payments: records,
    };
  }

  async invoice(customerId: string, id: string): Promise<Invoice> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invoice not found');
    const i = await this.db.invoices.findOne({ _id: new Types.ObjectId(id), customerId: new Types.ObjectId(customerId) }).lean();
    if (!i) throw new NotFoundException('Invoice not found');
    return invoiceDto(i);
  }

  /**
   * Change the monthly installment. It applies from the next collection; the scheduled invoice for this
   * month is updated when it has not been collected yet. Closes any open installment-advice message.
   */
  async updateInstallment(customerId: string, amount: number, now = new Date()): Promise<BillingOverview> {
    const c = await this.customer(customerId);
    const { min, max } = c.contract.installmentRange;
    if (!Number.isFinite(amount) || amount < min || amount > max) throw new BadRequestException(`Installment must be between €${min} and €${max}`);
    const from = nextCollection(now);
    const before = c.contract.installment;
    await this.db.customers.updateOne(
      { _id: c._id },
      { $set: { 'contract.installment': amount, 'contract.pendingInstallment': amount, 'contract.pendingFrom': from.toISOString() } },
    );
    const scheduled = await this.db.invoices.findOne({ customerId: c._id, kind: 'INSTALLMENT', status: 'SCHEDULED' }).lean();
    if (scheduled) {
      const elec = round2(amount * 0.39);
      await this.db.invoices.updateOne(
        { _id: scheduled._id },
        {
          $set: {
            amount,
            lines: [
              { label: { en: 'Advance payment electricity', nl: 'Voorschot stroom' }, amount: elec },
              { label: { en: 'Advance payment gas', nl: 'Voorschot gas' }, amount: round2(amount - elec) },
            ],
          },
        },
      );
    }
    // An open installment-advice message counts as acted on (campaign results update live).
    const advice = await this.db.messages.find({ customerId: c._id, kind: 'INSTALLMENT_ADVICE', actedAt: null }).lean();
    for (const m of advice) await this.messages.applyAction(m, 'INSTALLMENT_CHANGED');
    this.realtime.toCustomer(customerId, 'me:changed');
    this.realtime.toStaff('district:statsChanged', { gridAreaCode: c.gridAreaCode, districtCode: c.districtCode });
    const month = (c.lang === 'nl' ? MONTHS_LONG_NL : MONTHS_LONG_EN)[from.getUTCMonth()];
    void this.activity.record(customerId, 'INSTALLMENT_CHANGED', `Installment ${fmtMoney(before)} → ${fmtMoney(amount)} from ${month} (advice ${fmtMoney(c.contract.advisedInstallment)})`);
    return this.overview(customerId, now);
  }
}
