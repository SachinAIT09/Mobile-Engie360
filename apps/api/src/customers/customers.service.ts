import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  DYNAMIC_PRICE,
  lastMonthSummary,
  priceAt,
  thisMonth,
  type AutoPay,
  type Channels,
  type ContactUpdateRequest,
  type CustomerProfile,
  type EvStatus,
  type Insight,
  type InsightsResponse,
  type Lang,
  type MeSummary,
  type PaymentMethodKind,
  type Preferences,
  type PriceNow,
  type Program,
} from '@engie/shared';
import { BillingService } from '../billing/billing.service.js';
import { localHour } from '../common/time.js';
import { Db } from '../db/db.service.js';
import type { CustomerDoc, ProgramDoc } from '../db/schemas.js';
import { EnergyService } from '../energy/energy.service.js';
import { SmartChargingService } from '../energy/smart-charging.service.js';
import { FlexEventsService } from '../flex-events/flex-events.service.js';
import { buildInsights } from '../insights/insights.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { usageProfile } from '../usage/usage.service.js';

export function initials(c: Pick<CustomerDoc, 'firstName' | 'lastName'>): string {
  const last = c.lastName.split(' ').pop() ?? '';
  return `${c.firstName.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function priceNow(at: Date): PriceNow {
  const price = priceAt(localHour(at));
  const cheapestPrice = Math.min(...DYNAMIC_PRICE);
  return {
    price,
    level: price <= 0.2 ? 'low' : price >= 0.3 ? 'high' : 'normal',
    cheapestHour: DYNAMIC_PRICE.indexOf(cheapestPrice),
    cheapestPrice,
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly db: Db,
    private readonly energy: EnergyService,
    private readonly flexEvents: FlexEventsService,
    private readonly realtime: RealtimeService,
    private readonly smart: SmartChargingService,
    private readonly billing: BillingService,
  ) {}

  static profile(c: CustomerDoc): CustomerProfile {
    return {
      id: String(c._id),
      customerNo: c.customerNo,
      firstName: c.firstName,
      lastName: c.lastName,
      initials: initials(c),
      email: c.email,
      phone: c.phone,
      street: c.street,
      postcode: c.postcode,
      city: c.city,
      districtCode: c.districtCode,
      gridAreaCode: c.gridAreaCode,
      gridOperator: c.gridOperator,
      household: c.household,
      ibanMasked: c.ibanMasked,
      memberSince: new Date(c.memberSince).toISOString(),
      hasSolar: c.hasSolar,
      hasHeatPump: c.hasHeatPump,
      lang: c.lang ?? 'nl',
      channels: { push: !!c.channels?.push, sms: !!c.channels?.sms, email: !!c.channels?.email },
      preferences: c.preferences,
      autoPay: CustomersService.autoPay(c),
      contract: c.contract,
    };
  }

  static autoPay(c: CustomerDoc): AutoPay {
    const a = c.autoPay;
    return a?.enabled
      ? { enabled: true, method: a.method ?? null, since: a.since ? new Date(a.since).toISOString() : null }
      : { enabled: false, method: null, since: null };
  }

  static program(p: ProgramDoc): Program {
    return {
      id: String(p._id),
      name: p.name,
      signupIncentive: p.signupIncentive,
      perEventIncentive: p.perEventIncentive,
      maxEventsPerSeason: p.maxEventsPerSeason,
      typicalEventHours: p.typicalEventHours,
      termsUrl: p.termsUrl,
      termsSummary: p.termsSummary ?? [],
    };
  }

  async get(customerId: string): Promise<CustomerDoc> {
    const c = await this.db.customers.findById(customerId).lean();
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async evStatus(c: CustomerDoc): Promise<{ status: EvStatus; detectedAt: string | null }> {
    const [enr, det] = await Promise.all([
      this.db.enrollments.exists({ customerId: c._id, status: 'ACTIVE' }),
      this.db.detections.findOne({ customerId: c._id, status: 'DETECTED' }).lean(),
    ]);
    const detectedAt = det ? det.firstDetectedAt.toISOString() : null;
    if (enr) return { status: 'ENROLLED', detectedAt };
    if (det) return { status: 'DETECTED_NOT_ENROLLED', detectedAt };
    return { status: 'NONE', detectedAt: null };
  }

  async insightsFor(c: CustomerDoc, evStatus: EvStatus, expectedSettlement: number, now = new Date()): Promise<Insight[]> {
    return buildInsights({ c, profile: usageProfile(c), evStatus, expectedSettlement, now });
  }

  async insights(customerId: string): Promise<InsightsResponse> {
    const c = await this.get(customerId);
    const [ev, billing] = await Promise.all([this.evStatus(c), this.billing.overview(customerId)]);
    const insights = await this.insightsFor(c, ev.status, billing.annual.expectedSettlement);
    const ids = new Set(insights.map((i) => i.id));
    return {
      insights,
      totalSavings: insights.reduce((s, i) => s + (i.saving ?? 0), 0),
      plan: (c.savingsPlan ?? []).filter((id) => ids.has(id)),
    };
  }

  async updateSavingsPlan(customerId: string, plan: string[]): Promise<InsightsResponse> {
    await this.db.customers.updateOne({ _id: new Types.ObjectId(customerId) }, { $set: { savingsPlan: [...new Set(plan)].slice(0, 20) } });
    return this.insights(customerId);
  }

  async summary(customerId: string, now = new Date()): Promise<MeSummary> {
    const c = await this.get(customerId);
    const [ev, program, activeFlexEvent, unread, live, billing] = await Promise.all([
      this.evStatus(c),
      this.db.programs.findOne().lean(),
      this.flexEvents.activeForCustomer(customerId),
      this.db.messages.find({ customerId: c._id, openedAt: null }, { category: 1 }).lean(),
      this.energy.readingFor(c),
      this.billing.overview(customerId, now),
    ]);
    if (!program) throw new NotFoundException('No program configured');
    const profile = usageProfile(c);
    const insights = await this.insightsFor(c, ev.status, billing.annual.expectedSettlement, now);
    return {
      customer: CustomersService.profile(c),
      billing: {
        installment: billing.installment,
        advisedInstallment: billing.advisedInstallment,
        nextCollection: billing.nextCollection,
        outstanding: billing.outstanding,
        expectedSettlement: billing.annual.expectedSettlement,
      },
      evStatus: ev.status,
      evDetectedAt: ev.detectedAt,
      heatPumpDetectedAt: c.heatPumpDetectedAt ? new Date(c.heatPumpDetectedAt).toISOString() : null,
      program: CustomersService.program(program),
      activeFlexEvent,
      unreadCount: unread.length,
      unreadAlerts: unread.filter((m) => m.category === 'Alerts').length,
      unreadOffers: unread.filter((m) => m.category === 'Offers').length,
      thisMonth: thisMonth(profile, now),
      lastMonth: lastMonthSummary(profile, now),
      live,
      priceNow: priceNow(now),
      insights: insights.slice(0, 3),
      smartCharging: await this.smartSnapshot(c, ev.status !== 'NONE'),
    };
  }

  /** Home-screen smart-charging snapshot: null when the home has no EV and never saved settings. */
  private async smartSnapshot(c: CustomerDoc, hasEv: boolean): Promise<MeSummary['smartCharging']> {
    if (!hasEv && !c.smartCharging) return null;
    const plan = await this.smart.get(String(c._id));
    return {
      enabled: plan.settings.enabled,
      chargingNow: plan.settings.enabled && plan.chargingNow,
      nextStart: plan.settings.enabled ? plan.nextStart : null,
      savingsPerNight: plan.savings,
    };
  }

  private async set(customerId: string, $set: Record<string, unknown>): Promise<CustomerDoc> {
    await this.db.customers.updateOne({ _id: new Types.ObjectId(customerId) }, { $set });
    this.realtime.toCustomer(customerId, 'me:changed');
    return this.get(customerId);
  }

  async updateAutoPay(customerId: string, enabled: boolean, method: PaymentMethodKind | null): Promise<CustomerProfile> {
    const current = await this.get(customerId);
    const autoPay = enabled
      ? { enabled: true, method, since: current.autoPay?.enabled ? current.autoPay.since ?? new Date() : new Date() }
      : { enabled: false, method: null, since: null };
    return CustomersService.profile(await this.set(customerId, { autoPay }));
  }

  async updateChannels(customerId: string, ch: Channels): Promise<Channels> {
    await this.set(customerId, { channels: ch });
    return ch;
  }

  async updateContact(customerId: string, b: ContactUpdateRequest): Promise<CustomerProfile> {
    return CustomersService.profile(await this.set(customerId, { email: b.email.trim(), phone: b.phone.trim() }));
  }

  async updatePreferences(customerId: string, p: Preferences): Promise<Preferences> {
    await this.set(customerId, { preferences: p });
    return p;
  }

  async updateLang(customerId: string, lang: Lang): Promise<void> {
    await this.db.customers.updateOne({ _id: new Types.ObjectId(customerId) }, { $set: { lang } });
  }
}
