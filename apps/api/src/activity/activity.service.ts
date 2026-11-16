import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { activityCategory, type ActivityQuery, type CustomerActivity, type CustomerActivityKind } from '@engie/shared';
import { Db } from '../db/db.service.js';
import type { CustomerActivityDoc, CustomerDoc } from '../db/schemas.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ViewThrottle } from './throttle.js';

export const MAX_ACTIVITY_LIMIT = 200;

/** Longest assistant question kept in a summary. */
const MAX_SUMMARY = 140;

export function clip(s: string, max = MAX_SUMMARY): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** What customers do in the mobile app; every entry is pushed live to staff (`activity:new`). */
@Injectable()
export class ActivityService {
  private readonly log = new Logger('Activity');
  private readonly throttle = new ViewThrottle();

  constructor(
    private readonly db: Db,
    private readonly realtime: RealtimeService,
  ) {}

  static toDto(d: CustomerActivityDoc): CustomerActivity {
    return {
      id: String(d._id),
      at: d.at.toISOString(),
      customerId: String(d.customerId),
      customerName: d.customerName,
      districtCode: d.districtCode ?? null,
      kind: d.kind,
      category: d.category,
      summary: d.summary,
    };
  }

  /**
   * Record and broadcast. Never throws: tracking must not break the action it describes, so callers
   * fire and forget (`void this.activity.record(...)`).
   */
  async record(customerId: string, kind: CustomerActivityKind, summary: string): Promise<void> {
    try {
      if (!Types.ObjectId.isValid(customerId) || !this.throttle.allow(customerId, kind)) return;
      const c = await this.db.customers.findById(customerId, { firstName: 1, lastName: 1, districtCode: 1, synthetic: 1 }).lean();
      if (!c || c.synthetic) return;
      const doc = await this.db.activity.create({
        at: new Date(),
        customerId: c._id,
        customerName: `${c.firstName} ${c.lastName}`.trim(),
        districtCode: c.districtCode ?? null,
        kind,
        category: activityCategory(kind),
        summary: clip(summary),
      });
      this.realtime.toStaff('activity:new', ActivityService.toDto(doc.toObject()));
    } catch (err) {
      this.log.warn(`could not record ${kind}: ${String(err)}`);
    }
  }

  /** Newest first. */
  async list(q: ActivityQuery = {}): Promise<CustomerActivity[]> {
    const n = Math.min(MAX_ACTIVITY_LIMIT, Math.max(1, Math.floor(q.limit ?? 100)));
    const filter: Record<string, unknown> = {};
    if (q.customerId) filter.customerId = new Types.ObjectId(q.customerId);
    if (q.category) filter.category = q.category;
    const docs = await this.db.activity.find(filter).sort({ at: -1, _id: -1 }).limit(n).lean();
    return docs.map((d) => ActivityService.toDto(d));
  }

  /** The customer plus their whole timeline (newest first). */
  async forCustomer(customerId: string): Promise<{ customer: CustomerDoc; activity: CustomerActivity[] }> {
    const c = await this.db.customers.findById(customerId).lean();
    if (!c || c.synthetic) throw new NotFoundException('Customer not found');
    return { customer: c, activity: await this.list({ customerId, limit: MAX_ACTIVITY_LIMIT }) };
  }

  /** Demo reset wipes the collection; forget recent views too so the first view after a reset shows. */
  reset() {
    this.throttle.clear();
  }
}
