/**
 * Pure seed helpers: how a gridArea's EV total is split across its districts, and which region a
 * gridArea belongs to. No I/O, so they can be unit-tested.
 */
import type { LiveDistrictSpec } from './seed-data.js';

export interface DistrictAllocation {
  code: string;
  /** EVs on this district: known + unenrolled for live districts, a static count otherwise. */
  evs: number;
  live: boolean;
}

/**
 * Splits `totalEvs` across `${gridAreaCode}-F1..Fn`. Live districts (per-customer data) keep their
 * seeded known + unenrolled; the remainder is spread over the static districts with descending weights
 * (F1 gets the most), at least 1 per static district when the remainder allows, and the sum always
 * equals `totalEvs`.
 */
export function allocateDistrictEvs(
  gridAreaCode: string,
  totalEvs: number,
  districtCount: number,
  liveDistricts: Record<string, LiveDistrictSpec>,
): DistrictAllocation[] {
  const codes = Array.from({ length: districtCount }, (_, k) => `${gridAreaCode}-F${k + 1}`);
  const liveEvs = codes.reduce((s, c) => s + (liveDistricts[c] ? liveDistricts[c].known + liveDistricts[c].unenrolled : 0), 0);
  const staticCodes = codes.filter((c) => !liveDistricts[c]);
  const remaining = totalEvs - liveEvs;
  const weights = staticCodes.map((_, k) => staticCodes.length - k);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const alloc = weights.map((w) => Math.max(1, Math.floor((remaining * w) / wsum)));
  let diff = remaining - alloc.reduce((a, b) => a + b, 0);
  // Hand out (or take back) the rounding difference one EV at a time, round-robin.
  for (let k = 0, guard = 0; diff !== 0 && staticCodes.length && guard < 10000; k = (k + 1) % staticCodes.length, guard++) {
    if (diff > 0) {
      alloc[k]++;
      diff--;
    } else if (alloc[k] > 1) {
      alloc[k]--;
      diff++;
    }
  }
  return codes.map((code) => {
    const live = liveDistricts[code];
    return live
      ? { code, evs: live.known + live.unenrolled, live: true }
      : { code, evs: alloc[staticCodes.indexOf(code)], live: false };
  });
}

/** Service regions, assigned round-robin by gridArea index (SUB-01 is Central). */
export const REGIONS = ['Central', 'East', 'Northwest', 'South'] as const;
export type Region = (typeof REGIONS)[number];

export function regionForIndex(index: number): Region {
  return REGIONS[((index % REGIONS.length) + REGIONS.length) % REGIONS.length];
}
