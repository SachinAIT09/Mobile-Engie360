import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { IsIn } from 'class-validator';
import type { CustomerActivityKind, Message, MessageActionRequest } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { MessagesService } from './messages.service.js';

class MessageActionDto implements MessageActionRequest {
  @IsIn(['ENROLLED', 'DECLINED', 'DISMISSED', 'REMIND_LATER', 'NOT_EV'])
  action: MessageActionRequest['action'];
}

/** ENROLLED is recorded by the enrollment itself. */
const ACTION_ACTIVITY: Partial<Record<MessageActionRequest['action'], { kind: CustomerActivityKind; verb: string }>> = {
  DECLINED: { kind: 'MESSAGE_DECLINED', verb: 'Declined' },
  DISMISSED: { kind: 'MESSAGE_DECLINED', verb: 'Dismissed' },
  REMIND_LATER: { kind: 'REMIND_LATER', verb: 'Remind me later on' },
  NOT_EV: { kind: 'NOT_EV', verb: 'Not my EV on' },
};

@Roles('CUSTOMER')
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly activity: ActivityService,
  ) {}

  @Get()
  list(@CustomerId() id: string): Promise<Message[]> {
    return this.messages.list(id);
  }

  /** Opening a message marks it read. */
  @Get(':id')
  async get(@CustomerId() customerId: string, @Param('id') id: string): Promise<Message> {
    const m = await this.messages.open(customerId, id);
    void this.activity.record(customerId, 'MESSAGE_OPENED', `Opened “${m.title}”`);
    return m;
  }

  @Post(':id/action')
  async act(@CustomerId() customerId: string, @Param('id') id: string, @Body() body: MessageActionDto): Promise<Message> {
    const m = await this.messages.act(customerId, id, body.action);
    const a = ACTION_ACTIVITY[body.action];
    if (a) void this.activity.record(customerId, a.kind, `${a.verb} “${m.title}”`);
    return m;
  }
}
