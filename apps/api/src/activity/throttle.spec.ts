import { describe, expect, it } from 'vitest';
import { ViewThrottle } from './throttle.js';

describe('ViewThrottle', () => {
  it('always lets actions through', () => {
    const t = new ViewThrottle(30_000);
    expect(t.allow('c1', 'PAYMENT_MADE', 0)).toBe(true);
    expect(t.allow('c1', 'PAYMENT_MADE', 1)).toBe(true);
  });

  it('drops a repeat view inside the window and allows it after', () => {
    const t = new ViewThrottle(30_000);
    expect(t.allow('c1', 'VIEWED_BILLING', 0)).toBe(true);
    expect(t.allow('c1', 'VIEWED_BILLING', 29_999)).toBe(false);
    expect(t.allow('c1', 'VIEWED_BILLING', 30_000)).toBe(true);
  });

  it('throttles message and flex opens like views', () => {
    const t = new ViewThrottle(30_000);
    expect(t.allow('c1', 'FLEX_OPENED', 0)).toBe(true);
    expect(t.allow('c1', 'FLEX_OPENED', 5_000)).toBe(false);
    expect(t.allow('c1', 'MESSAGE_OPENED', 5_000)).toBe(true);
  });

  it('keys by customer and kind', () => {
    const t = new ViewThrottle(30_000);
    expect(t.allow('c1', 'VIEWED_BILLING', 0)).toBe(true);
    expect(t.allow('c2', 'VIEWED_BILLING', 1)).toBe(true);
    expect(t.allow('c1', 'VIEWED_ENERGY', 2)).toBe(true);
  });

  it('clear forgets everything', () => {
    const t = new ViewThrottle(30_000);
    t.allow('c1', 'VIEWED_BILLING', 0);
    t.clear();
    expect(t.allow('c1', 'VIEWED_BILLING', 1)).toBe(true);
  });
});
