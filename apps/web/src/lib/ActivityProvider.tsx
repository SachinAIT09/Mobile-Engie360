import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { CustomerActivity } from '@engie/shared';
import { useLoad, useSocketEvent } from './client';
import {
  ActivityContext,
  FEED_LIMIT,
  MAX_TOASTS,
  prependActivity,
  readMuteViews,
  readSeen,
  unreadCount,
  writeMuteViews,
  writeSeen,
  type ActivityCtx,
} from './activity';

/** Loads the recent customer activity, keeps it live over `activity:new` and raises toasts for new entries. */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, setData } = useLoad((a) => a.activity({ limit: FEED_LIMIT }));
  // First visit: everything already logged counts as seen, so the badge only counts what happens next.
  const [seenAt, setSeenAt] = useState(() => readSeen() ?? new Date().toISOString());
  const [toasts, setToasts] = useState<CustomerActivity[]>([]);
  const [muteViewToasts, setMute] = useState(readMuteViews);

  useSocketEvent('activity:new', (a) => {
    setData((prev) => prependActivity(prev, a));
    if (muteViewToasts && a.category === 'view') return;
    setToasts((t) => [a, ...t.filter((x) => x.id !== a.id)].slice(0, MAX_TOASTS));
  });
  useSocketEvent('demo:reset', () => {
    setToasts([]);
    void reload();
  });

  const markSeen = useCallback(() => {
    const now = new Date().toISOString();
    writeSeen(now);
    setSeenAt(now);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const setMuteViewToasts = useCallback((v: boolean) => {
    writeMuteViews(v);
    setMute(v);
  }, []);

  const items = useMemo(() => data ?? [], [data]);
  const value = useMemo<ActivityCtx>(
    () => ({
      items,
      loading,
      error,
      unread: unreadCount(items, seenAt),
      markSeen,
      toasts,
      dismissToast,
      muteViewToasts,
      setMuteViewToasts,
    }),
    [items, loading, error, seenAt, markSeen, toasts, dismissToast, muteViewToasts, setMuteViewToasts],
  );
  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}
