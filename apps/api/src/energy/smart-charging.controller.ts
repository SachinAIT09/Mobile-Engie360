import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, Matches, Max, Min } from 'class-validator';
import { RATE_PLANS, SMART_CHARGING, type RatePlanComparison, type RatePlanId, type SmartChargingPlan, type SmartChargingUpdateRequest } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { SmartChargingService } from './smart-charging.service.js';

class SmartChargingUpdateDto implements SmartChargingUpdateRequest {
  @IsBoolean() enabled: boolean;
  /** "HH:MM" on a 15-minute boundary. */
  @Matches(/^([01]\d|2[0-3]):(00|15|30|45)$/) readyBy: string;
  @IsInt() @Min(SMART_CHARGING.minTargetKwh) @Max(SMART_CHARGING.maxTargetKwh) targetKwh: number;
  @IsIn(['DYNAMIC', 'DUAL', 'FIXED']) ratePlan: RatePlanId;
}

@Roles('CUSTOMER')
@Controller('me')
export class SmartChargingController {
  constructor(
    private readonly smart: SmartChargingService,
    private readonly activity: ActivityService,
  ) {}

  @Get('smart-charging')
  get(@CustomerId() id: string): Promise<SmartChargingPlan> {
    return this.smart.get(id);
  }

  @Put('smart-charging')
  async update(@CustomerId() id: string, @Body() body: SmartChargingUpdateDto): Promise<SmartChargingPlan> {
    const plan = await this.smart.update(id, { enabled: body.enabled, readyBy: body.readyBy, targetKwh: body.targetKwh, ratePlan: body.ratePlan });
    const summary = body.enabled
      ? `Smart charging on: ${body.targetKwh} kWh ready by ${body.readyBy}, ${RATE_PLANS[body.ratePlan].label}`
      : 'Smart charging off';
    void this.activity.record(id, 'SMART_CHARGING_UPDATED', summary);
    return plan;
  }

  @Post('smart-charging/boost')
  async boost(@CustomerId() id: string): Promise<SmartChargingPlan> {
    const plan = await this.smart.boost(id);
    void this.activity.record(id, 'CHARGING_BOOST', 'Boosted: charging now instead of waiting for off-peak');
    return plan;
  }

  @Get('rate-plans')
  ratePlans(@CustomerId() id: string): Promise<RatePlanComparison> {
    return this.smart.ratePlans(id);
  }
}
