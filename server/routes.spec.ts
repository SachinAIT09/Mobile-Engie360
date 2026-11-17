import { describe, expect, it } from 'vitest';
import { publicOrigin } from './routes.ts';

const req = (headers: Record<string, string>) => ({ headers });

describe('publicOrigin: the address the phone QR code points at', () => {
  it('is plain http on a laptop, with the port', () => {
    expect(publicOrigin(req({ host: 'localhost:3000' }), false)).toBe('http://localhost:3000');
    expect(publicOrigin(req({ host: '192.168.1.20:3000' }), false)).toBe('http://192.168.1.20:3000');
    expect(publicOrigin(req({ host: 'demo.example.com:80' }), false)).toBe('http://demo.example.com');
  });

  it('is https without a port on Catalyst, which passes the host as name:443 and no protocol', () => {
    expect(publicOrigin(req({ host: 'engie360-1.development.catalystappsail.in:443' }), true)).toBe('https://engie360-1.development.catalystappsail.in');
    expect(publicOrigin(req({ host: 'engie360-1.development.catalystappsail.in' }), true)).toBe('https://engie360-1.development.catalystappsail.in');
    // Port 443 means HTTPS wherever it runs.
    expect(publicOrigin(req({ host: 'demo.example.com:443' }), false)).toBe('https://demo.example.com');
  });

  it('follows a proxy that does say the protocol and host', () => {
    expect(publicOrigin(req({ host: 'internal:3000', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'demo.example.com' }), false)).toBe('https://demo.example.com');
    expect(publicOrigin(req({ host: 'internal:3000', 'x-forwarded-proto': 'https, http', 'x-forwarded-host': 'demo.example.com, proxy' }), false)).toBe('https://demo.example.com');
  });
});
