import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pickEncoding, staticFiles } from './static.ts';

describe('pickEncoding', () => {
  it('prefers brotli, then gzip, and honours q=0', () => {
    expect(pickEncoding('gzip, deflate, br, zstd')).toBe('br');
    expect(pickEncoding('gzip, deflate')).toBe('gzip');
    expect(pickEncoding('br;q=0, gzip;q=0.8')).toBe('gzip');
    expect(pickEncoding('identity')).toBeNull();
    expect(pickEncoding(undefined)).toBeNull();
  });
});

describe('staticFiles', () => {
  let dir: string;
  let server: Server;
  let base: string;
  const script = `console.log(${JSON.stringify('x'.repeat(4000))});`;
  const page = '<!doctype html><title>t</title><script>var a = 1;</script><div id="root"></div>';

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'engie-static-'));
    writeFileSync(join(dir, 'index.html'), page);
    writeFileSync(join(dir, 'app.js'), script);
    writeFileSync(join(dir, 'tiny.js'), 'var t = 1;');
    writeFileSync(join(dir, 'logo.png'), Buffer.alloc(3000, 7));
    const serve = staticFiles(dir);
    server = createServer((req, res) => void serve(req, res, new URL(req.url ?? '/', 'http://local')));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  afterAll(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** A raw request, so the body arrives exactly as sent (fetch would decompress it). */
  const get = async (path: string, acceptEncoding?: string, extra: Record<string, string> = {}) => {
    const { request } = await import('node:http');
    return new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>((resolve, reject) => {
      const req = request(base + path, { headers: { ...(acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}), ...extra } }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end();
    });
  };

  it('sends the same bytes, compressed when the browser accepts it', async () => {
    const plain = await get('/app.js');
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.body.toString()).toBe(script);

    const br = await get('/app.js', 'gzip, deflate, br');
    expect(br.headers['content-encoding']).toBe('br');
    expect(br.headers.vary).toBe('Accept-Encoding');
    expect(Number(br.headers['content-length'])).toBe(br.body.length);
    expect(br.body.length).toBeLessThan(script.length / 4);
    expect(brotliDecompressSync(br.body).toString()).toBe(script);

    const gzipped = await get('/app.js', 'gzip');
    expect(gzipped.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(gzipped.body).toString()).toBe(script);
    expect(gzipped.headers['content-type']).toBe(plain.headers['content-type']);
  });

  it('leaves small files and images as they are', async () => {
    expect((await get('/tiny.js', 'br')).headers['content-encoding']).toBeUndefined();
    const png = await get('/logo.png', 'br, gzip');
    expect(png.headers['content-encoding']).toBeUndefined();
    expect(png.body.length).toBe(3000);
  });

  it('answers 304 for a file the browser already has, and sends it again when it differs', async () => {
    const first = await get('/logo.png');
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
    expect(first.headers['cache-control']).toBe('no-cache');
    const again = await get('/logo.png', undefined, { 'if-none-match': etag });
    expect(again.status).toBe(304);
    expect(again.body.length).toBe(0);
    expect(again.headers.etag).toBe(etag);
    const other = await get('/logo.png', undefined, { 'if-none-match': 'W/"something-else"' });
    expect(other.status).toBe(200);
    expect(other.body.length).toBe(3000);
    // The page is revalidated the same way, compressed or not.
    const page1 = await get('/app/billing', 'br');
    expect((await get('/app/billing', 'br', { 'if-none-match': String(page1.headers.etag) })).status).toBe(304);
  });

  it('still serves the app page for app routes, with its security policy, and 404 for a missing file', async () => {
    const route = await get('/app/billing', 'br');
    expect(route.status).toBe(200);
    expect(route.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(String(route.headers['content-security-policy'])).toContain("script-src 'self' 'sha256-");
    expect((route.headers['content-encoding'] ? brotliDecompressSync(route.body) : route.body).toString()).toBe(page);
    expect((await get('/missing.js')).status).toBe(404);
  });
});
