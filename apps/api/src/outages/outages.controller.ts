import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Types } from 'mongoose';
import type { OutageReportRequest, OutageReportResponse, OutageReportType } from '@engie/shared';
import { CurrentUser, OptionalAuth, type RequestUser } from '../auth/auth.js';
import { ActivityService } from '../activity/activity.service.js';
import { Db } from '../db/db.service.js';
import { CustomersService } from '../customers/customers.service.js';

class OutageReportDto implements OutageReportRequest {
  @IsIn(['NO_POWER', 'PARTIAL', 'FLICKER']) type: OutageReportType;
  @IsBoolean() notifyOnRestore: boolean;
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200) address?: string;
}

const REPORT_LABEL: Record<OutageReportType, string> = { NO_POWER: 'no power', PARTIAL: 'partial power', FLICKER: 'flickering lights' };

@Controller('outage-reports')
export class OutagesController {
  constructor(
    private readonly db: Db,
    private readonly activity: ActivityService,
  ) {}

  /** Signed-in customers report for their premise; anonymous callers must give an address. */
  @OptionalAuth()
  @Post()
  async report(@CurrentUser() user: RequestUser | null, @Body() body: OutageReportDto): Promise<OutageReportResponse> {
    const customer = user?.customerId ? await this.db.customers.findById(user.customerId).lean() : null;
    const address = customer?.address ?? body.address;
    if (!address) throw new BadRequestException('Please enter the address without power');
    const outage = customer
      ? await this.db.outages.findOne({ gridAreaCode: customer.gridAreaCode, status: { $ne: 'RESTORED' } }).lean()
      : await this.db.outages.findOne({ status: { $ne: 'RESTORED' } }).lean();
    const reference = `OR-${Math.floor(100000 + Math.random() * 899999)}`;
    const doc = await this.db.outageReports.create({
      customerId: customer ? customer._id : null,
      address,
      type: body.type,
      notifyOnRestore: body.notifyOnRestore,
      reference,
      outageId: outage ? (outage._id as Types.ObjectId) : null,
      createdAt: new Date(),
    });
    if (customer) {
      void this.activity.record(String(customer._id), 'OUTAGE_REPORTED', `Reported ${REPORT_LABEL[body.type]} · ${reference}`);
    }
    return { id: String(doc._id), reference, linkedOutage: outage ? CustomersService.outage(outage) : null };
  }
}
