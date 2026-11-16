import { resolve } from 'node:path';

/**
 * Server settings from the environment. The port order matters for hosting:
 * Zoho Catalyst AppSail injects X_ZOHO_CATALYST_LISTEN_PORT and kills apps not listening within 10 s.
 */
export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  for (const key of ['X_ZOHO_CATALYST_LISTEN_PORT', 'PORT']) {
    const n = Number(env[key]);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return 3000;
}

const root = resolve(import.meta.dirname, '..');

export const config = {
  port: resolvePort(),
  host: process.env.HOST ?? '0.0.0.0',
  production: process.env.NODE_ENV === 'production' || process.argv.includes('--prod'),
  root,
  dist: resolve(root, 'dist'),
  /** SQLite file. A container restart starts fresh unless DATA_DIR points at a volume. */
  dataDir: resolve(root, process.env.DATA_DIR ?? '.data'),
  /** Public URL when hosted (used for the phone QR); otherwise LAN addresses are used. */
  publicUrl: process.env.PUBLIC_URL?.replace(/\/+$/, '') || null,
  /** Catalyst's proxy cuts requests at 30 s: live streams close at 25 s and the browser reconnects. */
  streamMaxMs: process.env.X_ZOHO_CATALYST_LISTEN_PORT ? 25_000 : 0,
  /** VAPID contact for web push. */
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:demo@example.com',
  version: '1.0.0',
};
