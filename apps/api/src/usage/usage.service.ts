import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BENCHMARK,
  annualUsage,
  applianceBreakdown,
  baseloadW,
  lastMonthSummary,
  peakSplit,
  thisMonth,
  tomorrowPrices,
  usageSeries,
  type UsageOverview,
  type UsagePeriod,
  type UsageProfile,
  type UsageSeriesResponse,
} from '@engie/shared';
import { Db } from '../db/db.service.js';
import type { CustomerDoc } from '../db/schemas.js';

/** The usage-model inputs for a customer document. */
export function usageProfile(c: Pick<CustomerDoc, 'usage' | 'evSince' | 'contract'>): UsageProfile {
  return {
    seed: c.usage.seed,
    elecScale: c.usage.elecScale,
    gasScale: c.usage.gasScale,
    evSince: c.evSince ? new Date(c.evSince).toISOString() : null,
    elecPrice: c.contract.electricity.avgPrice,
    gasPrice: c.contract.gas.price,
    fixedPerMonth: c.contract.fixedPerMonth,
  };
}

/** Smart-meter history and the Net2Grid breakdown, computed from the customer's usage profile. */
@Injectable()
export class UsageService {
  constructor(private readonly db: Db) {}

  async customer(customerId: string): Promise<CustomerDoc> {
    const c = await this.db.customers.findById(customerId).lean();
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }

  series(c: CustomerDoc, period: UsagePeriod, now = new Date()): UsageSeriesResponse {
    return { period, points: usageSeries(usageProfile(c), period, now) };
  }

  overview(c: CustomerDoc, now = new Date()): UsageOverview {
    const p = usageProfile(c);
    return {
      thisMonth: thisMonth(p, now),
      lastMonth: lastMonthSummary(p, now),
      breakdown: applianceBreakdown(p, now, c.hasHeatPump),
      peakSplit: peakSplit(p, now),
      benchmark: BENCHMARK,
      baseloadW: baseloadW(p),
      annual: annualUsage(p, now),
      tomorrowPrices: tomorrowPrices(),
    };
  }
}
