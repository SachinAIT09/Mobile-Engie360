import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SMART_CHARGING, monthlyUsage, type RatePlanComparison, type SmartChargingPlan, type SmartChargingSettings, type SmartChargingUpdateRequest } from '@engie/shared';
import { config } from '../config.js';
import { Db } from '../db/db.service.js';
import type { CustomerDoc } from '../db/schemas.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { baseline, evKwAt, hmToMinutes, planCharging, sessionFor, summarisePlan, type Session } from './charging-plan.js';
import { usageProfile } from '../usage/usage.service.js';
import { baseKw, EV_CHARGE_KW } from './energy.model.js';
import { comparePlans } from './tariff.js';

/** Plans are cached per customer and minute for this long (the 5 s live ticker reuses them). */
const CACHE_TTL_MS = 5000;

interface FlexWindow {
  start: Date;
  end: Date;
  title: string;
}

export function defaultSettings(): SmartChargingSettings {
  return { enabled: false, readyBy: SMART_CHARGING.defaultReadyBy, targetKwh: SMART_CHARGING.defaultTargetKwh, ratePlan: 'DYNAMIC' };
}

export function settingsOf(c: CustomerDoc): SmartChargingSettings {
  const s = c.smartCharging;
  if (!s) return defaultSettings();
  return { enabled: !!s.enabled, readyBy: s.readyBy, targetKwh: s.targetKwh, ratePlan: s.ratePlan };
}

/** Boost end when a "Charge now" boost is still running at `at`. */
export function activeBoost(c: CustomerDoc, at: Date): Date | null {
  const b = c.smartCharging?.boostUntil;
  if (!b) return null;
  const d = new Date(b);
  return d.getTime() > at.getTime() ? d : null;
}

/**
 * Builds the plan (pure apart from the inputs): tonight's session, cheapest/cleanest slots outside the flex windows,
 * savings against charging at plug-in.
 */
export function buildPlan(settings: SmartChargingSettings, hasEv: boolean, windows: FlexWindow[], boostUntil: Date | null, at: Date, tz = config.timezone): SmartChargingPlan {
  const session = sessionFor(at, settings.readyBy, SMART_CHARGING.plugInHour, tz);
  const avoided = hasEv ? windows.filter((w) => w.start < session.end && w.end > session.start) : [];
  const need = hasEv ? settings.targetKwh : 0;
  const plan = planCharging({ session, needKwh: need, maxKw: EV_CHARGE_KW, planId: settings.ratePlan, blocked: avoided, tz });
  const base = baseline(session, need, EV_CHARGE_KW, settings.ratePlan, tz);
  const sum = summarisePlan(plan.slots, base, session, settings.ratePlan, tz);
  const boost = hasEv && boostUntil && boostUntil > at ? boostUntil : null;
  return {
    settings,
    hasEv,
    session: { start: session.start.toISOString(), end: session.end.toISOString() },
    slots: plan.slots,
    plannedKwh: plan.plannedKwh,
    shortfallKwh: plan.shortfallKwh,
    cost: sum.cost,
    baselineCost: sum.baselineCost,
    savings: sum.savings,
    co2Kg: sum.co2Kg,
    baselineCo2Kg: sum.baselineCo2Kg,
    co2SavedKg: sum.co2SavedKg,
    avoidedFlexWindows: avoided.map((w) => ({ start: w.start.toISOString(), end: w.end.toISOString(), title: w.title })),
    chargingNow: hasEv && (!!boost || evKwAt(plan.slots, at) > 0),
    nextStart: plan.slots.find((s) => Date.parse(s.start) > at.getTime())?.start ?? null,
    boostUntil: boost ? boost.toISOString() : null,
    hourly: sum.hourly,
  };
}

/**
 * Smart-charging settings, planner and rate-plan comparison.
 * Depends only on Db + Realtime; EnergyService depends on this (not the other way round), so there is no DI cycle.
 */
