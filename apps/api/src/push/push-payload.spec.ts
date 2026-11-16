import { describe, expect, it } from 'vitest';
import { appUrl, clip, flexEventPayload, messagePayload } from './push-payload.js';

describe('push payload', () => {
  it('opens app routes under /app', () => {
    expect(appUrl('/messages/abc')).toBe('/app/messages/abc');
    expect(appUrl('flex-events/x')).toBe('/app/flex-events/x');
    expect(appUrl('/')).toBe('/app');
  });

  it('clips long bodies and collapses whitespace', () => {
    expect(clip('a  b\n c')).toBe('a b c');
    const long = 'word '.repeat(60);
    const out = clip(long, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });

  it('builds a notification from a message', () => {
    const p = messagePayload({ id: 'm1', kind: 'CHARGING', title: 'Je auto is opgeladen', body: 'Klaar om 06:04.', route: '/messages/m1' });
    expect(p).toEqual({ title: 'Je auto is opgeladen', body: 'Klaar om 06:04.', url: '/app/messages/m1', tag: 'CHARGING-m1' });
  });

  it('notifies flex event start and end, not scheduling', () => {
    expect(flexEventPayload({ id: 'e1', status: 'SCHEDULED', title: 'Pause charging' })).toBeNull();
    expect(flexEventPayload({ id: 'e1', status: 'ACTIVE', title: 'Later laden 17:00–20:00' })).toEqual({
      title: 'Het flexmoment is begonnen',
      body: 'Later laden 17:00–20:00',
      url: '/app/flex-events/e1',
      tag: 'flex-e1',
    });
    const ended = flexEventPayload({ id: 'e1', status: 'ENDED', title: 'x' });
    expect(ended?.url).toBe('/app/flex-events/e1/result');
    expect(ended?.title).toBe('Bedankt voor het meedoen: bekijk je resultaat');
    expect(ended?.tag).toBe('flex-e1');
  });
});
