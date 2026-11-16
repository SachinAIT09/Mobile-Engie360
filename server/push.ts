import { generateVAPIDKeys, sendNotification, setVapidDetails } from 'web-push';
import type { PushPayload, PushSubscribeRequest } from '../shared/contract.ts';
import type { Db } from './db.ts';

interface StoredSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  device: string;
  created: string;
}

/**
 * Web push. VAPID keys come from the environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) or are
 * generated once and kept in the database. Subscriptions survive "Reset demo" so a phone stays subscribed.
 */
export class Push {
  readonly publicKey: string;

  constructor(
    private readonly db: Db,
    subject: string,
  ) {
    let keys = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY } : db.get<{ publicKey: string; privateKey: string }>('vapid');
    if (!keys) {
      keys = generateVAPIDKeys();
      db.set('vapid', keys);
    }
    setVapidDetails(subject, keys.publicKey, keys.privateKey);
    this.publicKey = keys.publicKey;
  }

  get devices(): number {
    return this.db.count('push_subs');
  }

  subscribe(req: PushSubscribeRequest): void {
    const sub: StoredSub = { ...req.subscription, device: req.device ?? 'browser', created: new Date().toISOString() };
    this.db.put('push_subs', sub.endpoint, sub.created, sub);
  }

  unsubscribe(endpoint: string): void {
    this.db.remove('push_subs', endpoint);
  }

  /** Sends to every subscribed device; drops subscriptions the push service says are gone. Returns deliveries. */
  async send(payload: PushPayload): Promise<number> {
    const subs = this.db.list<StoredSub>('push_subs');
    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(subs.map((s) => sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 3600 })));
    let delivered = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') delivered++;
      else {
        const code = (r.reason as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) this.unsubscribe(subs[i]!.endpoint);
        else console.warn(`[push] delivery failed (${code ?? 'network'})`);
      }
    });
    return delivered;
  }
}
