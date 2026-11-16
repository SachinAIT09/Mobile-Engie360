import { describe, expect, it } from 'vitest';
import { audienceLabel, distinctDistricts } from './audience-label.js';

describe('audienceLabel', () => {
  it('labels a single district', () => {
    expect(audienceLabel({ kind: 'DISTRICT', districtCode: 'SUB-01-F1', segment: 'UNENROLLED_EV' })).toBe('SUB-01-F1 · Detected, unenrolled EVs');
  });

  it('labels two districts in full and more as +n, ignoring duplicates', () => {
    expect(audienceLabel({ kind: 'DISTRICTS', districtCodes: ['SUB-01-F1', 'SUB-01-F2'], segment: 'ENROLLED_EV' })).toBe(
      'SUB-01-F1, SUB-01-F2 · Enrolled EVs (DR program)',
    );
    expect(
      audienceLabel({ kind: 'DISTRICTS', districtCodes: ['SUB-01-F1', 'SUB-01-F2', 'SUB-01-F3', 'SUB-01-F2', 'SUB-02-F1'], segment: 'ENROLLED_EV' }),
    ).toBe('SUB-01-F1, SUB-01-F2 +2 · Enrolled EVs (DR program)');
  });

  it('labels a live-event cluster by its gridArea', () => {
    expect(audienceLabel({ kind: 'LIVE_EVENT', liveEventId: 'x', segment: 'UNENROLLED_EV' }, 'SUB-01')).toBe(
      'SUB-01 stopped-charging cluster · Detected, unenrolled EVs',
    );
  });

  it('dedupes districts in order', () => {
    expect(distinctDistricts(['b', 'a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
