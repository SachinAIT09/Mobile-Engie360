import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiError } from '../shared/contract.ts';
import { HttpError } from './store.ts';

export type Handler = (ctx: { req: IncomingMessage; res: ServerResponse; url: URL; params: Record<string, string>; body: unknown }) => unknown | Promise<unknown>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const MAX_BODY = 64 * 1024;

/** Minimal router: "/api/messages/:id/read" style paths. A handler's return value is sent as JSON (undefined → 204). */
export class Router {
  private readonly routes: Route[] = [];

  on(method: 'GET' | 'POST', path: string, handler: Handler): this {
    const keys: string[] = [];
    const pattern = new RegExp(`^${path.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), '([^/]+)'))}$`);
    this.routes.push({ method, pattern, keys, handler });
    return this;
  }

  /** Returns false when no route matched (so the caller can fall through to static files). */
  async handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const path = url.pathname;
    const candidates = this.routes.filter((r) => r.pattern.test(path));
    if (candidates.length === 0) return false;
    const route = candidates.find((r) => r.method === req.method);
    if (!route) {
      sendError(res, new HttpError(405, `Method ${req.method} not allowed`));
      return true;
    }
    try {
      const m = route.pattern.exec(path)!;
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1] ?? '')]));
      const body = req.method === 'POST' ? await readJson(req) : undefined;
      const out = await route.handler({ req, res, url, params, body });
      if (res.headersSent) return true;
      if (out === undefined) {
        res.writeHead(204).end();
      } else {
        sendJson(res, 200, out);
      }
    } catch (e) {
      sendError(res, e);
    }
    return true;
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

export function sendError(res: ServerResponse, e: unknown): void {
  const status = e instanceof HttpError ? e.status : 500;
  if (status === 500) console.error('[api]', e);
  const body: ApiError = { error: { message: e instanceof HttpError ? e.message : 'Internal server error' } };
  if (!res.headersSent) sendJson(res, status, body);
  else res.end();
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

// ---------------------------------------------------------------- tiny validators

export function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError(400, 'Body must be a JSON object');
  return v as Record<string, unknown>;
}
export function str(o: Record<string, unknown>, k: string, opt = false): string {
  const v = o[k];
  if (v === undefined && opt) return '';
  if (typeof v !== 'string') throw new HttpError(400, `"${k}" must be a string`);
  return v;
}
export function num(o: Record<string, unknown>, k: string): number {
  const v = o[k];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new HttpError(400, `"${k}" must be a number`);
  return v;
}
export function bool(o: Record<string, unknown>, k: string): boolean {
  const v = o[k];
  if (typeof v !== 'boolean') throw new HttpError(400, `"${k}" must be true or false`);
  return v;
}
export function text(o: Record<string, unknown>, k: string): { en: string; nl: string } {
  const v = o[k];
  if (typeof v === 'string') return { en: v, nl: v };
  const t = obj(v);
  return { en: str(t, 'en'), nl: str(t, 'nl', true) };
}
