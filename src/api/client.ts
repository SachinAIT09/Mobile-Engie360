/**
 * HTTP client for the ENGIE360 server (shared/contract.ts). Same origin: the server serves the app on
 * one port. When the server is not there (plain `vite` or static hosting) calls reject and the app
 * keeps working on its local demo data.
 */
import { API, type ApiError, type LiveEvent, type LiveEventType, LIVE_EVENT_TYPES } from '../../shared/contract';

export { API };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // A static host answers unknown paths with index.html: treat anything that isn't JSON as "no server".
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!res.ok || (text && !isJson)) {
    let message = res.statusText || 'Request failed';
    if (isJson) {
      try {
        message = (JSON.parse(text) as ApiError).error?.message ?? message;
      } catch {
        // keep the status text
      }
    }
    throw new HttpError(isJson ? res.status : 503, message);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T>(path: string) => request<T>('GET', path);
export const post = <T = void>(path: string, body: unknown = {}) => request<T>('POST', path, body);

/** Remembered for the tab: this network holds streamed responses back, so ask for short streams straight away. */
const SHORT_STREAMS = 'engie-demo-short-streams';
/** A stream that has not opened this long after the server answered a plain request is being held back. */
const HELD_BACK_MS = 4000;

const remembered = (): boolean => {
  try {
    return sessionStorage.getItem(SHORT_STREAMS) === '1';
  } catch {
    return false;
  }
};

/**
 * Live updates over Server-Sent Events. Returns a function that closes the stream.
 *
 * `onOpen` means "load the current data": it is called once at the start (without waiting for the stream),
 * again whenever the stream reconnects after a break, and when the server says we missed too much.
 *
 * Some networks (antivirus web filters, company proxies) hold a streamed response back until it ends, so the
 * stream never "opens" and events arrive in one late batch. When that is detected the stream is reopened as
 * a series of short ones (`short=1`): each ends after a few seconds, the browser reconnects by itself and the
 * server replays anything missed in between (Last-Event-ID), so events still arrive within a few seconds.
 */
export function openEvents(role: 'customer' | 'staff', onEvent: (e: LiveEvent) => void, onOpen?: () => void, onDown?: () => void): () => void {
  onOpen?.();
  if (typeof EventSource === 'undefined') return () => undefined;
  let es: EventSource | null = null;
  let closed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;

  const handle = (ev: MessageEvent<string>) => {
    try {
      const e = JSON.parse(ev.data) as LiveEvent;
      if (e.type === 'hello' && e.stale) onOpen?.();
      onEvent(e);
    } catch {
      // ignore a malformed event
    }
  };

  const start = (short: boolean) => {
    let opened = false;
    let broken = false;
    es = new EventSource(`${API.events}?role=${role}${short ? '&short=1' : ''}`);
    for (const type of LIVE_EVENT_TYPES as readonly LiveEventType[]) es.addEventListener(type, handle as EventListener);
    es.onopen = () => {
      if (watchdog) clearTimeout(watchdog);
      // The data was loaded at the start; load it again only after a real break. Short streams end on
      // purpose every few seconds and the server replays what was missed, so those are not breaks.
      if (opened && broken && !short) onOpen?.();
      opened = true;
      broken = false;
    };
    es.onerror = () => {
      broken = true;
      // A short stream ending is expected; only a stream that never opened counts as "down".
      if (!short || !opened) onDown?.();
    };
    if (short) return;
    // Is the stream being held back? Only judge once the server is known to answer (it may be waking up).
    fetch(API.health)
      .then((r) => {
        if (!r.ok || closed || opened) return;
        watchdog = setTimeout(() => {
          if (closed || opened) return;
          es?.close();
          try {
            sessionStorage.setItem(SHORT_STREAMS, '1');
          } catch {
            /* not remembered: detected again on the next load */
          }
          start(true);
        }, HELD_BACK_MS);
      })
      .catch(() => undefined);
  };

  start(remembered());
  return () => {
    closed = true;
    if (watchdog) clearTimeout(watchdog);
    es?.close();
  };
}
