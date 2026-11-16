import { Injectable, Logger } from '@nestjs/common';
import webpush, { type PushSubscription } from 'web-push';
import type { PushSubscribeRequest } from '@engie/shared';
import { config } from '../config.js';
import type { PushPayload } from './push-payload.js';

/**
 * Web push to the customer app (browser notifications on the phone, even with the tab closed).
 * Subscriptions are kept in memory, keyed by customer: demo customer ids are fixed, so they survive a
 * demo reset, and the app re-subscribes on every load, so a server restart heals itself. VAPID keys come
 * from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, or are generated at boot (the app notices the new key and
 * re-subscribes).
 */
@Injectable()
export class WebPushService {
  private readonly log = new Logger('WebPush');
  private readonly keys: { publicKey: string; privateKey: string };
  private readonly subs = new Map<string, Map<string, PushSubscription>>();

  constructor() {
    const fromEnv = config.vapidPublicKey && config.vapidPrivateKey;
    this.keys = fromEnv ? { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey } : webpush.generateVAPIDKeys();
    webpush.setVapidDetails(config.vapidSubject, this.keys.publicKey, this.keys.privateKey);
    if (!fromEnv) this.log.log('No VAPID keys set; generated a pair for this run');
  }

  get publicKey(): string {
    return this.keys.publicKey;
  }

  subscribe(customerId: string, s: PushSubscribeRequest): void {
    const mine = this.subs.get(customerId) ?? new Map<string, PushSubscription>();
    // One browser belongs to one customer at a time: signing in as someone else on the phone moves it.
    for (const [cid, list] of this.subs) if (cid !== customerId) list.delete(s.endpoint);
    mine.set(s.endpoint, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
    this.subs.set(customerId, mine);
  }

  unsubscribe(customerId: string, endpoint: string): void {
    this.subs.get(customerId)?.delete(endpoint);
  }

  count(customerId: string): number {
    return this.subs.get(customerId)?.size ?? 0;
  }

  /** Fire and forget: a failed push never blocks the API call that caused it. */
  send(customerId: string, payload: PushPayload): void {
    const list = this.subs.get(customerId);
    if (!list?.size) return;
    const body = JSON.stringify(payload);
    for (const sub of [...list.values()]) {
      webpush.sendNotification(sub, body, { TTL: 600, urgency: 'high' }).catch((e: unknown) => {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped this subscription (permission revoked, app data cleared).
        if (status === 404 || status === 410) list.delete(sub.endpoint);
        else this.log.warn(`Push to ${customerId} failed${status ? ` (${status})` : ''}: ${e instanceof Error ? e.message : String(e)}`);
      });
    }
  }
}
