import { Injectable, NotFoundException } from '@nestjs/common';
import type { BlindSpot, DeadGridArea, DistrictStat, StatsOverview, GridAreaStat } from '@engie/shared';
import { Db } from '../db/db.service.js';
import type { DistrictDoc } from '../db/schemas.js';
import { INSTALLMENT_GAP_MIN } from '../campaigns/audience-label.js';
import { HEADLINE } from '../seed/seed-data.js';
import { EMPTY_COUNTS, rankBlindSpots, toDistrictStat, type LiveCounts } from './district-stat.js';

export { toDistrictStat, rankBlindSpots, type LiveCounts } from './district-stat.js';

/** District visibility numbers. Live districts are computed from customer data; others are static seed stats. */
@Injectable()
export class GridService {
  constructor(private readonly db: Db) {}

  /** Live counts for the given districts (or every live district). */
  async liveCounts(districtCodes?: string[]): Promise<Map<string, LiveCounts>> {
    const filter = districtCodes ? { districtCode: { $in: districtCodes } } : {};
    const [enrolled, detected, gtCustomers, gap] = await Promise.all([
      this.db.enrollments.find({ ...filter, status: 'ACTIVE' }, { customerId: 1, districtCode: 1 }).lean(),
      this.db.detections.find({ ...filter, status: 'DETECTED' }, { customerId: 1, districtCode: 1 }).lean(),
      this.db.customers.find({ ...filter, groundTruthValidated: true }, { _id: 1, districtCode: 1 }).lean(),
      this.db.customers.aggregate<{ _id: string; n: number }>([
        { $match: { ...filter, $expr: { $gte: [{ $subtract: ['$contract.advisedInstallment', '$contract.installment'] }, INSTALLMENT_GAP_MIN] } } },
        { $group: { _id: '$districtCode', n: { $sum: 1 } } },
      ]),
    ]);
    const map = new Map<string, LiveCounts>();
    const get = (f: string) => {
      let v = map.get(f);
      if (!v) map.set(f, (v = { known: 0, unenrolled: 0, confirmed: 0, groundTruth: 0, installmentGap: 0 }));
      return v;
    };
    const enrolledSet = new Set(enrolled.map((e) => String(e.customerId)));
    const detectedSet = new Set(detected.map((d) => String(d.customerId)));
    for (const e of enrolled) {
      const v = get(e.districtCode);
      v.known++;
      if (detectedSet.has(String(e.customerId))) v.confirmed++;
    }
    for (const d of detected) if (!enrolledSet.has(String(d.customerId))) get(d.districtCode).unenrolled++;
    for (const g of gap) get(g._id).installmentGap = g.n;
    for (const c of gtCustomers) {
      const id = String(c._id);
      if (enrolledSet.has(id) || detectedSet.has(id)) get(c.districtCode).groundTruth++;
    }
    return map;
  }

  private toDistrictStat(f: DistrictDoc, live?: LiveCounts): DistrictStat {
    return toDistrictStat(f, live);
  }

  async district(code: string): Promise<DistrictStat> {
    const f = await this.db.districts.findOne({ code }).lean();
    if (!f) throw new NotFoundException(`District ${code} not found`);
    const live = f.live ? (await this.liveCounts([code])).get(code) : undefined;
    return this.toDistrictStat(f, live);
  }

  async gridAreaDistricts(code: string): Promise<DistrictStat[]> {
    const fs = await this.db.districts.find({ gridAreaCode: code }).sort({ order: 1 }).lean();
    if (!fs.length) throw new NotFoundException(`GridArea ${code} not found`);
    const live = await this.liveCounts(fs.filter((f) => f.live).map((f) => f.code));
    return fs.map((f) => this.toDistrictStat(f, live.get(f.code)));
  }

  /** Per-gridArea deltas from live districts vs. their seed counts. */
  private async deltas(): Promise<{ bySub: Map<string, { known: number; unenrolled: number }>; known: number; unenrolled: number }> {
    const liveDistricts = await this.db.districts.find({ live: true }).lean();
    const counts = await this.liveCounts(liveDistricts.map((f) => f.code));
    const bySub = new Map<string, { known: number; unenrolled: number }>();
    let known = 0;
    let unenrolled = 0;
    for (const f of liveDistricts) {
      const c = counts.get(f.code) ?? EMPTY_COUNTS;
      const dk = c.known - f.seedKnown;
      const du = c.unenrolled - f.seedUnenrolled;
      known += dk;
      unenrolled += du;
      const s = bySub.get(f.gridAreaCode) ?? { known: 0, unenrolled: 0 };
      s.known += dk;
      s.unenrolled += du;
      bySub.set(f.gridAreaCode, s);
    }
    return { bySub, known, unenrolled };
  }

