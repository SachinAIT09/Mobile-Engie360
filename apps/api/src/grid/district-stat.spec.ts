import { describe, expect, it } from 'vitest';
import type { DistrictDoc } from '../db/schemas.js';
import { BLIND_SPOT_LIMIT, DEFAULT_REGION, EMPTY_COUNTS, rankBlindSpots, toDistrictStat, type LiveCounts } from './district-stat.js';

function district(code: string, over: Partial<DistrictDoc> = {}): DistrictDoc {
  return {
    code,
    name: `Wijk ${code}`,
    gridAreaCode: 'UT-OOST',
    order: Number(code) % 100,
    live: true,
    premisesCount: 665,
    capacityKw: 5000,
    forecastLoadPct: null,
    staticEvs: 0,
    seedKnown: 0,
    seedUnenrolled: 0,
    ...over,
  };
}

const counts = (known: number, unenrolled: number, confirmed = 0, groundTruth = 0): LiveCounts => ({ known, unenrolled, confirmed, groundTruth });

describe('toDistrictStat', () => {
  it('computes the 3581 figures: 69 known + 77 unenrolled on 665 premises', () => {
    const s = toDistrictStat(district('3581', { name: 'Oudwijk' }), { ...counts(69, 77, 54, 23), installmentGap: 12 });
    expect(s).toMatchObject({
      code: '3581',
      name: 'Oudwijk',
      gridAreaCode: 'UT-OOST',
      installmentGap: 12,
      evs: 146,
      known: 69,
      unenrolled: 77,
      confirmedByEnrollment: 54,
      groundTruthValidated: 23,
      premises: 665,
      penetrationPct: 22,
      invisiblePct: 52.7,
      forecastLoadPct: null,
    });
  });

  it('rounds penetration and invisible share half-to-even at one decimal', () => {
    // 1 / 400 = 0.25% → 0.2 (half, even); 3 / 400 = 0.75% → 0.8 (half, odd rounds up)
    expect(toDistrictStat(district('3581', { premisesCount: 400 }), counts(1, 0)).penetrationPct).toBe(0.2);
    expect(toDistrictStat(district('3581', { premisesCount: 400 }), counts(2, 1)).penetrationPct).toBe(0.8);
    // 1 of 8 invisible = 12.5% → 12.5 is not a half at one decimal; 1 of 16 = 6.25% → 6.2
    expect(toDistrictStat(district('3581'), counts(7, 1)).invisiblePct).toBe(12.5);
    expect(toDistrictStat(district('3581'), counts(15, 1)).invisiblePct).toBe(6.2);
    // 3 of 16 = 18.75% → 18.8
    expect(toDistrictStat(district('3581'), counts(13, 3)).invisiblePct).toBe(18.8);
  });

  it('treats a live district with no counts as empty, and no EVs as 0% invisible', () => {
    const s = toDistrictStat(district('3581'));
    expect(s).toMatchObject({ evs: 0, known: 0, unenrolled: 0, penetrationPct: 0, invisiblePct: 0, installmentGap: 0 });
    expect(toDistrictStat(district('3581'), EMPTY_COUNTS)).toEqual(s);
  });

  it('has no penetration when the premises count is unknown', () => {
    expect(toDistrictStat(district('3581', { premisesCount: null }), counts(5, 5)).penetrationPct).toBeNull();
    expect(toDistrictStat(district('3581', { premisesCount: null }), counts(5, 5)).premises).toBeNull();
  });

  it('passes static districts through with null visibility fields', () => {
    const s = toDistrictStat(district('1071', { gridAreaCode: 'AMS-ZUID', name: 'Museumkwartier', live: false, staticEvs: 41, forecastLoadPct: 92 }), counts(9, 9));
    expect(s).toEqual({
      code: '1071',
      name: 'Museumkwartier',
      gridAreaCode: 'AMS-ZUID',
      installmentGap: null,
      evs: 41,
      known: null,
      unenrolled: null,
      confirmedByEnrollment: null,
      groundTruthValidated: null,
      premises: null,
      penetrationPct: null,
      invisiblePct: null,
      forecastLoadPct: 92,
    });
  });
});

describe('rankBlindSpots', () => {
  // Seven UT-OOST districts (known / unenrolled / premises).
  const seeded = [
    toDistrictStat(district('3581', { premisesCount: 665 }), counts(69, 77)),
    toDistrictStat(district('3582', { premisesCount: 650 }), counts(46, 44)),
    toDistrictStat(district('3583', { premisesCount: 500 }), counts(38, 35)),
    toDistrictStat(district('3584', { premisesCount: 460 }), counts(15, 34)),
    toDistrictStat(district('3585', { premisesCount: 300 }), counts(23, 21)),
    toDistrictStat(district('3571', { premisesCount: 250 }), counts(19, 19)),
    toDistrictStat(district('3572', { premisesCount: 170 }), counts(12, 11)),
  ];

  it('ranks by share invisible, descending, with 1-based ranks', () => {
    const ranked = rankBlindSpots(seeded);
    // gaps: 3584 69.4, 3581 52.7, 3571 50, 3582 48.9, 3583 47.9, 3572 47.8, 3585 47.7
    expect(ranked.map((b) => b.districtCode)).toEqual(['3584', '3581', '3571', '3582', '3583', '3572', '3585']);
    expect(ranked.map((b) => b.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(ranked[0]).toMatchObject({ name: 'Wijk 3584', gridAreaCode: 'UT-OOST', known: 15, unenrolled: 34, gapPct: 69.4, penetrationText: '10.7% of 460', region: DEFAULT_REGION });
    expect(ranked[1].gapPct).toBe(52.7);
    expect(ranked[1].penetrationText).toBe('22% of 665');
  });

  it('breaks gap ties by EV count, larger first', () => {
    const tied = [
      toDistrictStat(district('3581', { premisesCount: 100 }), counts(10, 10)),
      toDistrictStat(district('3582', { premisesCount: 100 }), counts(20, 20)),
    ];
    expect(rankBlindSpots(tied).map((b) => b.districtCode)).toEqual(['3582', '3581']);
  });

  it('drops districts with fewer than 15 EVs and static districts', () => {
    const stats = [
      toDistrictStat(district('3581'), counts(7, 7)), // 14 EVs
      toDistrictStat(district('3582'), counts(5, 10)), // 15 EVs
      toDistrictStat(district('3583', { live: false, staticEvs: 400 })),
    ];
    expect(rankBlindSpots(stats).map((b) => b.districtCode)).toEqual(['3582']);
  });

  it('returns at most eight entries', () => {
    const many = Array.from({ length: 12 }, (_, i) => toDistrictStat(district(String(3581 + i)), counts(20, 20 + i)));
    const ranked = rankBlindSpots(many);
    expect(ranked).toHaveLength(BLIND_SPOT_LIMIT);
    expect(ranked[0].districtCode).toBe('3592');
  });

  it('looks up the region per gridArea', () => {
    const ranked = rankBlindSpots(seeded, (code) => (code === 'UT-OOST' ? 'Gelderland' : undefined));
    expect(ranked.every((b) => b.region === 'Gelderland')).toBe(true);
  });
});
