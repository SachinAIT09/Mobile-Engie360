import { describe, expect, it } from 'vitest';
import { allocateDistrictEvs } from './allocate.js';
import { DISTRICT_AREA, GRID_AREAS, LIVE_DISTRICTS } from './seed-data.js';

describe('allocateDistrictEvs', () => {
  it('sums to the grid area total for every seeded area', () => {
    for (const g of GRID_AREAS) {
      const codes = g.districts.map(([pc]) => pc);
      const alloc = allocateDistrictEvs(codes, g.evs, LIVE_DISTRICTS);
      expect(alloc).toHaveLength(codes.length);
      expect(alloc.reduce((s, a) => s + a.evs, 0), g.code).toBe(g.evs);
      for (const a of alloc) expect(a.evs, a.code).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps live districts at known + unenrolled (Utrecht-Oost is fully live)', () => {
    const ut = GRID_AREAS.find((g) => g.code === 'UT-OOST')!;
    const alloc = allocateDistrictEvs(ut.districts.map(([pc]) => pc), ut.evs, LIVE_DISTRICTS);
    expect(alloc.find((a) => a.code === '3581')).toEqual({ code: '3581', evs: 146, live: true });
    expect(alloc.every((a) => a.live)).toBe(true);
  });

  it('gives static districts descending counts that add up', () => {
    const alloc = allocateDistrictEvs(['1071', '1072', '1073', '1075'], 436, {});
    const evs = alloc.map((a) => a.evs);
    expect(evs).toEqual([...evs].sort((a, b) => b - a));
    expect(evs.reduce((s, n) => s + n, 0)).toBe(436);
  });
});

describe('seed data', () => {
  it('places every live district in a known grid area', () => {
    for (const pc of Object.keys(LIVE_DISTRICTS)) expect(DISTRICT_AREA[pc], pc).toBeDefined();
  });

  it('uses unique postcode districts', () => {
    const all = GRID_AREAS.flatMap((g) => g.districts.map(([pc]) => pc));
    expect(new Set(all).size).toBe(all.length);
  });
});
