import { describe, expect, it } from 'vitest';
import type { CustomerActivity } from '@engie/shared';
import { groupByDay, prependActivity, unreadCount } from './activity';

const a = (id: string, at: string): CustomerActivity => ({
  id,
  at,
  customerId: 'c1',
  customerName: 'Sanne de Vries',
  districtCode: '3581',
  kind: 'PAYMENT_MADE',
  category: 'billing',
  summary: 'Paid',
});

describe('prependActivity', () => {
  it('puts the newest first and caps the list', () => {
    const list = [a('2', '2026-10-27T14:00:00Z'), a('1', '2026-10-27T13:00:00Z')];
    expect(prependActivity(list, a('3', '2026-10-27T15:00:00Z'), 2).map((x) => x.id)).toEqual(['3', '2']);
  });
  it('ignores an entry it already has', () => {
    const list = [a('1', '2026-10-27T13:00:00Z')];
    expect(prependActivity(list, a('1', '2026-10-27T13:00:00Z'))).toBe(list);
  });
  it('starts from null', () => {
    expect(prependActivity(null, a('1', '2026-10-27T13:00:00Z'))).toHaveLength(1);
  });
});

describe('unreadCount', () => {
  it('counts entries after the seen time', () => {
    const list = [a('3', '2026-10-27T15:00:00Z'), a('2', '2026-10-27T14:00:00Z'), a('1', '2026-10-27T13:00:00Z')];
    expect(unreadCount(list, '2026-10-27T13:30:00Z')).toBe(2);
    expect(unreadCount(list, '2026-10-27T15:00:00Z')).toBe(0);
  });
});

describe('groupByDay', () => {
  it('groups by Dutch day in order', () => {
    // 23:30Z on the 27th is already the 28th in Amsterdam.
    const list = [a('3', '2026-10-28T15:00:00Z'), a('2', '2026-10-27T23:30:00Z'), a('1', '2026-10-27T13:00:00Z')];
    const g = groupByDay(list);
    expect(g.map((d) => d.items.map((x) => x.id))).toEqual([['3', '2'], ['1']]);
    expect(g[1].day).toContain('27');
  });
});
