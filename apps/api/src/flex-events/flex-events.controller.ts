import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { fmtWindow, type CustomerActivityKind, type FlexEvent, type FlexEventForCustomer, type FlexEventResultMe, type FlexRespondRequest, type FlexResponse } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { AuditService, actorFromUser } from '../audit/audit.service.js';
import { CurrentUser, CustomerId, Roles, type RequestUser } from '../auth/auth.js';
import { Db } from '../db/db.service.js';
import { FlexEventsService } from './flex-events.service.js';

class RespondDto implements FlexRespondRequest {
  @IsIn(['PAUSE', 'REMIND', 'OPT_OUT']) response: FlexResponse;
}

const RESPONSE_ACTIVITY: Record<FlexResponse, { kind: CustomerActivityKind; text: string }> = {
  PAUSE: { kind: 'FLEX_OPTED_IN', text: 'Will shift charging out of the flex window' },
  REMIND: { kind: 'REMIND_LATER', text: 'Asked for a reminder about the flex event' },
  OPT_OUT: { kind: 'FLEX_OPTED_OUT', text: 'Opted out of the flex event' },
};

@Controller('flex-events')
export class FlexEventsController {
  constructor(
    private readonly flexEvents: FlexEventsService,
    private readonly audit: AuditService,
    private readonly db: Db,
    private readonly activity: ActivityService,
  ) {}

  private async record(user: RequestUser | null, action: 'FLEX_STARTED' | 'FLEX_ENDED', e: FlexEvent, before: FlexEvent['status'] | null) {
    const districts = e.districtCodes?.length ? e.districtCodes : [e.districtCode];
    const where = districts.length > 1 ? `${districts[0]} +${districts.length - 1}` : districts[0];
    const summary =
      action === 'FLEX_STARTED'
        ? `Started the flex event on ${where} now (was scheduled)`
        : `Ended the flex event on ${where}${before === 'ACTIVE' ? '' : ' (fast-forwarded through its planned window)'}`;
    await this.audit.record(await actorFromUser(this.db, user), action, { kind: 'flexEvent', id: e.id, label: `flex event · ${where}` }, summary);
  }

  /** Staff list (flex events page). */
  @Roles('STAFF')
  @Get()
  list(): Promise<FlexEvent[]> {
    return this.flexEvents.list();
  }

  @Roles('CUSTOMER')
  @Get(':id')
  async get(@CustomerId() customerId: string, @Param('id') id: string): Promise<FlexEventForCustomer> {
    const r = await this.flexEvents.forCustomer(customerId, id);
    void this.activity.record(customerId, 'FLEX_OPENED', `Opened the flex event on ${r.event.districtCode} (${fmtWindow(r.event.windowStart, r.event.windowEnd)})`);
    return r;
  }

  @Roles('CUSTOMER')
  @Post(':id/responses')
  async respond(@CustomerId() customerId: string, @Param('id') id: string, @Body() body: RespondDto): Promise<FlexEventForCustomer> {
    const r = await this.flexEvents.respond(customerId, id, body.response);
    const a = RESPONSE_ACTIVITY[body.response];
    void this.activity.record(customerId, a.kind, `${a.text} · ${r.event.districtCode} ${fmtWindow(r.event.windowStart, r.event.windowEnd)}`);
    return r;
  }

  @Roles('CUSTOMER')
  @Get(':id/result/me')
  result(@CustomerId() customerId: string, @Param('id') id: string): Promise<FlexEventResultMe> {
    return this.flexEvents.resultMe(customerId, id);
  }

  @Roles('STAFF')
  @Post(':id/start')
  async start(@Param('id') id: string, @CurrentUser() user: RequestUser | null): Promise<FlexEvent> {
    const e = await this.flexEvents.start(id);
    await this.record(user, 'FLEX_STARTED', e, 'SCHEDULED');
    return e;
  }

  @Roles('STAFF')
  @Post(':id/end')
  async end(@Param('id') id: string, @CurrentUser() user: RequestUser | null): Promise<FlexEvent> {
    const before = (await this.flexEvents.getDto(id))?.status ?? null;
    const e = await this.flexEvents.end(id);
    // Ending an already-ended event is a no-op and is not audited again.
    if (before !== 'ENDED') await this.record(user, 'FLEX_ENDED', e, before);
    return e;
  }
}
