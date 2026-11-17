import { useRef } from 'react';
import { Mic, Square } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useSpeech } from '../lib/useSpeech';

/**
 * Microphone button for a text box: tap, speak, and the words appear in the box as you talk
 * (after whatever was already typed). Tap again to stop. Nothing is sent until the user sends it.
 */
export function VoiceButton({ value, onChange, className }: { value: string; onChange: (text: string) => void; className: string }) {
  const { t, lang } = useI18n();
  // What was in the box when listening started; the spoken words go after it.
  const base = useRef('');
  const speech = useSpeech(lang, (heard) => onChange(base.current ? `${base.current} ${heard}` : heard));

  const label = !speech.supported
    ? t('Voice input is not available in this browser', 'Spraakinvoer is niet beschikbaar in deze browser')
    : speech.blocked
      ? t('The microphone is blocked. Allow it in your browser settings.', 'De microfoon is geblokkeerd. Sta hem toe in je browserinstellingen.')
      : speech.listening
        ? t('Stop listening', 'Stop met luisteren')
        : t('Speak your question', 'Spreek je vraag in');

  return (
    <button
      type="button"
      className={`${className}${speech.listening ? ' listening' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={speech.listening}
      disabled={!speech.supported}
      onClick={() => {
        if (speech.listening) return speech.stop();
        base.current = value.trim();
        speech.start();
      }}
    >
      {speech.listening ? <Square size={15} fill="currentColor" /> : <Mic size={18} />}
    </button>
  );
}
