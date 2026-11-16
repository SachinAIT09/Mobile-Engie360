import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { IsNumber } from 'class-validator';
import type { BillingOverview, InstallmentUpdateRequest, Invoice } from '@engie/shared';
import { CustomerId, Roles } from '../auth/auth.js';
import { BillingService } from './billing.service.js';

class InstallmentDto implements InstallmentUpdateRequest {
  @IsNumber({ maxDecimalPlaces: 0 }) amount: number;
}

/** Installments, invoices and payments for the signed-in customer. */
@Roles('CUSTOMER')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  overview(@CustomerId() id: string): Promise<BillingOverview> {
    return this.billing.overview(id);
  }

  @Get('invoices/:invoiceId')
  invoice(@CustomerId() id: string, @Param('invoiceId') invoiceId: string): Promise<Invoice> {
    return this.billing.invoice(id, invoiceId);
  }

  @Put('installment')
  installment(@CustomerId() id: string, @Body() body: InstallmentDto): Promise<BillingOverview> {
    return this.billing.updateInstallment(id, body.amount);
  }
}
