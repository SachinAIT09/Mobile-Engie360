import { useEffect, useState, useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(cb: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
const reducedNow = () => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches;

/** Total reveal time cap and per-word pace. */
const MAX_MS = 1200;
const MS_PER_WORD = 32;

/**
 * Word-by-word reveal (as in the Hydro staff assistant): returns how many of `total` words to show.
 * Done within 1.2 s; instant when `animate` is false or the user prefers reduced motion.
 * State only changes inside animation-frame callbacks, never synchronously in the effect.
 */
export function useTypewriter(total: number, animate = true): { count: number; done: boolean } {
  const reduced = useSyncExternalStore(subscribe, reducedNow, () => false);
  const run = animate && !reduced && total > 0;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!run) return;
    const duration = Math.min(MAX_MS, total * MS_PER_WORD);
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      start ??= t;
      const n = Math.min(total, Math.max(1, Math.ceil(((t - start) / duration) * total)));
      setCount(n);
      if (n < total) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // Animation frames pause in background tabs: make sure the answer is complete when the user comes back.
    const finish = window.setTimeout(() => setCount(total), duration + 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(finish);
    };
  }, [run, total]);

  const shown = run ? count : total;
  return { count: shown, done: shown >= total };
}

export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The first `count` words of `text`, keeping line breaks and closing a **bold** run cut in half. */
export function revealWords(text: string, count: number): string {
  let seen = 0;
  let out = '';
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      out += part;
      continue;
    }
    if (seen >= count) break;
    out += part;
    seen++;
  }
  out = out.trimEnd();
  return (out.match(/\*\*/g)?.length ?? 0) % 2 === 1 ? `${out}**` : out;
}
