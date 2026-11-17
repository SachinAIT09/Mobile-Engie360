/**
 * Recovering from a failed download of part of the app (a dropped request on a flaky connection).
 * A browser remembers a module that failed to load until the page is reloaded, so trying the same import
 * again cannot help: the fix is one automatic reload. The mark below makes sure that happens once, not in a
 * loop; it is cleared when the app has been running for a moment. `index.html` uses the same mark for
 * script files that fail before the app starts.
 */
const MARK = 'engie-demo-recovering';

/** True for the errors a browser raises when a lazily loaded part of the app could not be downloaded. */
export function isLoadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS/i.test(message);
}

/** Reload the page once to recover. Returns false when that was already tried (show the error screen instead). */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(MARK)) return false;
    sessionStorage.setItem(MARK, '1');
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** The app is up: a later failure may reload again. */
export function recovered(): void {
  setTimeout(() => {
    try {
      sessionStorage.removeItem(MARK);
    } catch {
      /* nothing to clear */
    }
  }, 8000);
}
