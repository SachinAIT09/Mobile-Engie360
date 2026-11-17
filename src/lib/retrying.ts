/**
 * Screens are loaded on demand. On a flaky connection one of those small downloads can fail (a dropped
 * request, a web filter hiccup); without a retry the screen would stay blank. `retrying` wraps a loader so a
 * failed download is tried again a few times, a little later each time, before giving up.
 */
export function retrying<T>(load: () => Promise<T>, attempts = 3, waitMs = 400): () => Promise<T> {
  return async () => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await load();
      } catch (e) {
        last = e;
        if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs * (i + 1)));
      }
    }
    throw last;
  };
}
