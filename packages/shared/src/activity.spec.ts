import { describe, expect, it } from 'vitest';
import { ACTIVITY_CATEGORIES, ACTIVITY_META, activityCategory, activityLabel } from './activity';
import { TRACKABLE_ACTIVITY_KINDS } from './types';

describe('activity meta', () => {
  it('maps every kind to a known category', () => {
    const ids = new Set(ACTIVITY_CATEGORIES.map(c => c.id));
    for (const m of Object.values(ACTIVITY_META)) expect(ids.has(m.category)).toBe(true);
  });

  it('phone-tracked kinds are views or sign-out', () => {
    for (const k of TRACKABLE_ACTIVITY_KINDS) {
      expect(k === 'SIGNED_OUT' || activityCategory(k) === 'view').toBe(true);
    }
  });

  it('labels', () => {
    expect(activityLabel('PAYMENT_MADE')).toBe('Paid invoice (iDEAL)');
    expect(activityCategory('FLEX_OPTED_IN')).toBe('flex');
  });
});
