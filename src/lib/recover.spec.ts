import { describe, expect, it } from 'vitest';
import { isLoadFailure } from './recover';

describe('isLoadFailure', () => {
  it('recognises a failed download of part of the app in each browser', () => {
    expect(isLoadFailure(new TypeError('Failed to fetch dynamically imported module: https://x/assets/StaffApp-B89.js'))).toBe(true); // Chrome
    expect(isLoadFailure(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true); // Firefox
    expect(isLoadFailure(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(isLoadFailure(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
  });

  it('leaves ordinary errors alone', () => {
    expect(isLoadFailure(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(isLoadFailure('boom')).toBe(false);
  });
});
