import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { config } from './config.ts';
import { Db } from './db.ts';
import { sendError } from './http.ts';
import { Live } from './live.ts';
import { Push } from './push.ts';
import { buildRouter, phoneUrls } from './routes.ts';
import { startPage } from './startPage.ts';
import { staticFiles } from './static.ts';
import { HttpError, Store } from './store.ts';

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * Wires the database, live stream, push and API, then the frontend: Vite in middleware mode during
 * development (hot reload on the same port), the built dist/ in production.
 */
export async function createApp(server: Server): Promise<{ handler: RequestHandler; close: () => Promise<void> }> {
  const startedAt = new Date().toISOString();
  const db = new Db(config.dataDir);
  const live = new Live(config.streamMaxMs);
  const store = new Store(db, (e) => live.emit(e));
  live.onPresence = (online) => live.emit({ type: 'presence', online });
  const push = new Push(db, config.vapidSubject);
  const api = buildRouter(store, live, push, startedAt);

  let frontend: (req: IncomingMessage, res: ServerResponse, url: URL) => void | Promise<void>;
  let closeVite = async () => {};
  if (config.production) {
    if (!existsSync(config.dist)) throw new Error('dist/ is missing: run `npm run build` first');
    frontend = staticFiles(config.dist);
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ root: config.root, server: { middlewareMode: true, ws: { server } }, appType: 'spa' });
    frontend = (req, res) => vite.middlewares(req, res);
    closeVite = () => vite.close();
  }

  const handler: RequestHandler = (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    void (async () => {
      try {
        if (await api.handle(req, res, url)) return;
        if (url.pathname.startsWith('/api/')) {
          sendError(res, new HttpError(404, `No API route ${url.pathname}`));
          return;
        }
        // Start page at the root, like Hydro Mobile360; the old /start address still works.
        if (url.pathname === '/start' || url.pathname === '/start/') {
          res.writeHead(301, { Location: '/' }).end();
          return;
        }
        if (url.pathname === '/') {
          const [first, ...rest] = phoneUrls(req);
          const html = await startPage(`${first ?? `http://localhost:${config.port}`}/app`, rest.map((u) => `${u}/app`));
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html);
          return;
        }
        await frontend(req, res, url);
      } catch (e) {
        sendError(res, e);
      }
    })();
  };

  return {
    handler,
    close: async () => {
      live.closeAll();
      await closeVite();
      db.close();
    },
  };
}
