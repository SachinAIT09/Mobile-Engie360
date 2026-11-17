import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LiveEvent } from '../shared/contract.ts';

export type Role = 'customer' | 'staff';

/** Events the customer app receives; staff streams get everything. */
const CUSTOMER_EVENTS = new Set<LiveEvent['type']>(['hello', 'message:new', 'message:read', 'installment:changed', 'billing:changed', 'insights:plan', 'demo:reset']);

interface Client {
  res: ServerResponse;
  role: Role;
}

/** How many past events are kept so a reconnecting stream can catch up. */
const REPLAY = 300;
/** The furthest back a stream may ask to be replayed by age. */
const MAX_REPLAY_MS = 60_000;
/** A "short" stream ends after this long; see `connect`. */
const SHORT_MS = 2500;

/**
 * Server-Sent Events hub. Plain HTTP, so it works behind proxies that don't pass WebSockets
 * (Zoho Catalyst). With `maxMs` set, streams end early and EventSource reconnects on its own.
 *
 * Every event carries an id. A stream that reconnects sends the last id it saw (the browser does this by
 * itself) and gets what it missed, so ending and reopening streams loses nothing. That is what makes
 * "short" streams possible: some networks (antivirus web filters, company proxies) hold a streamed
 * response back until it ends; a client that notices this asks for streams of a few seconds, and so still
 * gets every event within a few seconds.
 */
export class Live {
  private readonly clients = new Set<Client>();
  private readonly recent: { id: number; at: number; event: LiveEvent }[] = [];
  private seq = 0;
  /** The customer count last told to staff, and the pending "someone left" announcement. */
  private announced = 0;
  private leaving: ReturnType<typeof setTimeout> | null = null;
  onPresence: (online: number) => void = () => {};

  constructor(
    private readonly maxMs = 0,
    /** A stream that reconnects is back within a moment: wait this long before telling staff a customer left. */
    private readonly graceMs = 3000,
  ) {}

  private get connected(): number {
    let n = 0;
    for (const c of this.clients) if (c.role === 'customer') n++;
    return n;
  }

  /** Customers in the app now. While a customer's stream is reconnecting they still count. */
  get customersOnline(): number {
    return this.leaving ? this.announced : this.connected;
  }

  /**
   * `replayMs`: for a stream without a Last-Event-ID, also send the events of the last so many milliseconds.
   * A client that gave up on a held-back stream uses it to get what that stream never delivered.
   */
  connect(req: IncomingMessage, res: ServerResponse, role: Role, short = false, replayMs = 0): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`retry: ${short ? 400 : 2000}\n\n`);
    const client: Client = { res, role };

    // Catch up on what this client missed while it was reconnecting.
    const header = req.headers['last-event-id'];
    const last = header === undefined ? null : Number(Array.isArray(header) ? header[0] : header);
    const oldest = this.recent[0]?.id ?? this.seq + 1;
    // Too far behind to replay, or ids from before a restart: tell the client to reload its data.
    const stale = last !== null && (!Number.isFinite(last) || last > this.seq || last < oldest - 1);
    // The hello carries the current position, so a stream that ends before any other event arrives still
    // reconnects with a Last-Event-ID and gets whatever was sent in between.
    res.write(`id: ${this.seq}\nevent: hello\ndata: ${JSON.stringify({ type: 'hello', serverTime: new Date().toISOString(), role, ...(stale ? { stale: true } : {}) } satisfies LiveEvent)}\n\n`);
    if (last !== null && !stale) for (const r of this.recent) if (r.id > last && this.allowed(role, r.event)) this.write(client, r.id, r.event);
    if (last === null && replayMs > 0) {
      const since = Date.now() - Math.min(replayMs, MAX_REPLAY_MS);
      for (const r of this.recent) if (r.at >= since && this.allowed(role, r.event)) this.write(client, r.id, r.event);
    }

    this.clients.add(client);
    if (role === 'customer') this.presenceChanged();

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
    const lifetime = short ? SHORT_MS : this.maxMs;
    const limit = lifetime ? setTimeout(() => res.end(), lifetime) : null;
    const done = () => {
      clearInterval(heartbeat);
      if (limit) clearTimeout(limit);
      if (this.clients.delete(client) && role === 'customer') this.presenceChanged();
    };
    req.on('close', done);
    res.on('close', done);
  }

  emit(event: LiveEvent): void {
    const id = ++this.seq;
    this.recent.push({ id, at: Date.now(), event });
    if (this.recent.length > REPLAY) this.recent.shift();
    for (const c of this.clients) if (this.allowed(c.role, event)) this.write(c, id, event);
  }

  closeAll(): void {
    if (this.leaving) clearTimeout(this.leaving);
    this.leaving = null;
    for (const c of this.clients) c.res.end();
    this.clients.clear();
  }

  private allowed(role: Role, event: LiveEvent): boolean {
    return role === 'staff' || CUSTOMER_EVENTS.has(event.type);
  }

  /** A customer joined or left. Joining is announced at once; leaving after `graceMs`, if they are still gone. */
  private presenceChanged(): void {
    const now = this.connected;
    if (now >= this.announced) {
      if (this.leaving) clearTimeout(this.leaving);
      this.leaving = null;
      if (now !== this.announced) this.announce(now);
      return;
    }
    if (this.leaving) return;
    this.leaving = setTimeout(() => {
      this.leaving = null;
      if (this.connected !== this.announced) this.announce(this.connected);
    }, this.graceMs);
  }

  private announce(online: number): void {
    this.announced = online;
    this.onPresence(online);
  }

  private write(c: Client, id: number, event: LiveEvent): void {
    c.res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
