/**
 * ENGIE360 server entry. Opens the port first and answers "Starting…" (503) while the database,
 * API and frontend load: Zoho Catalyst AppSail stops apps that don't listen within 10 s.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.ts';

const STARTING = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Starting…</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#0b2240">Starting the demo…</body>`;

let handler = (req: IncomingMessage, res: ServerResponse) => {
  const json = (req.url ?? '').startsWith('/api/');
  res.writeHead(503, { 'Content-Type': json ? 'application/json' : 'text/html; charset=utf-8', 'Retry-After': '2' });
  res.end(json ? JSON.stringify({ error: { message: 'Starting', code: 'STARTING' } }) : STARTING);
};

const server = createServer((req, res) => handler(req, res));
server.listen(config.port, config.host, () => {
  console.log(`ENGIE360 listening on http://localhost:${config.port} (${config.production ? 'production' : 'development'})`);
});

const { createApp } = await import('./app.ts');
const app = await createApp(server);
handler = app.handler;
console.log(`Ready: start page http://localhost:${config.port}/ · portal /app · staff /staff`);

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
