import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
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

/** Text formats worth compressing; images and fonts already are. */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt']);
/** Below this a compressed copy saves nothing worth the header. */
const MIN_COMPRESS_BYTES = 1024;
const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

type Encoding = 'br' | 'gzip';

/** The best encoding the browser accepts, or none. */
export function pickEncoding(acceptEncoding: string | string[] | undefined): Encoding | null {
  const accepted = String(acceptEncoding ?? '')
    .split(',')
    .map((part) => part.trim().split(';'))
    .filter(([, q]) => !/^\s*q=0(\.0*)?\s*$/.test(q ?? ''))
    .map(([name]) => name!.toLowerCase());
  if (accepted.includes('br')) return 'br';
  if (accepted.includes('gzip')) return 'gzip';
  return null;
}

/** Serves the built frontend (dist/) with SPA fallback to index.html for app routes. */
export function staticFiles(dir: string) {
  const policies = new Map<string, string>();
  // Compressed copies, made on first request and kept: the files only change with a new build.
  const compressed = new Map<string, Promise<Buffer>>();
  const compress = (file: string, version: number, encoding: Encoding): Promise<Buffer> => {
    const key = `${file}|${version}|${encoding}`;
    let copy = compressed.get(key);
    if (!copy) {
      copy = readFile(file).then((raw) =>
        encoding === 'br' ? brotli(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } }) : gz(raw, { level: 9 }),
      );
      compressed.set(key, copy);
      copy.catch(() => compressed.delete(key));
    }
    return copy;
  };
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
    // Files that are revalidated on every visit (the page, the logos, sw.js) carry a validator, so an
    // unchanged file is answered with "304 Not Modified" instead of being sent again.
    const etag = `W/"${info.size.toString(16)}-${Math.round(info.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // Hashed bundles never change; everything else (index.html, sw.js) is revalidated.
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: etag,
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { 'Cache-Control': headers['Cache-Control'], ETag: etag, ...(COMPRESSIBLE.has(extname(file)) ? { Vary: 'Accept-Encoding' } : {}) });
      res.end();
      return;
    }
    // Scripts, styles and pages go out compressed when the browser accepts it (about a third of the size).
    const encoding = COMPRESSIBLE.has(extname(file)) && info.size >= MIN_COMPRESS_BYTES ? pickEncoding(req.headers['accept-encoding']) : null;
    if (encoding) {
      const body = await compress(file, info.mtimeMs, encoding);
      res.writeHead(200, { ...headers, 'Content-Encoding': encoding, 'Content-Length': body.length, Vary: 'Accept-Encoding' });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': info.size, ...(COMPRESSIBLE.has(extname(file)) ? { Vary: 'Accept-Encoding' } : {}) });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  };
}
