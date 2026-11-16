import { createContext, useContext } from 'react';
import { DEMO_TZ, type CustomerActivity, type CustomerActivityCategory } from '@engie/shared';
import type { IconName } from '../components/icons';

/** Customer activity from the mobile app, owned by the Shell so the bell, toasts and pages share one feed. */
export interface ActivityCtx {
  items: CustomerActivity[];
  loading: boolean;
  error: string | null;
  unread: number;
  /** Everything up to now counts as seen (opening the bell panel). */
  markSeen: () => void;
  toasts: CustomerActivity[];
  dismissToast: (id: string) => void;
  /** Screen views still go to the feed but don't pop a toast. */
  muteViewToasts: boolean;
  setMuteViewToasts: (v: boolean) => void;
}

export const ActivityContext = createContext<ActivityCtx | null>(null);

export function useActivity(): ActivityCtx {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used inside <ActivityProvider>');
  return ctx;
}

export const FEED_LIMIT = 50;
export const MAX_TOASTS = 3;
export const TOAST_MS = 5000;

/** Newest first, no duplicates (a reconnect refetch can overlap live events), capped. */
export function prependActivity(list: CustomerActivity[] | null, a: CustomerActivity, limit = FEED_LIMIT): CustomerActivity[] {
  const prev = list ?? [];
  if (prev.some((x) => x.id === a.id)) return prev;
  return [a, ...prev].slice(0, limit);
}

export function unreadCount(items: CustomerActivity[], seenAt: string): number {
  const t = new Date(seenAt).getTime();
  return items.filter((a) => new Date(a.at).getTime() > t).length;
}

/** Groups an already sorted list by local (Dutch) day, keeping order: [{ day: "Tue, Oct 27", items }]. */
export function groupByDay(items: CustomerActivity[]): { day: string; items: CustomerActivity[] }[] {
  const out: { day: string; items: CustomerActivity[] }[] = [];
  for (const a of items) {
    const day = new Date(a.at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: DEMO_TZ });
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(a);
    else out.push({ day, items: [a] });
  }
  return out;
}

export const CATEGORY_ICON: Record<CustomerActivityCategory, IconName> = {
  account: 'users',
  billing: 'file',
  program: 'car',
  flex: 'bolt',
  charging: 'bolt',
  assistant: 'chat',
  view: 'eye',
};

/** Pill tone per category (existing .pill variants). */
export const CATEGORY_TONE: Record<CustomerActivityCategory, 'ok' | 'warn' | 'ev' | 'accent' | 'grey' | 'danger'> = {
  account: 'accent',
  billing: 'ok',
  program: 'ev',
  flex: 'warn',
  charging: 'ev',
  assistant: 'accent',
  view: 'grey',
};

const SEEN_KEY = 'pc-activity-seen';
const MUTE_KEY = 'pc-activity-mute-views';

export function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}
export function writeSeen(iso: string) {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    // not persisted; the count still resets for this page view
  }
}
export function readMuteViews(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export function writeMuteViews(v: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    // not persisted
  }
}
