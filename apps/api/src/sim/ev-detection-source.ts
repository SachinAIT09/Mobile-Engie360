import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { Db } from '../db/db.service.js';
import type { CustomerDoc, EvDetectionDoc } from '../db/schemas.js';

/**
 * Where EV detections come from. In production this would be the Net2Grid feed;
 * the demo uses SimulatedNet2GridSource, driven from the /demo control panel.
 */
export abstract class EvDetectionSource {
  /** Record (or return the existing) detection for a customer's premise. */
  abstract detect(customer: CustomerDoc): Promise<{ detection: EvDetectionDoc; isNew: boolean }>;
}

@Injectable()
export class SimulatedNet2GridSource extends EvDetectionSource {
  constructor(private readonly db: Db) {
    super();
  }

  async detect(c: CustomerDoc): Promise<{ detection: EvDetectionDoc; isNew: boolean }> {
    const existing = await this.db.detections.findOne({ customerId: c._id, status: 'DETECTED' }).lean();
    if (existing) return { detection: existing, isNew: false };
    const doc = await this.db.detections.create({
      _id: new Types.ObjectId(),
      premiseId: c.premiseId,
      customerId: c._id,
      districtCode: c.districtCode,
      gridAreaCode: c.gridAreaCode,
      firstDetectedAt: new Date(),
      source: 'NET2GRID',
      status: 'DETECTED',
    });
    // The usage history shows EV charging from the moment Net2Grid first sees it.
    if (!c.evSince) await this.db.customers.updateOne({ _id: c._id }, { $set: { evSince: new Date(Date.now() - 80 * 86400000) } });
    return { detection: doc.toObject(), isNew: true };
  }
}
