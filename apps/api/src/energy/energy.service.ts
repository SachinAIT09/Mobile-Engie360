import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Types } from 'mongoose';
import { priceAt, type ApplianceKey, type EnergyReading } from '@engie/shared';
import { config } from '../config.js';
import { Db } from '../db/db.service.js';
import type { CustomerDoc } from '../db/schemas.js';
import { round2 } from '../common/numbers.js';
import { localHour } from '../common/time.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { avgEvKw, evKwAt, localClock, planCharging, repeatDaily, sessionFor } from './charging-plan.js';
import { EV_CHARGE_KW, point } from './energy.model.js';
import { activeBoost, SmartChargingService } from './smart-charging.service.js';

export interface EvState {
  hasEv: boolean;
  charging: boolean;
  pausedForEvent: boolean;
  evKw: number;
}

@Injectable()
export class EnergyService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private readonly log = new Logger('Energy');

  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
    private readonly smart: SmartChargingService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 5000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const ids = this.realtime.onlineCustomerIds();
    if (!ids.length) return;
    try {
      const customers = await this.db.customers.find({ _id: { $in: ids.map((i) => new Types.ObjectId(i)) } }).lean();
      for (const c of customers) {
        const r = await this.readingFor(c);
        this.realtime.toCustomer(String(c._id), 'energy:reading', r);
      }
    } catch (e) {
      this.log.warn(`tick failed: ${(e as Error).message}`);
    }
  }

  async customer(customerId: string): Promise<CustomerDoc> {
    const c = await this.db.customers.findById(customerId).lean();
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  /** EV state right now, including flex-event pausing. */
  async evState(c: CustomerDoc, at = new Date()): Promise<EvState> {
    const [det, enr] = await Promise.all([
      this.db.detections.exists({ customerId: c._id, status: 'DETECTED' }),
      this.db.enrollments.exists({ customerId: c._id, status: 'ACTIVE' }),
    ]);
    const hasEv = !!det || !!enr;
    const h = localHour(at);
    // Smart charging (when on) decides when the car draws power, then flex pausing still applies.
    const plan = hasEv && c.smartCharging?.enabled ? await this.smart.planFor(c, at) : null;
    const charging = plan
      ? !!activeBoost(c, at) || evKwAt(plan.slots, at) > 0
      : c.evChargingActive || (hasEv && (config.evAlwaysCharging || (h >= 18 && h < 23)));
    let pausedForEvent = false;
    if (charging) {
      const active = await this.db.flexEvents.find({ status: 'ACTIVE', targetCustomerIds: c._id }).lean();
      for (const ev of active) {
        if (await this.db.responses.exists({ flexEventId: ev._id, customerId: c._id, response: 'PAUSE' })) pausedForEvent = true;
      }
    }
    return { hasEv, charging, pausedForEvent, evKw: charging && !pausedForEvent ? EV_CHARGE_KW : 0 };
  }

  async readingFor(c: CustomerDoc, at = new Date()): Promise<EnergyReading> {
    const ev = await this.evState(c, at);
    const hour = localHour(at);
    const p = point(hour, at.getTime() / 5000 + Math.random(), { hasSolar: c.hasSolar, evKw: ev.evKw });
    // Net2Grid live split: always-on and fridge are steady, the rest follows the time of day.
    const evening = hour >= 17 && hour < 22;
    const rest = Math.max(0, p.baseKw - 0.2 - 0.06);
    const cooking = evening || (hour >= 7 && hour < 9) ? rest * 0.45 : rest * 0.08;
    const media = evening ? rest * 0.3 : rest * 0.22;
    const heat = c.hasHeatPump ? 0.6 + (evening ? 0.5 : 0) : 0;
    const appliances: { key: ApplianceKey; kw: number }[] = [
      { key: 'ev', kw: p.evKw },
      { key: 'heatpump', kw: heat },
      { key: 'always', kw: 0.2 },
      { key: 'fridge', kw: 0.06 },
      { key: 'cooking', kw: cooking },
      { key: 'media', kw: media },
      { key: 'other', kw: Math.max(0, rest - cooking - media) },
    ];
    const extra = heat;
    return {
      appliances: appliances.filter((a) => a.kw > 0.005).map((a) => ({ key: a.key, kw: round2(a.kw) })),
      price: priceAt(hour),
      ts: at.toISOString(),
      solarKw: round2(p.solarKw),
      gridImportKw: round2(Math.max(0, p.homeKw + extra - p.solarKw)),
      gridExportKw: round2(Math.max(0, p.solarKw - p.homeKw - extra)),
      homeKw: round2(p.homeKw + extra),
      evKw: round2(p.evKw),
    };
  }

  async live(customerId: string): Promise<EnergyReading> {
    return this.readingFor(await this.customer(customerId));
  }

  /** 15-minute home-load series around a flex event window, for the event result chart. */
  seriesAround(c: CustomerDoc, start: Date, end: Date, paused: boolean): { t: string; kw: number }[] {
    const out: { t: string; kw: number }[] = [];
    const from = start.getTime() - 2 * 3600000;
    const to = end.getTime() + 2 * 3600000;
    const step = 15 * 60000;
    // Smart charging on: outside the window the car follows a plan that charges around the event.
    const s = c.smartCharging?.enabled ? c.smartCharging : null;
    const planned = s
      ? repeatDaily(
          planCharging({
            session: sessionFor(start, s.readyBy),
            needKwh: s.targetKwh,
            maxKw: EV_CHARGE_KW,
            planId: s.ratePlan,
            blocked: [{ start, end }],
            tz: config.timezone,
          }).slots,
        )
      : null;
    for (let t = from; t <= to; t += step) {
      const inWindow = t >= start.getTime() && t < end.getTime();
      const outside = planned ? avgEvKw(planned, t, t + step) : t < start.getTime() ? EV_CHARGE_KW : t < end.getTime() + 2 * 3600000 ? EV_CHARGE_KW : 0;
      const evKw = inWindow ? (paused ? 0 : EV_CHARGE_KW) : outside;
      const p = point(localHour(new Date(t)), Math.floor(t / step), { hasSolar: c.hasSolar, evKw });
      out.push({ t: new Date(t).toISOString(), kw: round2(p.homeKw) });
    }
    return out;
  }
}
