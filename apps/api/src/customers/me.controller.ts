import { BadRequestException, Body, Controller, Get, Patch, Put, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type {
  AutoPayUpdateRequest,
  Channels,
  ContactUpdateRequest,
  CustomerProfile,
  EnergyReading,
  InsightsResponse,
  Lang,
  LangUpdateRequest,
  MeSummary,
  PaymentMethodKind,
  Preferences,
  Program,
  SavingsPlanUpdateRequest,
  UsageOverview,
  UsagePeriod,
  UsageSeriesResponse,
} from '@engie/shared';
import { ActivityService } from '../activity/activity.service.js';
import { CustomerId, Roles } from '../auth/auth.js';
import { Db } from '../db/db.service.js';
import { EnergyService } from '../energy/energy.service.js';
import { UsageService } from '../usage/usage.service.js';
import { CustomersService } from './customers.service.js';

class ChannelsDto implements Channels {
  @IsBoolean() push: boolean;
  @IsBoolean() sms: boolean;
  @IsBoolean() email: boolean;
}

class AutoPayDto implements AutoPayUpdateRequest {
  @IsBoolean() enabled: boolean;
  @IsOptional() @IsIn(['DIRECT_DEBIT', 'IDEAL', 'TRANSFER']) method?: PaymentMethodKind;
}

class ContactDto implements ContactUpdateRequest {
  @IsEmail() email: string;
  @IsString() @MinLength(6) @MaxLength(24) phone: string;
}

class PreferencesDto implements Preferences {
  @IsBoolean() usageAlerts: boolean;
  @IsBoolean() priceAlerts: boolean;
  @IsBoolean() invoiceReady: boolean;
  @IsBoolean() tips: boolean;
}

class LangDto implements LangUpdateRequest {
  @IsIn(['en', 'nl']) lang: Lang;
}

class PlanDto implements SavingsPlanUpdateRequest {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) plan: string[];
}

const PERIODS: UsagePeriod[] = ['hour', 'day', 'week', 'month'];
const CHANNEL_LABEL: Record<keyof Channels, string> = { push: 'app', sms: 'SMS', email: 'email' };

/** Customer-facing endpoints (mobile app). */
@Roles('CUSTOMER')
@Controller()
export class MeController {
  constructor(
    private readonly customers: CustomersService,
    private readonly energy: EnergyService,
    private readonly usage: UsageService,
    private readonly db: Db,
    private readonly activity: ActivityService,
  ) {}

  @Get('me/summary')
  summary(@CustomerId() id: string): Promise<MeSummary> {
    return this.customers.summary(id);
  }

  @Patch('me/channels')
  async channels(@CustomerId() id: string, @Body() body: ChannelsDto): Promise<Channels> {
    const ch = await this.customers.updateChannels(id, { push: body.push, sms: body.sms, email: body.email });
    const on = (['push', 'sms', 'email'] as const).filter((k) => ch[k]).map((k) => CHANNEL_LABEL[k]);
    void this.activity.record(id, 'CHANNELS_UPDATED', on.length ? `Alerts by ${on.join(', ')}` : 'Turned off all alerts');
    return ch;
  }

  /** Direct debit on (method required) or off. Demo only: no real bank details are stored. */
  @Patch('me/autopay')
  async autoPay(@CustomerId() id: string, @Body() body: AutoPayDto): Promise<CustomerProfile> {
    if (body.enabled && !body.method) throw new BadRequestException('method is required when enabling direct debit');
    const profile = await this.customers.updateAutoPay(id, body.enabled, body.enabled ? (body.method as PaymentMethodKind) : null);
    void this.activity.record(id, body.enabled ? 'AUTOPAY_ON' : 'AUTOPAY_OFF', body.enabled ? 'Direct debit turned on' : 'Direct debit turned off');
    return profile;
  }

  @Patch('me/contact')
  async contact(@CustomerId() id: string, @Body() body: ContactDto): Promise<CustomerProfile> {
    const profile = await this.customers.updateContact(id, body);
    void this.activity.record(id, 'CONTACT_UPDATED', `Contact details: ${profile.email}, ${profile.phone}`);
    return profile;
  }

  @Patch('me/preferences')
  async preferences(@CustomerId() id: string, @Body() body: PreferencesDto): Promise<Preferences> {
    const p = await this.customers.updatePreferences(id, {
      usageAlerts: body.usageAlerts, priceAlerts: body.priceAlerts, invoiceReady: body.invoiceReady, tips: body.tips,
    });
    const on = Object.entries(p).filter(([, v]) => v).length;
    void this.activity.record(id, 'PREFERENCES_UPDATED', `${on} of 4 notification types on`);
    return p;
  }

  @Patch('me/lang')
  async lang(@CustomerId() id: string, @Body() body: LangDto): Promise<{ ok: true }> {
    await this.customers.updateLang(id, body.lang);
    void this.activity.record(id, 'LANGUAGE_CHANGED', `App language: ${body.lang === 'nl' ? 'Nederlands' : 'English'}`);
    return { ok: true };
  }

  @Get('energy/live')
  live(@CustomerId() id: string): Promise<EnergyReading> {
    return this.energy.live(id);
  }

  @Get('usage')
  async usageSeries(@CustomerId() id: string, @Query('period') period = 'month'): Promise<UsageSeriesResponse> {
    if (!PERIODS.includes(period as UsagePeriod)) throw new BadRequestException(`period must be one of ${PERIODS.join(', ')}`);
    return this.usage.series(await this.usage.customer(id), period as UsagePeriod);
  }

  @Get('usage/overview')
  async usageOverview(@CustomerId() id: string): Promise<UsageOverview> {
    return this.usage.overview(await this.usage.customer(id));
  }

  @Get('insights')
  insights(@CustomerId() id: string): Promise<InsightsResponse> {
    return this.customers.insights(id);
  }

  @Put('insights/plan')
  async plan(@CustomerId() id: string, @Body() body: PlanDto): Promise<InsightsResponse> {
    const r = await this.customers.updateSavingsPlan(id, body.plan);
    void this.activity.record(id, 'SAVINGS_PLAN_UPDATED', `${r.plan.length} tip${r.plan.length === 1 ? '' : 's'} in the savings plan`);
    return r;
  }

  @Get('programs/current')
  async program(): Promise<Program> {
    const p = await this.db.programs.findOne().lean();
    if (!p) throw new BadRequestException('No program configured');
    return CustomersService.program(p);
  }
}
