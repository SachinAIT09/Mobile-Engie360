import { describe, expect, it } from 'vitest';
import { audienceLabel, distinctDistricts } from './audience-label.js';

describe('audienceLabel', () => {
  it('labels a single district', () => {
    expect(audienceLabel({ kind: 'DISTRICT', districtCode: '3581', segment: 'UNENROLLED_EV' })).toBe('3581 · Detected EVs, not in Slim Laden');
  });

  it('labels two districts in full and more as +n, ignoring duplicates', () => {
    expect(audienceLabel({ kind: 'DISTRICTS', districtCodes: ['3581', '3582'], segment: 'ENROLLED_EV' })).toBe(
      '3581, 3582 · Slim Laden customers',
    );
    expect(
      audienceLabel({ kind: 'DISTRICTS', districtCodes: ['3581', '3582', '3583', '3582', '3511'], segment: 'ENROLLED_EV' }),
    ).toBe('3581, 3582 +2 · Slim Laden customers');
  });

  it('labels a live-event cluster by its gridArea', () => {
    expect(audienceLabel({ kind: 'LIVE_EVENT', liveEventId: 'x', segment: 'UNENROLLED_EV' }, 'UT-OOST')).toBe(
      'UT-OOST new-EV cluster · Detected EVs, not in Slim Laden',
    );
  });

  it('labels the installment-gap segment and falls back when the live event has no grid area', () => {
    expect(audienceLabel({ kind: 'DISTRICT', districtCode: '3581', segment: 'INSTALLMENT_GAP' })).toBe('3581 · Installment below the advice');
    expect(audienceLabel({ kind: 'LIVE_EVENT', liveEventId: 'x', segment: 'ENROLLED_EV' })).toBe('Live event new-EV cluster · Slim Laden customers');
  });

  it('dedupes districts in order', () => {
    expect(distinctDistricts(['b', 'a', 'b', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
