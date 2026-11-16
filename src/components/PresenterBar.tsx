import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Presentation, RotateCcw, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { DEMO_STEPS, initialStep, initialVisible, isTyping, saveStep, saveVisible } from '../lib/presenter';

/**
 * Presenter mode in the staff app: Shift+P toggles a bar that walks through the demo script.
 * Hotkeys while shown: N / → next, B / ← back, 1–6 jump, R reset, Esc hide.
 */
export function PresenterBar({ onReset }: { onReset: () => void }) {
  const { t, tx } = useI18n();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(initialVisible);
  const [step, setStep] = useState(initialStep);

  const go = useCallback(
    (n: number) => {
      const i = Math.max(0, Math.min(DEMO_STEPS.length - 1, n));
      const s = DEMO_STEPS[i];
      if (!s) return;
      setStep(i);
      saveStep(i);
      navigate(s.route);
    },
    [navigate],
  );

  const reset = useCallback(() => {
    setStep(0);
    saveStep(0);
    onReset();
    navigate(DEMO_STEPS[0]!.route);
  }, [navigate, onReset]);

  const toggle = useCallback(() => {
    saveVisible(!visible);
    setVisible(!visible);
  }, [visible]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !isTyping(e.target)) {
        e.preventDefault();
        toggle();
        return;
      }
      if (!visible || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'n' || e.key === 'ArrowRight') go(step + 1);
      else if (k === 'b' || e.key === 'ArrowLeft') go(step - 1);
      else if (k === 'r') reset();
      else if (e.key === 'Escape') {
        // Escape belongs to an open dialog or menu first.
        if (document.querySelector('.modal, .popover')) return;
        toggle();
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= DEMO_STEPS.length) go(Number(e.key) - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, reset, step, toggle, visible]);

  if (!visible) return null;
  const s = DEMO_STEPS[step]!;
  return (
    <div className="presenter" role="region" aria-label={t('Presenter mode', 'Presentatiemodus')}>
      <span className="presenter-ic" aria-hidden>
        <Presentation size={18} />
      </span>
      <div className="presenter-dots" aria-hidden>
        {DEMO_STEPS.map((d, i) => (
          <button key={i} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => go(i)} tabIndex={-1} title={tx(d.title)} />
        ))}
      </div>
      <div className="presenter-text">
        <b>
          {step + 1}/{DEMO_STEPS.length} · {tx(s.title)}
        </b>
        <span>{tx(s.say)}</span>
      </div>
      <div className="presenter-ctrls">
        <button onClick={() => go(step - 1)} disabled={step === 0} aria-label={t('Previous step (B)', 'Vorige stap (B)')}>
          <ChevronLeft size={18} />
        </button>
        <button className="next" onClick={() => go(step + 1)} disabled={step === DEMO_STEPS.length - 1} aria-label={t('Next step (N)', 'Volgende stap (N)')}>
          {t('Next', 'Volgende')} <ChevronRight size={16} />
        </button>
        <button onClick={reset} aria-label={t('Reset demo (R)', 'Demo resetten (R)')} title={t('Reset demo (R)', 'Demo resetten (R)')}>
          <RotateCcw size={16} />
        </button>
        <button onClick={toggle} aria-label={t('Hide presenter bar (Esc)', 'Verberg presentatiebalk (Esc)')}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