@Injectable()
export class SmartChargingService {
  private readonly cache = new Map<string, { minute: number; expires: number; key: string; plan: SmartChargingPlan }>();

  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
  ) {}

  private async customer(customerId: string): Promise<CustomerDoc> {
    const c = Types.ObjectId.isValid(customerId) ? await this.db.customers.findById(customerId).lean() : null;
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  async hasEv(c: CustomerDoc): Promise<boolean> {
    const [det, enr] = await Promise.all([
      this.db.detections.exists({ customerId: c._id, status: 'DETECTED' }),
      this.db.enrollments.exists({ customerId: c._id, status: 'ACTIVE' }),
    ]);
    return !!det || !!enr;
  }

  /** SCHEDULED/ACTIVE flex events targeting the customer that overlap the session, minus the ones they opted out of. */
  private async flexWindows(c: CustomerDoc, session: Session): Promise<FlexWindow[]> {
    const evs = await this.db.flexEvents
      .find(
        { status: { $in: ['SCHEDULED', 'ACTIVE'] }, targetCustomerIds: c._id, windowEnd: { $gt: session.start }, windowStart: { $lt: session.end } },
        { windowStart: 1, windowEnd: 1, title: 1 },
      )
      .sort({ windowStart: 1 })
      .lean();
    if (!evs.length) return [];
    const outs = await this.db.responses.find({ flexEventId: { $in: evs.map((e) => e._id) }, customerId: c._id, response: 'OPT_OUT' }, { flexEventId: 1 }).lean();
    const skip = new Set(outs.map((o) => String(o.flexEventId)));
    return evs.filter((e) => !skip.has(String(e._id))).map((e) => ({ start: e.windowStart, end: e.windowEnd, title: e.title }));
  }

  private async compute(c: CustomerDoc, hasEv: boolean, at: Date): Promise<SmartChargingPlan> {
    const settings = settingsOf(c);
    const session = sessionFor(at, settings.readyBy);
    const windows = hasEv ? await this.flexWindows(c, session) : [];
    return buildPlan(settings, hasEv, windows, activeBoost(c, at), at);
  }

  private invalidate(customerId: string) {
    this.cache.delete(customerId);
  }

  /**
   * The plan in force at `at`, or null when smart charging is off (energy model unchanged).
   * Callers check that the home has an EV. Cached per customer-minute for a few seconds.
   */
  async planFor(customer: CustomerDoc, at: Date = new Date()): Promise<SmartChargingPlan | null> {
    if (!customer.smartCharging?.enabled) return null;
    const id = String(customer._id);
    const minute = Math.floor(at.getTime() / 60000);
    const key = JSON.stringify(customer.smartCharging);
    const hit = this.cache.get(id);
    if (hit && hit.minute === minute && hit.key === key && hit.expires > Date.now()) return hit.plan;
    const plan = await this.compute(customer, true, at);
    this.cache.set(id, { minute, key, expires: Date.now() + CACHE_TTL_MS, plan });
    return plan;
  }

  /** Current settings and tonight's plan (a preview when off; empty slots when the home has no EV). */
  async get(customerId: string, at = new Date()): Promise<SmartChargingPlan> {
    const c = await this.customer(customerId);
    return this.compute(c, await this.hasEv(c), at);
  }

  async update(customerId: string, dto: SmartChargingUpdateRequest): Promise<SmartChargingPlan> {
    const c = await this.customer(customerId);
    const smartCharging = {
      enabled: dto.enabled,
      readyBy: dto.readyBy,
      targetKwh: dto.targetKwh,
      ratePlan: dto.ratePlan,
      boostUntil: c.smartCharging?.boostUntil ?? null,
    };
    await this.db.customers.updateOne({ _id: c._id }, { $set: { smartCharging } });
    this.invalidate(customerId);
    this.realtime.toCustomer(customerId, 'me:changed');
    return this.get(customerId);
  }

  /** Charge now for one hour, regardless of the plan. */
  async boost(customerId: string): Promise<SmartChargingPlan> {
    const c = await this.customer(customerId);
    const smartCharging = { ...settingsOf(c), boostUntil: new Date(Date.now() + 3600000) };
    await this.db.customers.updateOne({ _id: c._id }, { $set: { smartCharging } });
    this.invalidate(customerId);
    this.realtime.toCustomer(customerId, 'me:changed');
    return this.get(customerId);
  }

  /** Monthly cost on each plan from the customer's last 12 months of usage, with and without smart charging. */
  async ratePlans(customerId: string): Promise<RatePlanComparison> {
    const c = await this.customer(customerId);
    const hasEv = await this.hasEv(c);
    const months = monthlyUsage(usageProfile(c), new Date());
    const basis = months.reduce((s, m) => s + m.electricity, 0) / months.length;
    const evPerMonth = hasEv ? months[months.length - 1]?.ev || 78 : 0;
    const settings = settingsOf(c);
    return comparePlans({
      basisKwhPerMonth: Math.max(basis, evPerMonth),
      homeShape: Array.from({ length: 24 }, (_, h) => baseKw(h + 0.5, 0)),
      evKwhPerNight: evPerMonth / 30,
      evKw: EV_CHARGE_KW,
      plugInHour: SMART_CHARGING.plugInHour,
      readyByHour: hmToMinutes(settings.readyBy) / 60,
      current: settings.ratePlan,
    });
  }
}
