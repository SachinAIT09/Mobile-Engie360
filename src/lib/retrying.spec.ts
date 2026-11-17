import { describe, expect, it } from 'vitest';
import { retrying } from './retrying';

describe('retrying', () => {
  it('returns the first success without waiting', async () => {
    let calls = 0;
    expect(await retrying(async () => (calls++, 'ok'))()).toBe('ok');
    expect(calls).toBe(1);
  });

  it('tries again after a failure and succeeds', async () => {
    let calls = 0;
    const load = retrying(async () => {
      if (++calls < 3) throw new Error('Failed to fetch dynamically imported module');
      return 'screen';
    }, 3, 1);
    expect(await load()).toBe('screen');
    expect(calls).toBe(3);
  });

  it('gives up with the last error after the last attempt', async () => {
    let calls = 0;
    const load = retrying(async () => {
      throw new Error(`attempt ${++calls}`);
    }, 3, 1);
    await expect(load()).rejects.toThrow('attempt 3');
  });
});
