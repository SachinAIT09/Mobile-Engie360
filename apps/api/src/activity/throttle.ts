import { activityCategory, type CustomerActivityKind } from '@engie/shared';

/** Repeat screen views by the same customer inside this window are dropped (tab hopping, refocus). */
export const VIEW_THROTTLE_MS = 30_000;

/** Opening a message or flex event refetches on every live update, so opens are throttled like views. */
function throttled(kind: CustomerActivityKind): boolean {
  return activityCategory(kind) === 'view' || kind === 'MESSAGE_OPENED' || kind === 'FLEX_OPENED';
}

/**
 * Decides whether an activity is worth recording. Actions always pass; views and opens pass once per
 * customer and kind per window, so the staff feed shows "Viewed bill" once, not on every refocus.
 */
export class ViewThrottle {
  private readonly last = new Map<string, number>();

  constructor(private readonly windowMs = VIEW_THROTTLE_MS) {}

  allow(customerId: string, kind: CustomerActivityKind, now = Date.now()): boolean {
    if (!throttled(kind)) return true;
    const key = `${customerId}:${kind}`;
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.windowMs) return false;
    this.last.set(key, now);
    return true;
  }

  clear() {
    this.last.clear();
  }
}
