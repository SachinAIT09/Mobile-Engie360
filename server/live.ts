import type { IncomingMessage, ServerResponse } from 'node:http';
import type { LiveEvent } from '../shared/contract.ts';

export type Role = 'customer' | 'staff';

/** Events the customer app receives; staff streams get everything. */
const CUSTOMER_EVENTS = new Set<LiveEvent['type']>(['hello', 'message:new', 'message:read', 'installment:changed', 'insights:plan', 'demo:reset']);

interface Client {
  res: ServerResponse;
  role: Role;
}

/**
 * Server-Sent Events hub. Plain HTTP, so it works behind proxies that don't pass WebSockets
 * (Zoho Catalyst). With `maxMs` set, streams end early and EventSource reconnects on its own.
 */
export class Live {
  private readonly clients = new Set<Client>();
  onPresence: (online: number) => void = () => {};

  constructor(private readonly maxMs = 0) {}

  get customersOnline(): number {
    let n = 0;
    for (const c of this.clients) if (c.role === 'customer') n++;
    return n;
  }

  connect(req: IncomingMessage, res: ServerResponse, role: Role): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const client: Client = { res, role };
    this.clients.add(client);
    this.write(client, { type: 'hello', serverTime: new Date().toISOString(), role });
    if (role === 'customer') this.onPresence(this.customersOnline);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
    const limit = this.maxMs ? setTimeout(() => res.end(), this.maxMs) : null;
    const done = () => {
      clearInterval(heartbeat);
      if (limit) clearTimeout(limit);
      if (this.clients.delete(client) && role === 'customer') this.onPresence(this.customersOnline);
    };
    req.on('close', done);
    res.on('close', done);
  }

  emit(event: LiveEvent): void {
    for (const c of this.clients) {
      if (c.role === 'staff' || CUSTOMER_EVENTS.has(event.type)) this.write(c, event);
    }
  }

  closeAll(): void {
    for (const c of this.clients) c.res.end();
    this.clients.clear();
  }

  private write(c: Client, event: LiveEvent): void {
    c.res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }
}