  async gridAreas(): Promise<GridAreaStat[]> {
    const [subs, d] = await Promise.all([this.db.gridAreas.find().lean(), this.deltas()]);
    return subs
      .map((s) => {
        const delta = d.bySub.get(s.code) ?? { known: 0, unenrolled: 0 };
        const evs = s.seedEvs + delta.known + delta.unenrolled;
        const known = s.seedKnown + delta.known;
        return {
          code: s.code,
          name: s.name ?? s.code,
          operator: s.operator ?? '',
          congestion: s.congestion ?? ('NONE' as const),
          region: s.region,
          evs,
          knownPct: evs ? Math.round((known / evs) * 100) : 0,
          penetrationPct: s.penetrationPct,
          districtCount: s.districtCount,
          interactive: s.interactive,
        };
      })
      .sort((a, b) => b.evs - a.evs || a.code.localeCompare(b.code));
  }

  async overview(): Promise<StatsOverview> {
    const [d, subs, districtDocs, cfg] = await Promise.all([
      this.deltas(),
      this.gridAreas(),
      this.db.districts.find().lean(),
      this.db.config.findOne({ key: 'main' }).lean(),
    ]);
    const liveCounts = await this.liveCounts(districtDocs.filter((f) => f.live).map((f) => f.code));
    const districtsWithEvs = districtDocs.filter((f) => {
      if (!f.live) return f.staticEvs > 0;
      const c = liveCounts.get(f.code);
      return !!c && c.known + c.unenrolled > 0;
    }).length;
    const knownEvs = HEADLINE.knownEvs + d.known;
    const unenrolledEvs = HEADLINE.unenrolledEvs + d.unenrolled;
    const dead = subs.filter((s) => s.evs === 0).length;
    const [liveCustomers, liveDynamic, liveHeat] = await Promise.all([
      this.db.customers.countDocuments({}),
      this.db.customers.countDocuments({ 'contract.product': { $in: ['DYNAMIC', 'DYNAMIC_FIXED_GAS'] } }),
      this.db.customers.countDocuments({ hasHeatPump: true }),
    ]);
    const liveGap = [...liveCounts.values()].reduce((s, c) => s + (c.installmentGap ?? 0), 0);
    return {
      // Headline portfolio figures plus what the live (per-customer) districts add or change.
      customers: HEADLINE.customers + liveCustomers,
      onDynamic: HEADLINE.onDynamic + liveDynamic,
      installmentGapCustomers: HEADLINE.installmentGapCustomers + liveGap,
      avgInstallmentGap: HEADLINE.avgInstallmentGap,
      heatPumps: HEADLINE.heatPumps + liveHeat,
      slimLadenHomes: knownEvs,
      gridAreas: subs.filter((s) => s.evs > 0).length,
      districts: districtsWithEvs,
      knownEvs,
      unenrolledEvs,
      invisiblePct: Math.round((unenrolledEvs / (knownEvs + unenrolledEvs)) * 100),
      matchedPremises: cfg?.matchedPremises ?? HEADLINE.matchedPremises,
      noSignalPremises: cfg?.noSignalPremises ?? HEADLINE.noSignalPremises,
      noLocationPremises: cfg?.noLocationPremises ?? HEADLINE.noLocationPremises,
      deadGridAreas: dead,
      partiallyDeadGridAreas: cfg?.partiallyDeadGridAreas ?? HEADLINE.partiallyDeadGridAreas,
      deadDistricts: cfg?.deadDistricts ?? HEADLINE.deadDistricts,
      deadDistrictPremises: cfg?.deadDistrictPremises ?? HEADLINE.deadDistrictPremises,
      dataSourceNote: cfg?.dataSourceNote ?? HEADLINE.dataSourceNote,
    };
  }

  /** Districts with ≥15 EVs ranked by share invisible to enrollment (top 8). */
  async blindSpots(): Promise<BlindSpot[]> {
    const liveDistricts = await this.db.districts.find({ live: true }).lean();
    const [counts, subs] = await Promise.all([
      this.liveCounts(liveDistricts.map((f) => f.code)),
      this.db.gridAreas.find({}, { code: 1, region: 1 }).lean(),
    ]);
    const regionOf = new Map(subs.map((s) => [s.code, s.region]));
    return rankBlindSpots(
      liveDistricts.map((f) => this.toDistrictStat(f, counts.get(f.code))),
      (code) => regionOf.get(code),
    );
  }

  async deadGridAreas(): Promise<DeadGridArea[]> {
    const subs = await this.db.gridAreas.find({ dead: true }).lean();
    return subs
      .map((s) => ({ code: s.code, districts: s.districtCount, premises: s.deadPremises }))
      .sort((a, b) => b.premises - a.premises || b.districts - a.districts || a.code.localeCompare(b.code));
  }

  /** Known (enrolled) EVs on a district — used for the {neighbours_enrolled} merge field. */
  async knownOnDistrict(districtCode: string): Promise<number> {
    return this.db.enrollments.countDocuments({ districtCode, status: 'ACTIVE' });
  }
}
