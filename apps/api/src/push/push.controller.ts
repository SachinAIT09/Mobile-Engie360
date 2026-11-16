import { Body, Controller, Get, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import type { PushKey, PushSubscribeRequest, PushUnsubscribeRequest } from '@engie/shared';
import { CustomerId, Public, Roles } from '../auth/auth.js';
import { WebPushService } from './web-push.service.js';

class KeysDto {
  @IsString() @MaxLength(200) p256dh: string;
  @IsString() @MaxLength(100) auth: string;
}
class SubscribeDto implements PushSubscribeRequest {
  @IsUrl({ protocols: ['https'], require_tld: true }) @MaxLength(1000) endpoint: string;
  @ValidateNested() @Type(() => KeysDto) keys: KeysDto;
}
class UnsubscribeDto implements PushUnsubscribeRequest {
  @IsString() @MaxLength(1000) endpoint: string;
}

/** Web push: the public VAPID key, and the customer app registering this phone for notifications. */
@Controller()
export class PushController {
  constructor(private readonly push: WebPushService) {}

  @Public()
  @Get('push/key')
  key(): PushKey {
    return { publicKey: this.push.publicKey };
  }

  @Roles('CUSTOMER')
  @Post('me/push')
  subscribe(@CustomerId() customerId: string, @Body() b: SubscribeDto): { ok: true } {
    this.push.subscribe(customerId, b);
    return { ok: true };
  }

  @Roles('CUSTOMER')
  @Post('me/push/remove')
  unsubscribe(@CustomerId() customerId: string, @Body() b: UnsubscribeDto): { ok: true } {
    this.push.unsubscribe(customerId, b.endpoint);
    return { ok: true };
  }
}
