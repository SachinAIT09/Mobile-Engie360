import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveEvent } from '../shared/contract.ts';
import { Live, type Role } from './live.ts';

/** A stream as the hub sees it: what was written, and a way to close it from the client side. */
function stream(live: Live, role: Role, opts: { lastId?: string; short?: boolean; replayMs?: number } = {}) {
  const req = Object.assign(new EventEmitter(), { headers: opts.lastId === undefined ? {} : { 'last-event-id': opts.lastId } });
  const chunks: string[] = [];
  const res = Object.assign(new EventEmitter(), {
    ended: false,
    writeHead: () => res,
    write: (c: string) => (chunks.push(c), true),
    end: () => {
      res.ended = true;
      res.emit('close');
    },
  });
  live.connect(req as unknown as IncomingMessage, res as unknown as ServerResponse, role, opts.short, opts.replayMs);
  const events = () =>
    chunks
      .join('')
      .split('\n\n')
      .filter((b) => b.includes('data: '))
      .map((b) => ({ id: Number(/^id: (\d+)$/m.exec(b)?.[1] ?? 0), event: JSON.parse(/^data: (.*)$/m.exec(b)![1]!) as LiveEvent }));
  return { res, chunks, events, types: () => events().map((e) => e.event.type), close: () => req.emit('close') };
}

const plan = (n: number): LiveEvent => ({ type: 'insights:plan', plan: [`p${n}`] });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Live: event ids and catching up after a reconnect', () => {
  it('numbers events, and replays what a reconnecting stream missed', () => {
    const live = new Live();
    const first = stream(live, 'customer');
    live.emit(plan(1));
    live.emit(plan(2));
    expect(first.events().map((e) => e.id)).toEqual([0, 1, 2]); // hello carries the position so far (0)
    first.close();
    live.emit(plan(3));
    live.emit({ type: 'outbox:changed' }); // staff only
    live.emit(plan(4));
    const again = stream(live, 'customer', { lastId: '2' });
    expect(again.events().filter((e) => e.event.type !== 'hello').map((e) => e.id)).toEqual([3, 5]); // 4 was not for customers
    const staff = stream(live, 'staff', { lastId: '2' });
    expect(staff.events().filter((e) => e.event.type !== 'hello').map((e) => e.id)).toEqual([3, 4, 5]);
    // A stream that only ever got its hello still knows where it was: the hello carries the position.
    const idle = stream(live, 'customer');
    expect(idle.events()[0]).toMatchObject({ id: 5, event: { type: 'hello' } });
    idle.close();
    live.emit(plan(6));
    expect(stream(live, 'customer', { lastId: '5' }).events().map((e) => e.id)).toEqual([6, 6]); // hello at 6, then event 6
    // A first connection (no Last-Event-ID) gets no history.
    expect(stream(live, 'staff').types()).toEqual(['hello']);
  });

  it('says "stale" when the client is too far behind or its ids are from before a restart', () => {
    const live = new Live();
    for (let i = 1; i <= 320; i++) live.emit(plan(i));
    const hello = (lastId: string) => stream(live, 'staff', { lastId }).events()[0]!.event;
    expect(hello('319')).not.toHaveProperty('stale');
    expect(hello('5')).toMatchObject({ type: 'hello', stale: true }); // older than the 300 kept
    expect(hello('9999')).toMatchObject({ stale: true }); // the server restarted since
    expect(hello('abc')).toMatchObject({ stale: true });
    expect(stream(live, 'staff', { lastId: '5' }).types()).toEqual(['hello']); // nothing replayed
  });

  it('replays by age for a stream that never received anything (it gave up on a held-back stream)', () => {
    const live = new Live();
    live.emit(plan(1)); // 10 s ago
    vi.advanceTimersByTime(10_000);
    live.emit(plan(2)); // 3 s ago
    live.emit({ type: 'outbox:changed' }); // staff only
    vi.advanceTimersByTime(3000);
    const replayed = (role: Role, o: { lastId?: string; replayMs?: number }) =>
      stream(live, role, o)
        .events()
        .filter((e) => e.event.type !== 'hello')
        .map((e) => e.id);
    expect(replayed('customer', { replayMs: 5000 })).toEqual([2]);
    expect(replayed('staff', { replayMs: 5000 })).toEqual([2, 3]);
    expect(replayed('staff', { replayMs: 60_000 })).toEqual([1, 2, 3]);
    // A stream that knows where it was uses its id, not the age.
    expect(stream(live, 'staff', { lastId: '3', replayMs: 60_000 }).types()).toEqual(['hello']);
  });

  it('ends a short stream after a few seconds and asks for a quick reconnect', () => {
    const live = new Live();
    const s = stream(live, 'staff', { short: true });
    expect(s.chunks[0]).toBe('retry: 400\n\n');
    vi.advanceTimersByTime(2400);
    expect(s.res.ended).toBe(false);
    vi.advanceTimersByTime(200);
    expect(s.res.ended).toBe(true);
    const normal = stream(live, 'staff');
    expect(normal.chunks[0]).toBe('retry: 2000\n\n');
    vi.advanceTimersByTime(60_000);
    expect(normal.res.ended).toBe(false);
  });
});

describe('Live: who is in the app', () => {
  it('announces a customer at once, and a customer leaving only after the grace period', () => {
    const live = new Live(0, 3000);
    const seen: number[] = [];
    live.onPresence = (n) => seen.push(n);
    const a = stream(live, 'customer');
    expect(seen).toEqual([1]);
    expect(live.customersOnline).toBe(1);
    // The stream reconnects (short streams do this every few seconds): staff must not see a flicker.
    a.close();
    expect(live.customersOnline).toBe(1);
    vi.advanceTimersByTime(500);
    const b = stream(live, 'customer');
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([1]);
    // Really gone: announced after the grace period.
    b.close();
    vi.advanceTimersByTime(2900);
    expect(seen).toEqual([1]);
    vi.advanceTimersByTime(200);
    expect(seen).toEqual([1, 0]);
    expect(live.customersOnline).toBe(0);
  });

  it('staff streams do not count as customers', () => {
    const live = new Live();
    const seen: number[] = [];
    live.onPresence = (n) => seen.push(n);
    stream(live, 'staff');
    expect(seen).toEqual([]);
    expect(live.customersOnline).toBe(0);
  });
});
