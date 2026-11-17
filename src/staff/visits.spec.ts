import { describe, expect, it } from 'vitest';
import type { Activity, ActivityKind } from '../../shared/contract';
import { groupVisits, visitMinutes } from './visits';

let n = 0;
const at = (time: string, kind: ActivityKind, en: string): Activity => ({ id: `a${n++}`, ts: `2026-11-16T${time}Z`, kind, text: { en, nl: en.replace(/^Viewed /, 'Bekeek ') } });

describe('groupVisits', () => {
  it('turns the raw log into visits: repeats removed, screens separate from actions', () => {
    // Newest first, as the server returns it.
    const log = [
      at('19:35:00', 'page', 'Viewed Home'),
      at('19:34:51', 'push_subscribed', 'Turned on phone notifications'),
      at('19:34:40', 'push_subscribed', 'Turned on phone notifications'),
      at('19:34:31', 'page', 'Viewed Home'),
      at('19:34:30', 'page', 'Viewed My account'),
      at('19:34:00', 'session', 'Signed in to MijnENGIE'),
      at('08:02:00', 'staff_message', 'ENGIE sent “Hello”'),
      at('08:01:00', 'installment', 'Changed installment to €198 from December'),
      at('08:00:00', 'page', 'Viewed Bills & payments'),
    ];
    const visits = groupVisits(log);
    expect(visits).toHaveLength(2);
    const [evening, morning] = visits;
    expect(evening!.actions.map((a) => a.text.en)).toEqual(['Turned on phone notifications']);
    expect(evening!.screens.map((s) => s.en)).toEqual(['My account', 'Home']);
    expect(evening!.screens[0]!.nl).toBe('My account');
    expect(visitMinutes(evening!)).toBe(1);
    // Staff's own message is not customer activity.
    expect(morning!.actions.map((a) => a.kind)).toEqual(['installment']);
    expect(morning!.screens.map((s) => s.en)).toEqual(['Bills & payments']);
  });

  it('a pause of more than 30 minutes starts a new visit', () => {
    expect(groupVisits([at('10:31:00', 'page', 'Viewed Home'), at('10:00:00', 'page', 'Viewed Home')])).toHaveLength(2);
    expect(groupVisits([at('10:29:00', 'page', 'Viewed Home'), at('10:00:00', 'page', 'Viewed Home')])).toHaveLength(1);
    expect(groupVisits([])).toEqual([]);
  });
});
