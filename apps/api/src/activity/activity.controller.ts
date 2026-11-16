import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import {
  ACTIVITY_CATEGORIES,
  TRACKABLE_ACTIVITY_KINDS,
  type ActivityQuery,
  type CustomerActivity,
  type CustomerActivityCategory,
  type CustomerActivityPage,
  type TrackActivityRequest,
  type TrackableActivityKind,
} from '@engie/shared';
import { CustomerId, Roles } from '../auth/auth.js';
import { CustomersService } from '../customers/customers.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ActivityService, MAX_ACTIVITY_LIMIT } from './activity.service.js';

class ActivityQueryDto implements ActivityQuery {
  @IsOptional() @IsMongoId() customerId?: string;
  @IsOptional() @IsIn(ACTIVITY_CATEGORIES.map((c) => c.id)) category?: CustomerActivityCategory;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_ACTIVITY_LIMIT) limit?: number;
}

class CustomerParamDto {
  @IsMongoId() id: string;
}

class TrackActivityDto implements TrackActivityRequest {
  @IsIn([...TRACKABLE_ACTIVITY_KINDS]) kind: TrackableActivityKind;
}

@Controller()
export class ActivityController {
  constructor(
    private readonly activity: ActivityService,
    private readonly customers: CustomersService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Staff feed, newest first; default 100, max 200. */
  @Roles('STAFF')
  @Get('activity')
  list(@Query() q: ActivityQueryDto): Promise<CustomerActivity[]> {
    return this.activity.list(q);
  }

  /** Staff: one customer's header + timeline. */
  @Roles('STAFF')
  @Get('customers/:id/activity')
  async forCustomer(@Param() p: CustomerParamDto): Promise<CustomerActivityPage> {
    const { customer: c, activity } = await this.activity.forCustomer(p.id);
    return {
      customer: {
        customerId: String(c._id),
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        districtCode: c.districtCode ?? null,
        evStatus: (await this.customers.evStatus(c)).status,
        online: this.realtime.isOnline(String(c._id)),
      },
      activity,
    };
  }

  /** The phone reports screen views and sign-out (everything else is recorded where it happens). */
  @Roles('CUSTOMER')
  @Post('me/activity')
  async track(@CustomerId() customerId: string, @Body() body: TrackActivityDto): Promise<{ ok: true }> {
    await this.activity.record(customerId, body.kind, VIEW_SUMMARY[body.kind]);
    return { ok: true };
  }
}

const VIEW_SUMMARY: Record<TrackableActivityKind, string> = {
  SIGNED_OUT: 'Signed out of the app',
  VIEWED_BILL: 'Opened the Bill tab',
  VIEWED_BILL_HISTORY: 'Looked through past bills',
  VIEWED_USAGE: 'Checked usage on the home screen',
  VIEWED_ENERGY: 'Opened the Energy tab',
  VIEWED_FLEX_RESULT: 'Viewed their DR event result',
  VIEWED_PROGRAM: 'Read the EV program details',
};
