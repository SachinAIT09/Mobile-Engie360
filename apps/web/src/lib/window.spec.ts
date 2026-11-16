import { describe, expect, it } from 'vitest';
import { upcomingWindow } from './window';

// Amsterdam is UTC+2 in October (CEST) and UTC+1 from the last Sunday of October (CET).
describe('upcomingWindow', () => {
  it('before 17:00 Amsterdam time: today 17:00–20:00, seconds zeroed', () => {
    const w = upcomingWindow(new Date('2026-10-23T12:17:45.123Z')); // 14:17:45 CEST
    expect(w.start).toBe('2026-10-23T15:00:00.000Z');
    expect(w.end).toBe('2026-10-23T18:00:00.000Z');
  });

  it('just before 17:00 still targets today 17:00', () => {
    const w = upcomingWindow(new Date('2026-10-23T14:59:30Z')); // 16:59:30 CEST
    expect(w.start).toBe('2026-10-23T15:00:00.000Z');
  });

  it('after 17:00: the next full hour plus three hours', () => {
    const w = upcomingWindow(new Date('2026-10-23T16:20:10Z')); // 18:20:10 CEST
    expect(w.start).toBe('2026-10-23T17:00:00.000Z');
    expect(w.end).toBe('2026-10-23T20:00:00.000Z');
  });

  it('exactly on the hour after 17:00 moves to the following hour', () => {
    const w = upcomingWindow(new Date('2026-10-23T16:00:00Z')); // 18:00 CEST
    expect(w.start).toBe('2026-10-23T17:00:00.000Z');
  });

  it('late evening rolls into the next day', () => {
    const w = upcomingWindow(new Date('2026-10-23T21:10:00Z')); // 23:10 CEST
    expect(w.start).toBe('2026-10-23T22:00:00.000Z');
    expect(w.end).toBe('2026-10-24T01:00:00.000Z');
  });

  it('uses winter time after the October change', () => {
    const w = upcomingWindow(new Date('2026-11-16T13:20:00Z')); // 14:20 CET
    expect(w.start).toBe('2026-11-16T16:00:00.000Z');
  });

  it('honours an explicit timezone', () => {
    const w = upcomingWindow(new Date('2026-10-23T10:00:00Z'), 'UTC');
    expect(w.start).toBe('2026-10-23T17:00:00.000Z');
    expect(w.end).toBe('2026-10-23T20:00:00.000Z');
  });

  it('always spans three hours', () => {
    for (const iso of ['2026-10-23T05:00:00Z', '2026-10-23T18:33:00Z', '2026-10-23T23:59:00Z']) {
      const w = upcomingWindow(new Date(iso));
      expect(Date.parse(w.end) - Date.parse(w.start)).toBe(3 * 3600000);
    }
  });
});
