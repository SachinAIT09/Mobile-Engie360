import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PROGRAM, fmtWindow, type LiveEvent, type NotifyPreset, type SimNotifyResult } from '@engie/shared';
import { Db } from '../db/db.service.js';
import type { CustomerDoc } from '../db/schemas.js';
import type { AuditActor } from '../audit/audit.service.js';
import { CampaignsService } from '../campaigns/campaigns.service.js';
import { prng } from '../common/numbers.js';
import { addMinutes, fmtClock, fmtClockRange, nextEventWindow } from '../common/time.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { LiveEventsService } from '../live-events/live-events.service.js';
import { MessagesService } from '../messages/messages.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { EvDetectionSource } from './ev-detection-source.js';
import { CAMPAIGN_COPY, isPlainPreset, notifyCopy } from './notify-copy.js';

const CLUSTER_TOTAL = 284;
const CLUSTER_UNENROLLED = 118;

@Injectable()
export class SimService {
  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
    private readonly source: EvDetectionSource,
    private readonly enrollments: EnrollmentsService,
    private readonly messages: MessagesService,
    private readonly liveEvents: LiveEventsService,
    private readonly campaigns: CampaignsService,
  ) {}

  private async customer(id: string): Promise<CustomerDoc> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid customerId');
    const c = await this.db.customers.findById(id).lean();
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  /** Flow A: Net2Grid detects an EV charging at this customer's home. */
  async evDetected(customerId: string): Promise<LiveEvent> {
    const c = await this.customer(customerId);
    await this.source.detect(c);
    await this.db.customers.updateOne({ _id: c._id }, { $set: { evChargingActive: true } });
    const enrolled = await this.enrollments.isEnrolled(c._id);
    const street = c.address.split(',')[0];
    if (!enrolled) {
      await this.messages.create(
        {
          customerId: c._id,
          kind: 'EV_DETECTED',
          category: 'Offers',
          tag: 'EV',
          title: 'We noticed an EV charging at your home',
          body: `Earn ${PROGRAM.signupIncentive} by joining ${PROGRAM.name}. Tap to learn more.`,
          cta: 'See program & enroll',
          campaignId: null,
          flexEventId: null,
          route: '/program',
        },
        { popup: true },
      );
    } else {
      this.realtime.toCustomer(customerId, 'me:changed');
    }
    this.realtime.toStaff('district:statsChanged', { gridAreaCode: c.gridAreaCode, districtCode: c.districtCode });
    return this.liveEvents.create({
      kind: 'EV_DETECTED',
      gridAreaCode: c.gridAreaCode,
      districtCode: c.districtCode,
      headline: 'New EV detected',
      summary: `at ${street} (${c.districtCode}), ${enrolled ? 'already enrolled' : 'not enrolled'}`,
      count: 1,
      unenrolledCount: enrolled ? 0 : 1,
      enrolledCount: enrolled ? 1 : 0,
      actionTaken: enrolled ? null : 'Onboarding message sent in app automatically',
      suggested: null,
      customerIds: [c._id],
    });
  }

  /** Flow B: a cluster of EVs on a gridArea stops charging at the same time. */
  async stoppedChargingCluster(gridAreaCode: string): Promise<LiveEvent> {
    const sub = await this.db.gridAreas.findOne({ code: gridAreaCode }).lean();
    if (!sub) throw new NotFoundException(`GridArea ${gridAreaCode} not found`);

    // Make sure the unenrolled demo customer on this gridArea is part of the cluster.
    const demo = await this.db.customers.findOne({ gridAreaCode, demoRole: 'UNENROLLED_DEMO' }).lean();
    const chosen: Types.ObjectId[] = [];
    if (demo && !(await this.enrollments.isEnrolled(demo._id))) {
      const { isNew } = await this.source.detect(demo);
      if (isNew) this.realtime.toCustomer(String(demo._id), 'me:changed');
      chosen.push(demo._id);
    }
    const enrolledIds = (await this.db.enrollments.find({ gridAreaCode, status: 'ACTIVE' }, { customerId: 1 }).lean()).map((e) => String(e.customerId));
    const enrolledSet = new Set(enrolledIds);
    const pool = (await this.db.detections.find({ gridAreaCode, status: 'DETECTED' }, { customerId: 1 }).lean())
      .map((d) => d.customerId)
      .filter((id) => !enrolledSet.has(String(id)) && !chosen.some((x) => String(x) === String(id)));
    const rnd = prng(Date.now() & 0xffffffff);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    chosen.push(...pool.slice(0, Math.max(0, CLUSTER_UNENROLLED - chosen.length)));
    const now = new Date();
    const from = new Date(Math.floor(addMinutes(now, -12).getTime() / 300000) * 300000);
    const to = new Date(Math.ceil(addMinutes(now, 3).getTime() / 300000) * 300000);
    this.realtime.toStaff('district:statsChanged', { gridAreaCode, districtCode: null });
    const le = await this.liveEvents.create({
      kind: 'STOPPED_CHARGING_CLUSTER',
      gridAreaCode,
      districtCode: null,
      headline: `${CLUSTER_TOTAL} EVs stopped charging`,
      summary: `on ${gridAreaCode} between ${fmtClockRange(from, to)} · ${chosen.length} not enrolled`,
      count: CLUSTER_TOTAL,
      unenrolledCount: chosen.length,
      enrolledCount: CLUSTER_TOTAL - chosen.length,
      actionTaken: null,
      suggested: null,
      customerIds: chosen,
    }, false);
    // Now that the id exists, attach the suggested action that targets this cluster.
    const suggested = {
      label: `Target ${chosen.length} with enrollment offer`,
      campaignType: 'ENROLL_OFFER' as const,
      audience: { kind: 'LIVE_EVENT' as const, liveEventId: le.id, segment: 'UNENROLLED_EV' as const },
    };
    await this.db.liveEvents.updateOne({ _id: new Types.ObjectId(le.id) }, { $set: { suggested } });
    const full = { ...le, suggested };
    this.liveEvents.emit(full);
    return full;
  }

  /** Flow C: load forecast on a district is close to its limit. */
  async districtForecastHigh(districtCode: string): Promise<LiveEvent> {
    const f = await this.db.districts.findOne({ code: districtCode }).lean();
    if (!f) throw new NotFoundException(`District ${districtCode} not found`);
    await this.db.districts.updateOne({ code: districtCode }, { $set: { forecastLoadPct: 92 } });
    const enrolled = await this.db.enrollments.countDocuments({ districtCode, status: 'ACTIVE' });
    const w = nextEventWindow();
    this.realtime.toStaff('district:statsChanged', { gridAreaCode: f.gridAreaCode, districtCode });
    return this.liveEvents.create({
      kind: 'DISTRICT_FORECAST_HIGH',
      gridAreaCode: f.gridAreaCode,
      districtCode,
      headline: `${districtCode} forecast at 92% of capacity`,
      summary: `, ${fmtWindow(w.start.toISOString(), w.end.toISOString())} · ${enrolled} enrolled EVs on this district`,
      count: enrolled,
      unenrolledCount: null,
      enrolledCount: enrolled,
      actionTaken: null,
      suggested: {
        label: 'Send stop-charging request',
        campaignType: 'FLEX_REQUEST',
        audience: { kind: 'DISTRICT', districtCode, segment: 'ENROLLED_EV' },
      },
    });
  }

  /** Quick send: one phone notification to a demo customer, picked from NOTIFY_PRESETS. */
  async notify(customerId: string, preset: NotifyPreset, actor: AuditActor): Promise<SimNotifyResult> {
    const c = await this.customer(customerId);
    if (!c.demoRole) throw new BadRequestException('Quick send only goes to the demo customers');
    const enrolled = await this.enrollments.isEnrolled(c._id);
    if (preset === 'EV_DETECTED') {
      const e = await this.evDetected(customerId);
      return { text: `${e.headline} ${e.summary}` };
    }
    if (preset === 'FLEX_REQUEST' || preset === 'ENROLL_OFFER') {
      if (preset === 'FLEX_REQUEST' && !enrolled) throw new BadRequestException(`${c.firstName} is not enrolled; stop-charging requests go to enrolled customers`);
      if (preset === 'ENROLL_OFFER' && enrolled) throw new BadRequestException(`${c.firstName} is already enrolled`);
      await this.campaigns.create(
        {
          type: preset,
          audience: { kind: 'DISTRICT', districtCode: c.districtCode, segment: preset === 'FLEX_REQUEST' ? 'ENROLLED_EV' : 'UNENROLLED_EV' },
          exclusions: { optedOut: false, contactedLast7Days: false, lifeSupport: false },
          ...CAMPAIGN_COPY[preset],
          channels: { push: true, inApp: true, sms: false, email: false },
          schedule: { sendNow: true, expiresInHours: 4 },
          testCustomerId: customerId,
        },
        actor,
      );
      return {
        text: preset === 'FLEX_REQUEST'
          ? `Stop-charging request sent to ${c.firstName}'s phone. Start and end the event on the DR events page (or E in the presenter bar).`
          : `Enrollment offer sent to ${c.firstName}'s phone.`,
      };
    }
    if (!isPlainPreset(preset)) throw new BadRequestException('Unknown preset');
    const w = nextEventWindow();
    const copy = notifyCopy(preset, { firstName: c.firstName, peakWindow: fmtWindow(w.start.toISOString(), w.end.toISOString()), clock: fmtClock(new Date()) });
    await this.messages.create({ customerId: c._id, campaignId: null, flexEventId: null, ...copy });
    return { text: `“${copy.title}” sent to ${c.firstName}'s phone.` };
  }
}
