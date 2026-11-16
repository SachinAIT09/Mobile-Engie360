import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PROGRAM,
  type ActiveFlexEventRef,
  type FlexEvent,
  type FlexEventForCustomer,
  type FlexEventResultMe,
  type FlexResponse,
} from '@engie/shared';
import { Db } from '../db/db.service.js';
import type { FlexEventDoc } from '../db/schemas.js';
import { CampaignStatsService } from '../campaigns/campaign-stats.service.js';
import { EnergyService } from '../energy/energy.service.js';
import { kwhShifted as kwhShiftedPerHousehold, peakReducedKwPerHousehold, peakReducedMw } from './flex-result.js';
import { round3 } from '../common/numbers.js';
import { EV_CHARGE_KW } from '../energy/energy.model.js';
import { LiveEventsService } from '../live-events/live-events.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { flexEventPayload } from '../push/push-payload.js';
import { WebPushService } from '../push/web-push.service.js';

@Injectable()
export class FlexEventsService {
  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
    private readonly energy: EnergyService,
    private readonly messages: MessagesService,
    private readonly stats: CampaignStatsService,
    private readonly liveEvents: LiveEventsService,
    private readonly webPush: WebPushService,
  ) {}

  static toDto(e: FlexEventDoc): FlexEvent {
    return {
      id: String(e._id),
      districtCode: e.districtCode,
      title: e.title,
      windowStart: e.windowStart.toISOString(),
      windowEnd: e.windowEnd.toISOString(),
      status: e.status,
      campaignId: String(e.campaignId),
      districtCodes: e.districtCodes?.length ? e.districtCodes : [e.districtCode],
    };
  }

  async create(input: {
    districtCode: string;
    /** Every district of a multi-district campaign; defaults to [districtCode]. */
    districtCodes?: string[];
    title: string;
    start: Date;
    end: Date;
    campaignId: Types.ObjectId;
    targets: Types.ObjectId[];
  }) {
    const districtCodes = [...new Set([input.districtCode, ...(input.districtCodes ?? [])])];
    return this.db.flexEvents.create({
      districtCode: input.districtCode,
      districtCodes,
      title: input.title,
      windowStart: input.start,
      windowEnd: input.end,
      plannedHours: (input.end.getTime() - input.start.getTime()) / 3600000,
      status: 'SCHEDULED',
      campaignId: input.campaignId,
      targetCustomerIds: input.targets,
    });
  }

  private async load(id: string): Promise<FlexEventDoc> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('flex event not found');
    const e = await this.db.flexEvents.findById(id).lean();
    if (!e) throw new NotFoundException('flex event not found');
    return e;
  }

  private assertTarget(e: FlexEventDoc, customerId: string) {
    if (!e.targetCustomerIds.some((t) => String(t) === customerId)) throw new ForbiddenException('You are not part of this event');
  }

  private async myResponse(e: FlexEventDoc, customerId: string): Promise<FlexResponse | null> {
    const r = await this.db.responses.findOne({ flexEventId: e._id, customerId: new Types.ObjectId(customerId) }).lean();
    return r?.response ?? null;
  }

  async forCustomer(customerId: string, id: string): Promise<FlexEventForCustomer> {
    const e = await this.load(id);
    this.assertTarget(e, customerId);
    await this.messages.openForFlexEvent(customerId, e._id);
    const c = await this.energy.customer(customerId);
    const ev = await this.energy.evState(c);
    return {
      event: FlexEventsService.toDto(e),
      myResponse: await this.myResponse(e, customerId),
      currentEvKw: ev.charging ? EV_CHARGE_KW : 0,
      earnText: PROGRAM.perEventIncentive,
    };
  }

  /** Upsert a response; used by the app and by the synthetic-response simulator. */
  async recordResponse(e: FlexEventDoc, customerId: Types.ObjectId, response: FlexResponse, synthetic: boolean): Promise<void> {
    await this.db.responses.updateOne(
      { flexEventId: e._id, customerId },
      { $set: { response, respondedAt: new Date(), synthetic }, $setOnInsert: { kwhShifted: null, peakReducedKw: null, earned: null } },
      { upsert: true },
    );
    const m = await this.db.messages.findOne({ customerId, flexEventId: e._id }).lean();
    if (m) await this.messages.applyAction(m, 'RESPONDED');
    else await this.stats.recompute(e.campaignId);
  }

  async respond(customerId: string, id: string, response: FlexResponse): Promise<FlexEventForCustomer> {
    const e = await this.load(id);
    this.assertTarget(e, customerId);
    if (e.status === 'ENDED') throw new ConflictException('This event has already ended');
    await this.recordResponse(e, new Types.ObjectId(customerId), response, false);
    this.realtime.toCustomer(customerId, 'me:changed');
    return this.forCustomer(customerId, id);
  }

  private broadcast(e: FlexEventDoc) {
    const dto = FlexEventsService.toDto(e);
    this.realtime.toStaff('flexEvent:statusChanged', dto);
    const push = flexEventPayload(dto);
    for (const t of e.targetCustomerIds) {
      const cid = String(t);
      // Phone notification even when the app is closed (only phones that turned notifications on).
      if (push) this.webPush.send(cid, push);
      if (this.realtime.isOnline(cid)) {
        this.realtime.toCustomer(cid, 'flexEvent:statusChanged', dto);
        this.realtime.toCustomer(cid, 'me:changed');
      }
    }
  }

  async start(id: string): Promise<FlexEvent> {
    const e = await this.load(id);
    if (e.status === 'ENDED') throw new ConflictException('Event already ended');
    const now = new Date();
    const dur = e.windowEnd.getTime() - e.windowStart.getTime();
    const set = { status: 'ACTIVE' as const, windowStart: now, windowEnd: new Date(now.getTime() + dur) };
    await this.db.flexEvents.updateOne({ _id: e._id }, { $set: set });
    const updated = { ...e, ...set };
    this.broadcast(updated);
    return FlexEventsService.toDto(updated);
  }

  async end(id: string): Promise<FlexEvent> {
    const e = await this.load(id);
    if (e.status === 'ENDED') return FlexEventsService.toDto(e);
    const now = new Date();
    // "End event now" fast-forwards the demo: the event is treated as having run its full planned
    // window, so the result screen, chart labels and kWh shifted all describe the same window.
    const start = e.status === 'SCHEDULED' && e.windowStart.getTime() > now.getTime() ? now : e.windowStart;
    const set = { status: 'ENDED' as const, windowStart: start, windowEnd: new Date(start.getTime() + (e.plannedHours || 3) * 3600000) };
    await this.db.flexEvents.updateOne({ _id: e._id }, { $set: set });
    const updated = { ...e, ...set } as FlexEventDoc;

    // Per-household results: a paused EV shifts its planned charging out of the window.
    const kwhShifted = kwhShiftedPerHousehold(e.plannedHours);
    await this.db.responses.updateMany(
      { flexEventId: e._id, response: 'PAUSE' },
      { $set: { kwhShifted, peakReducedKw: peakReducedKwPerHousehold, earned: PROGRAM.perEventIncentive } },
    );
    await this.db.responses.updateMany(
      { flexEventId: e._id, response: { $ne: 'PAUSE' } },
      { $set: { kwhShifted: 0, peakReducedKw: 0, earned: null } },
    );
    const paused = await this.db.responses.countDocuments({ flexEventId: e._id, response: 'PAUSE' });
    await this.stats.recompute(e.campaignId);
    this.broadcast(updated);
    const sub = e.districtCode.replace(/-F\d+$/, '');
    await this.liveEvents.create({
      kind: 'FLEX_EVENT_ENDED',
      gridAreaCode: sub,
      districtCode: e.districtCode,
      headline: `flex event ended on ${e.districtCode}`,
      summary: `${paused} homes paused charging · peak cut by ${peakReducedMw(paused)} MW`,
      count: paused,
      unenrolledCount: null,
      enrolledCount: e.targetCustomerIds.length,
      actionTaken: null,
      suggested: null,
    });
    return FlexEventsService.toDto(updated);
  }

  async resultMe(customerId: string, id: string): Promise<FlexEventResultMe> {
    const e = await this.load(id);
    this.assertTarget(e, customerId);
    if (e.status !== 'ENDED') throw new ConflictException('Results are available after the event ends');
    const r = await this.db.responses.findOne({ flexEventId: e._id, customerId: new Types.ObjectId(customerId) }).lean();
    const paused = await this.db.responses.countDocuments({ flexEventId: e._id, response: 'PAUSE' });
    const c = await this.energy.customer(customerId);
    // Chart the planned window so the shape reads clearly even when the demo ends the event early.
    const plannedEnd = new Date(e.windowStart.getTime() + (e.plannedHours || 3) * 3600000);
    return {
      event: FlexEventsService.toDto(e),
      myResponse: r?.response ?? null,
      earnedText: r?.response === 'PAUSE' ? PROGRAM.perEventIncentive : null,
      kwhShifted: r?.kwhShifted ?? 0,
      peakReducedKw: r?.peakReducedKw ?? 0,
      series: this.energy.seriesAround(c, e.windowStart, plannedEnd, r?.response === 'PAUSE'),
      districtHouseholdsPaused: paused,
      districtPeakReducedMw: round3((paused * EV_CHARGE_KW) / 1000),
    };
  }

  /** The event a customer should see on Home: not ended, or ended within the last 2 hours. */
  async activeForCustomer(customerId: string): Promise<ActiveFlexEventRef | null> {
    const cid = new Types.ObjectId(customerId);
    const cutoff = new Date(Date.now() - 2 * 3600000);
    const e = await this.db.flexEvents
      .findOne({ targetCustomerIds: cid, $or: [{ status: { $ne: 'ENDED' } }, { windowEnd: { $gte: cutoff } }] })
      .sort({ _id: -1 })
      .lean();
    if (!e) return null;
    return {
      id: String(e._id),
      title: e.title,
      windowStart: e.windowStart.toISOString(),
      windowEnd: e.windowEnd.toISOString(),
      status: e.status,
      myResponse: await this.myResponse(e, customerId),
    };
  }

  async latestOpen(): Promise<FlexEvent | null> {
    const e = await this.db.flexEvents.findOne({ status: { $ne: 'ENDED' } }).sort({ _id: -1 }).lean();
    return e ? FlexEventsService.toDto(e) : null;
  }

  async list(): Promise<FlexEvent[]> {
    const es = await this.db.flexEvents.find().sort({ _id: -1 }).limit(50).lean();
    return es.map((e) => FlexEventsService.toDto(e));
  }

  /** Staff view of one event, or null when it does not exist. */
  async getDto(id: Types.ObjectId | string | null | undefined): Promise<FlexEvent | null> {
    if (!id || !Types.ObjectId.isValid(String(id))) return null;
    const e = await this.db.flexEvents.findById(String(id)).lean();
    return e ? FlexEventsService.toDto(e) : null;
  }

  async loadDoc(id: Types.ObjectId): Promise<FlexEventDoc | null> {
    return this.db.flexEvents.findById(id).lean();
  }
}
