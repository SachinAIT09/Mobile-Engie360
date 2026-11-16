import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { IsIn, IsMongoId, IsNumber, Min } from 'class-validator';
import { Types } from 'mongoose';
import { fmtMoney, type Payment, type PaymentMethodKind, type PaymentRequest } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { Db } from '../db/db.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { PaymentProvider } from './payment-provider.js';

class PaymentDto implements PaymentRequest {
  @IsMongoId() invoiceId: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
  @IsIn(['DIRECT_DEBIT', 'IDEAL', 'TRANSFER']) method: PaymentMethodKind;
}

/** Pay an open invoice (iDEAL mock). Installments are normally collected by direct debit. */
@Roles('CUSTOMER')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly db: Db,
    private readonly provider: PaymentProvider,
    private readonly realtime: RealtimeService,
    private readonly activity: ActivityService,
  ) {}

  @Post()
  async pay(@CustomerId() customerId: string, @Body() body: PaymentDto): Promise<Payment> {
    const invoice = await this.db.invoices.findOne({ _id: new Types.ObjectId(body.invoiceId), customerId: new Types.ObjectId(customerId) }).lean();
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (body.amount > 100000) throw new BadRequestException('Amount too large');
    const charge = await this.provider.charge({ amount: body.amount, method: body.method, reference: invoice.number });
    const now = new Date();
    const doc = await this.db.payments.create({
      customerId: new Types.ObjectId(customerId),
      invoiceId: invoice._id,
      amount: body.amount,
      method: body.method,
      status: 'CONFIRMED',
      confirmationNo: charge.confirmationNo,
      provider: charge.provider,
      createdAt: now,
    });
    if (body.amount + 0.001 >= invoice.amount) await this.db.invoices.updateOne({ _id: invoice._id }, { $set: { status: 'PAID', paidOn: now } });
    this.realtime.toCustomer(customerId, 'me:changed');
    void this.activity.record(customerId, 'PAYMENT_MADE', `Paid ${fmtMoney(body.amount)} for ${invoice.number} by iDEAL · ${charge.confirmationNo}`);
    return {
      id: String(doc._id),
      invoiceId: String(invoice._id),
      amount: doc.amount,
      method: doc.method,
      status: 'CONFIRMED',
      confirmationNo: doc.confirmationNo,
      provider: 'IDEAL_MOCK',
      createdAt: doc.createdAt.toISOString(),
    };
  }
}
