import type { FlexEventStatus, Message } from '@engie/shared';

/** What the service worker turns into a phone notification. */
export interface PushPayload {
  title: string;
  body: string;
  /** Page to open on tap, under the customer app's /app base. */
  url: string;
  /** Same tag replaces an older notification instead of stacking (one per message kind). */
  tag: string;
}

/** Customer-app routes are app-relative ("/messages/abc"); the notification opens them under /app. */
export function appUrl(route: string): string {
  const r = route.startsWith('/') ? route : `/${route}`;
  return `/app${r === '/' ? '' : r}`;
}

/** Notifications show a short body; the full text is in the app. */
export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** DR event start/end, worded like the in-app banners; null for statuses that don't notify. */
export function flexEventPayload(e: { id: string; status: FlexEventStatus; title: string }): PushPayload | null {
  if (e.status === 'ACTIVE') return { title: 'Grid event has started', body: clip(e.title), url: appUrl(`/flex-events/${e.id}`), tag: `dr-${e.id}` };
  if (e.status === 'ENDED') {
    return { title: 'Thanks for taking part — see your event result', body: 'Your grid event has ended. Tap to see what you earned.', url: appUrl(`/flex-events/${e.id}/result`), tag: `dr-${e.id}` };
  }
  return null;
}

export function messagePayload(m: Pick<Message, 'title' | 'body' | 'route' | 'kind' | 'id'>): PushPayload {
  return { title: m.title, body: clip(m.body), url: appUrl(m.route), tag: `${m.kind}-${m.id}` };
}
