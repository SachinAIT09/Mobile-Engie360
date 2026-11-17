import { networkInterfaces } from 'node:os';
import type { IncomingMessage } from 'node:http';
import { API, type ActivityKind, type AttentionFlag, type CustomerFilter, type DemoInfo, type InboxMessage, type MessageIcon, type OutboxItem, type ReportGroup, type PayMethod, type StaffMessageResult } from '../shared/contract.ts';
import type { AssistantContext } from '../src/assistant/types';
import { brand } from '../src/brand';
import { config } from './config.ts';
import { bool, num, obj, Router, str, text } from './http.ts';
import type { Live } from './live.ts';
import type { Push } from './push.ts';
import { HttpError, Store, TEMPLATES } from './store.ts';

const ICONS: MessageIcon[] = ['ev', 'trend', 'plug', 'flame', 'sun', 'wallet', 'moon', 'washer', 'bell', 'doc'];
const CLIENT_KINDS: ActivityKind[] = ['session', 'page', 'invoice_download', 'push_subscribed'];

/** Origin as the browser sees it, also behind a proxy (Catalyst, Docker host). */
export function publicOrigin(req: IncomingMessage): string {
  if (config.publicUrl) return config.publicUrl;
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0]!.trim();
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? `localhost:${config.port}`).split(',')[0]!.trim();
  return `${proto}://${host}`;
}

/** Addresses a phone on the same network can open. Hosted → the public origin. */
export function phoneUrls(req: IncomingMessage): string[] {
  const origin = publicOrigin(req);
  if (!/\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(origin)) return [origin];
  const port = new URL(origin).port || String(config.port);
  const lan: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) lan.push(`http://${a.address}:${port}`);
  }
  // Home/office LANs first (192.168 / 10 / 172.16–31), virtual adapters last.
  return lan.sort((a, b) => Number(!/\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a)) - Number(!/\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(b)));
}

