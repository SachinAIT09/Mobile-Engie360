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

/**
 * Live updates over Server-Sent Events. The browser reconnects by itself; `onOpen` fires on every
 * (re)connect so callers can refetch what they may have missed. Returns a function that closes the stream.
 */
export function openEvents(role: 'customer' | 'staff', onEvent: (e: LiveEvent) => void, onOpen?: () => void, onDown?: () => void): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  const es = new EventSource(`${API.events}?role=${role}`);
  const handle = (ev: MessageEvent<string>) => {
    try {
      onEvent(JSON.parse(ev.data) as LiveEvent);
    } catch {
      // ignore a malformed event
    }
  };
  for (const type of LIVE_EVENT_TYPES as readonly LiveEventType[]) es.addEventListener(type, handle as EventListener);
  es.onopen = () => onOpen?.();
  es.onerror = () => onDown?.();
  return () => es.close();
}
