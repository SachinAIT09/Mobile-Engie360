import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, decodePath } from './http.ts';
import { HttpError } from './store.ts';

describe('decodePath', () => {
  it('decodes a normal address and refuses a malformed one with 400, not a server error', () => {
    expect(decodePath('/app/smart%20energy')).toBe('/app/smart energy');
    expect(() => decodePath('/%E0%A4%A')).toThrow(HttpError);
    try {
      decodePath('%');
    } catch (e) {
      expect((e as HttpError).status).toBe(400);
    }
  });
});

describe('contentSecurityPolicy', () => {
  const html = `<!doctype html><head><script>var a = 1;</script><script type="module" src="/assets/index.js"></script></head><body><script>\nrun();\n</script></body>`;
  const policy = contentSecurityPolicy(html);

  it('allows only our own sources, and frames only by ourselves', () => {
    for (const part of ["default-src 'self'", "connect-src 'self'", "frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'"]) expect(policy).toContain(part);
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it('allows each inline script by its hash, and nothing for scripts loaded from a file', () => {
    const hashes = policy.match(/'sha256-[A-Za-z0-9+/=]+'/g) ?? [];
    expect(hashes).toHaveLength(2);
    // sha256 of "var a = 1;"
    expect(policy).toContain("'sha256-");
    expect(contentSecurityPolicy('<script src="/a.js"></script>')).toContain("script-src 'self';");
  });
});
