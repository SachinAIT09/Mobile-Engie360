/**
 * Small sounds made in the browser (Web Audio): nothing to download, works offline.
 * Browsers only allow sound that starts from a tap, so call `primeSound()` in the tap handler
 * (the Pay button) and the chime itself can then play a moment later, when the payment is done.
 */
type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap/click handler: unlocks sound for what follows. Safe to call any number of times. */
export function primeSound(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

/** One soft bell note. */
function note(c: AudioContext, freq: number, at: number, length: number, volume: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Quick rise, long fade: a bell, not a beep.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/**
 * "Payment done": two rising bell notes (about half a second), plus a short buzz on phones that
 * support it. Silent, without errors, where sound is not available.
 */
export function playPaymentDone(): void {
  try {
    navigator.vibrate?.(60);
  } catch {
    /* vibration not allowed here */
  }
  const c = context();
  if (!c || c.state !== 'running') return;
  try {
    const t0 = c.currentTime + 0.02;
    note(c, 1046.5, t0, 0.35, 0.16); // C6
    note(c, 1568, t0 + 0.11, 0.55, 0.18); // G6
    note(c, 2093, t0 + 0.11, 0.45, 0.06); // C7, a little shine on the second note
  } catch {
    /* no sound is fine */
  }
}
