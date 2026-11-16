import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsMongoId, Matches } from 'class-validator';
import { NOTIFY_PRESETS, type LiveEvent, type NotifyPreset, type SimClusterRequest, type SimEvDetectedRequest, type SimForecastRequest, type SimNotifyRequest, type SimNotifyResult } from '@engie/shared';
import { actorFromUser } from '../audit/audit.service.js';
import { CurrentUser, Roles, type RequestUser } from '../auth/auth.js';
import { Db } from '../db/db.service.js';
import { SimService } from './sim.service.js';

class EvDetectedDto implements SimEvDetectedRequest {
  @IsMongoId() customerId: string;
}
class ClusterDto implements SimClusterRequest {
  @Matches(/^[A-Z]{2,4}(-[A-Z]{2,5})?$/) gridAreaCode: string;
}
class ForecastDto implements SimForecastRequest {
  @Matches(/^\d{4}$/) districtCode: string;
}
class NotifyDto implements SimNotifyRequest {
  @IsMongoId() customerId: string;
  @IsIn(NOTIFY_PRESETS.map((p) => p.id)) preset: NotifyPreset;
}

/** Simulated Net2Grid / grid events, fired from the /demo control panel. */
@Roles('STAFF')
@Controller('sim')
export class SimController {
  constructor(
    private readonly sim: SimService,
    private readonly db: Db,
  ) {}

  @Post('ev-detected')
  evDetected(@Body() b: EvDetectedDto): Promise<LiveEvent> {
    return this.sim.evDetected(b.customerId);
  }

  @Post('ev-cluster')
  cluster(@Body() b: ClusterDto): Promise<LiveEvent> {
    return this.sim.evCluster(b.gridAreaCode);
  }

  @Post('congestion-forecast')
  forecast(@Body() b: ForecastDto): Promise<LiveEvent> {
    return this.sim.congestionForecast(b.districtCode);
  }

  @Post('notify')
  async notify(@Body() b: NotifyDto, @CurrentUser() user: RequestUser): Promise<SimNotifyResult> {
    return this.sim.notify(b.customerId, b.preset, await actorFromUser(this.db, user));
  }
}