export function buildRouter(store: Store, live: Live, push: Push, startedAt: string): Router {
  const r = new Router();

  r.on('GET', API.health, () => ({ ok: true, version: config.version, startedAt }));

  // ---- customer
  r.on('GET', API.customer, () => store.customer());
  r.on('GET', API.energy, () => store.energy());
  r.on('GET', API.billing, () => store.billing());
  r.on('POST', API.installment, ({ body }) => store.setInstallment(num(obj(body), 'amount')));
  r.on('POST', API.pay, ({ body }) => {
    const b = obj(body);
    return store.payInvoice(str(b, 'invoiceId'), str(b, 'method') as PayMethod, str(b, 'bank', true) || undefined);
  });
  r.on('POST', API.autopay, ({ body }) => store.setAutopay(bool(obj(body), 'on')));
  r.on('GET', API.insights, () => store.insights());
  r.on('POST', API.insightsPlan, ({ body }) => {
    const b = obj(body);
    return store.setPlan(str(b, 'id'), bool(b, 'on'));
  });
  r.on('POST', API.charging, ({ body }) => {
    const b = obj(body);
    store.setCharging(bool(b, 'active'), num(b, 'kwh'), num(b, 'readyBy'));
  });
  r.on('POST', API.contact, ({ body }) => {
    const b = obj(body);
    store.setContact(str(b, 'email'), str(b, 'phone'));
  });
  r.on('GET', API.messages, () => store.messages());
  r.on('POST', API.messagesReadAll, () => store.markRead('all'));
  r.on('POST', '/api/messages/:id/read', ({ params }) => store.markRead(params.id!));
  r.on('POST', API.activity, ({ body }) => {
    const b = obj(body);
    const kind = str(b, 'kind') as ActivityKind;
    if (!CLIENT_KINDS.includes(kind)) throw new HttpError(400, `Activity kind "${kind}" is logged by the server`);
    if (kind === 'page') return store.trackPage(str(b, 'route'));
    if (kind === 'session') return void store.log('session', { en: `Signed in to ${brand.portal}`, nl: `Ingelogd bij ${brand.portal}` });
    const t = b.text === undefined ? null : text(b, 'text');
    if (kind === 'invoice_download') return void store.log(kind, t ?? { en: 'Downloaded an invoice', nl: 'Downloadde een nota' }, '/billing');
    store.log(kind, t ?? { en: 'Turned on phone notifications', nl: 'Zette telefoonmeldingen aan' });
  });
  r.on('POST', API.assistant, ({ body }) => {
    const b = obj(body);
    const ctx = obj(b.context);
    const lang = str(ctx, 'lang');
    if (lang !== 'en' && lang !== 'nl') throw new HttpError(400, 'Invalid context: lang must be en or nl');
    const context: AssistantContext = { lang, route: str(ctx, 'route', true) || '/', lastIntent: str(ctx, 'lastIntent', true) || undefined };
    return store.ask({ question: str(b, 'question'), context, conversationId: str(b, 'conversationId') });
  });

  // ---- staff
  r.on('GET', API.staffOverview, () => store.overview(push.devices, live.customersOnline));
  r.on('GET', API.staffActivity, () => store.activity());
  r.on('GET', API.staffConversations, () => store.conversations());
  r.on('GET', API.staffTemplates, () => TEMPLATES);
  r.on('GET', API.staffAttention, () => store.attention());
  r.on('GET', API.staffOutbox, () => store.outbox());
  r.on('GET', API.staffAudit, () => store.auditLog());
  r.on('POST', API.staffAudit, ({ body }) => {
    const b = obj(body);
    const action = str(b, 'action');
    if (action !== 'CUSTOMER_VIEWED' && action !== 'REPORT_EXPORTED') throw new HttpError(400, 'Unknown audit action');
    store.logStaffAction(action, str(b, 'target'));
  });
  r.on('GET', API.staffReports, ({ url }) =>
    store.reports({ months: Number(url.searchParams.get('months') ?? 12) || 12, week: url.searchParams.get('months') === 'week', city: url.searchParams.get('city') ?? '', product: url.searchParams.get('product') ?? '', group: (url.searchParams.get('group') ?? 'all') as ReportGroup }, live.customersOnline, push.devices),
  );
  r.on('GET', API.staffPortfolio, () => store.portfolio(live.customersOnline, push.devices));
  r.on('GET', API.staffFeed, () => store.feed());
  r.on('GET', API.staffCustomers, ({ url }) =>
    store.customers({ q: url.searchParams.get('q') ?? '', filter: (url.searchParams.get('filter') ?? 'all') as CustomerFilter, page: Number(url.searchParams.get('page') ?? 1) || 1, size: Number(url.searchParams.get('size') ?? 10) || 10 }, live.customersOnline, push.devices),
  );
  r.on('GET', '/api/staff/customers/:id', ({ params }) => store.customerDetail(params.id!, live.customersOnline, push.devices));
  r.on('POST', '/api/staff/outbox/:id/cancel', ({ params }) => store.cancelOutbox(params.id!));
  r.on('POST', API.staffAssistant, ({ body }) => {
    const b = obj(body);
    const lang = str(b, 'lang');
    if (lang !== 'en' && lang !== 'nl') throw new HttpError(400, 'lang must be en or nl');
    return store.askStaff({ question: str(b, 'question'), lang, lastIntent: str(b, 'lastIntent', true) || undefined }, live.customersOnline, push.devices);
  });

  /** Phone notification for a delivered message; returns the outbox item with the device count. */
  const notify = async (message: InboxMessage, wanted: boolean): Promise<{ pushed: number; outbox: OutboxItem }> => {
    const pushed = wanted ? await push.send({ title: message.title.nl, body: message.body.nl, url: `/app${message.to === '/' ? '' : message.to}`, tag: message.id }) : 0;
    return { pushed, outbox: store.recordPushed(message.id, pushed)! };
  };
  r.on('POST', API.staffMessages, async ({ body }): Promise<StaffMessageResult> => {
    const b = obj(body);
    const icon = (b.icon === undefined ? 'bell' : str(b, 'icon')) as MessageIcon;
    if (!ICONS.includes(icon)) throw new HttpError(400, 'Unknown icon');
    const req = { title: text(b, 'title'), body: text(b, 'body'), icon, to: str(b, 'to', true) || undefined, push: bool(b, 'push'), sender: str(b, 'sender', true) || undefined, templateId: str(b, 'templateId', true) || undefined, sendAt: str(b, 'sendAt', true) || undefined, segment: (str(b, 'segment', true) || undefined) as AttentionFlag | undefined, customerId: str(b, 'customerId', true) || undefined };
    if (req.sendAt) return { message: null, pushed: 0, outbox: store.scheduleStaffMessage(req) };
    const { message, outboxId } = store.dispatch(req);
    // Only the live customer has a real phone; a message that does not include them has nothing to push.
    if (!message) return { message: null, pushed: 0, outbox: store.outboxById(outboxId)! };
    return { message, ...(await notify(message, req.push)) };
  });
  // Scheduled messages go out when they are due (checked every second; one instance, so no double sends).
  setInterval(() => {
    for (const item of store.dueOutbox()) {
      try {
        const message = store.sendScheduled(item.id);
        if (message) void notify(message, item.push).catch((e) => console.error('[outbox]', e));
      } catch (e) {
        console.error('[outbox]', e);
      }
    }
  }, 1000).unref();
  // The rest of the customer base keeps using the app: one more action every few seconds.
  setInterval(() => {
    try {
      store.simulate();
    } catch (e) {
      console.error('[simulate]', e);
    }
  }, config.simulateMs).unref();

  // ---- push
  r.on('GET', API.pushKey, () => ({ publicKey: push.publicKey }));
  r.on('POST', API.pushSubscribe, ({ body }) => {
    const b = obj(body);
    const sub = obj(b.subscription);
    const keys = obj(sub.keys);
    const endpoint = str(sub, 'endpoint');
    if (!/^https:\/\//.test(endpoint)) throw new HttpError(400, 'Push endpoint must be https');
    const isNew = push.subscribe({ subscription: { endpoint, keys: { p256dh: str(keys, 'p256dh'), auth: str(keys, 'auth') } }, device: str(b, 'device', true).slice(0, 80) || undefined });
    // The app re-registers its subscription on every start; only a new device is something the customer did.
    if (isNew) store.log('push_subscribed', { en: 'Turned on phone notifications', nl: 'Zette telefoonmeldingen aan' });
  });
  r.on('POST', API.pushUnsubscribe, ({ body }) => push.unsubscribe(str(obj(body), 'endpoint')));

  // ---- demo
  r.on('GET', API.demoInfo, ({ req }): DemoInfo => ({ phoneUrls: phoneUrls(req), startedAt, version: config.version, pushEnabled: true }));
  r.on('POST', API.demoReset, () => store.reset());
  // Kept for the mobile-preview QR, which predates the API.
  r.on('GET', '/__demo/lan', ({ req }) => ({ urls: phoneUrls(req).map((u) => `${u}/`) }));

  // ---- live
  r.on('GET', API.events, ({ req, res, url }) => {
    const role = url.searchParams.get('role') === 'staff' ? 'staff' : 'customer';
    live.connect(req, res, role);
  });

  return r;
}
