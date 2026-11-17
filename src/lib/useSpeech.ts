import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lang } from './i18n';

/**
 * Voice to text with the browser's own speech recognition (Chrome, Edge, Safari). Nothing is
 * installed and no audio passes through our server; the browser does the recognising, which in
 * Chrome means its speech service. Where it is missing (Firefox), `supported` is false.
 */
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface Speech {
  /** The browser can do voice to text. */
  supported: boolean;
  listening: boolean;
  /** The microphone was refused (by the user or the browser settings). */
  blocked: boolean;
  start: () => void;
  stop: () => void;
}

/** `onText` gets everything heard so far each time more is recognised (so it can be shown while speaking). */
export function useSpeech(lang: Lang, onText: (text: string) => void): Speech {
  const [listening, setListening] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });
  // Stop listening when the chat closes.
  useEffect(() => () => rec.current?.abort(), []);

  const stop = useCallback(() => rec.current?.stop(), []);
  const start = useCallback(() => {
    const Ctor = ctor();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = lang === 'nl' ? 'nl-NL' : 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i]?.[0]?.transcript ?? '';
      onTextRef.current(text.trim());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setBlocked(true);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setBlocked(false);
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
    }
  }, [lang]);

  return { supported: !!ctor(), listening, blocked, start, stop };
}
