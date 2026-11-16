import { Body, Controller, Post } from '@nestjs/common';
import { Equals, IsBoolean, IsIn, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ChargerType, EnrollRequest, Enrollment, EnrollmentSource } from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { EnrollmentsService } from './enrollments.service.js';

class EnrollDto implements EnrollRequest {
  @IsIn(['APP_POPUP', 'CAMPAIGN', 'LEGACY']) source: EnrollmentSource;
  @IsOptional() @IsString() @MaxLength(60) evMake?: string;
  @IsOptional() @IsIn(['LEVEL_1', 'LEVEL_2']) chargerType?: ChargerType;
  @IsOptional() @IsMongoId() messageId?: string;
  @IsBoolean() @Equals(true, { message: 'Consent is required to enroll' }) consent: boolean;
}

const SOURCE_LABEL: Record<EnrollmentSource, string> = {
  APP_POPUP: 'from the EV-detected pop-up',
  CAMPAIGN: 'from a campaign message',
  LEGACY: 'in the app',
};
const CHARGER_LABEL: Record<ChargerType, string> = { LEVEL_1: 'Level 1', LEVEL_2: 'Level 2' };

@Roles('CUSTOMER')
@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly activity: ActivityService,
  ) {}

  @Post('enrollments')
  async enroll(@CustomerId() id: string, @Body() body: EnrollDto): Promise<Enrollment> {
    const e = await this.enrollments.enroll(id, body);
    const car = [body.evMake, body.chargerType && CHARGER_LABEL[body.chargerType]].filter(Boolean).join(', ');
    void this.activity.record(id, 'ENROLLED', `Enrolled ${SOURCE_LABEL[body.source]}${car ? ` · ${car}` : ''}`);
    return e;
  }

  /** "Not an EV? Let us know" from the EV-detected sheet. */
  @Post('ev-detections/mine/not-ev')
  async notEv(@CustomerId() id: string): Promise<{ ok: true }> {
    const r = await this.enrollments.notEv(id);
    void this.activity.record(id, 'NOT_EV', 'Told us the detected load is not an EV');
    return r;
  }
}
