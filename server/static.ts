import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { contentSecurityPolicy, decodePath } from './http.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serves the built frontend (dist/) with SPA fallback to index.html for app routes. */
export function staticFiles(dir: string) {
  const policies = new Map<string, string>();
  return async (req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    const rel = normalize(decodePath(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(dir, rel);
    if (!file.startsWith(dir + sep) && file !== dir) {
      res.writeHead(403).end();
      return;
    }
    let info = await stat(file).catch(() => null);
    if (!info || info.isDirectory()) {
      // Unknown file with an extension → 404; an app route → index.html.
      if (extname(rel)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      file = join(dir, 'index.html');
      info = await stat(file);
    }
    const hashed = url.pathname.startsWith('/assets/');
    // Pages get a Content-Security-Policy that names their own inline scripts (worked out once per file).
    if (extname(file) === '.html') {
      let policy = policies.get(file);
      if (!policy) policies.set(file, (policy = contentSecurityPolicy(await readFile(file, 'utf8'))));
      res.setHeader('Content-Security-Policy', policy);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      // Hashed bundles never change; everything else (index.html, sw.js) is revalidated.
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  };
}
