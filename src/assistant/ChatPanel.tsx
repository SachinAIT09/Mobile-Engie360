import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, RotateCcw, Sparkles, X, Maximize2, ArrowRight } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { breakdown, monthly } from '../data/energy';
import type { ChatAction, ChatMessage } from './types';
import type { ChatSession } from './useChatSession';
import './chat.css';
import { brand } from '../brand';

interface Props {
  session: ChatSession;
  variant: 'widget' | 'page';
  title?: string;
  subtitle?: string;
  welcome: string;
  onAction: (a: ChatAction) => void;
  onClose?: () => void;
  onExpand?: () => void;
  /** Extra content under the welcome message (e.g. sign-in hint). */
  intro?: ReactNode;
  /** Line under the input; defaults to Eva's. */
  disclaimer?: string;
}

/** Inline **bold**, *italic* and line breaks. Enough for scripted replies; swap for a markdown renderer later. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
        const isBullet = line.startsWith('• ');
        const content = parts.map((p, j) =>
          p.startsWith('**') ? (
            <strong key={j}>{p.slice(2, -2)}</strong>
          ) : p.startsWith('*') && p.length > 2 ? (
            <em key={j}>{p.slice(1, -1)}</em>
          ) : (
            <Fragment key={j}>{isBullet && j === 0 ? p.slice(2) : p}</Fragment>
          ),
        );
        return isBullet ? (
          <div key={i} className="chat-bullet">
            {content}
          </div>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </>
  );
}

function MiniMonthly() {
  const { tx } = useI18n();
  const max = Math.max(...monthly.map((m) => m.electricity));
  return (
    <div className="chat-chart" aria-hidden>
      <div className="mini-bars">
        {monthly.map((m, i) => (
          <div key={m.key} className="mini-bar" title={`${tx(m.label)}: ${m.electricity} kWh`}>
            <span
              style={{ height: `${(m.electricity / max) * 100}%` }}
              className={i >= 9 ? 'hl' : undefined}
            />
            <i>{tx(m.label).slice(0, 1)}</i>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBreakdown() {
  const { tx } = useI18n();
  const total = breakdown.reduce((s, b) => s + b.kwh, 0);
  return (
    <div className="chat-chart">
      {breakdown.slice(0, 5).map((b) => (
        <div key={b.key} className="mini-row">
          <span className="lbl">{tx(b.label)}</span>
          <span className="track">
            <span style={{ width: `${(b.kwh / breakdown[0]!.kwh) * 100}%`, background: b.color }} />
          </span>
          <span className="pct num">{Math.round((b.kwh / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function Bubble({ m, onAction, last }: { m: ChatMessage; onAction: (a: ChatAction) => void; last: boolean }) {
  const { date } = useI18n();
  if (m.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble">{m.text}</div>
      </div>
    );
  }
  return (
    <div className="msg bot">
      <div className="bot-ic" aria-hidden>
        <Sparkles size={14} />
      </div>
      <div className="bot-body">
        <div className="bubble">
          <Rich text={m.text} />
          {m.facts && (
            <dl className="chat-facts">
              {m.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd className={f.tone}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {m.chart === 'monthly' && <MiniMonthly />}
          {m.chart === 'breakdown' && <MiniBreakdown />}
        </div>
        {m.actions && last && (
          <div className="chat-actions">
            {m.actions.map((a) => (
              <button key={a.label} className="chat-action" onClick={() => onAction(a)}>
                {a.label}
                {a.to && <ArrowRight size={14} />}
              </button>
            ))}
          </div>
        )}
        <time className="chat-time">{date(new Date(m.ts).toISOString(), { hour: '2-digit', minute: '2-digit' })}</time>
      </div>
    </div>
  );
}

export function ChatPanel({ session, variant, title, subtitle, welcome, onAction, onClose, onExpand, intro, disclaimer }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const { messages, typing, send, reset, suggestions } = session;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const lastEl = el.querySelector<HTMLElement>('.msg:last-child');
    // Long replies: show the start of the answer, not its end.
    if (!typing && last?.role === 'assistant' && lastEl && lastEl.offsetHeight > el.clientHeight * 0.6) {
      el.scrollTo({ top: lastEl.offsetTop - 12, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, typing]);

  // Focus the input when the user opens the widget, not when a question was sent for them
  // (presenter mode / quick actions), so keyboard shortcuts keep working.
  const [focusOnMount] = useState(() => !session.typing);
  useEffect(() => {
    if (variant === 'widget' && focusOnMount) input.current?.focus({ preventScroll: true });
  }, [variant, focusOnMount]);

  const submit = () => {
    if (!draft.trim() || typing) return;
    send(draft);
    setDraft('');
  };

  return (
    <section className={`chat chat-${variant}`} aria-label={title ?? brand.assistant.name}>
      <header className="chat-head">
        <div className="chat-avatar" aria-hidden>
          <Sparkles size={18} />
        </div>
        <div className="chat-title">
          <b>{title ?? brand.assistant.name}</b>
          <span>
            <i className="online" /> {subtitle ?? t(`${brand.assistant.role.en} · replies instantly`, `${brand.assistant.role.nl} · reageert direct`)}
          </span>
        </div>
        <div className="chat-head-actions">
          {messages.length > 0 && (
            <button className="chat-icon" onClick={reset} aria-label={t('New conversation', 'Nieuw gesprek')} title={t('New conversation', 'Nieuw gesprek')}>
              <RotateCcw size={17} />
            </button>
          )}
          {onExpand && (
            <button className="chat-icon" onClick={onExpand} aria-label={t('Open full screen', 'Volledig scherm')} title={t('Open full screen', 'Volledig scherm')}>
              <Maximize2 size={17} />
            </button>
          )}
          {onClose && (
            <button className="chat-icon" onClick={onClose} aria-label={t(`Close ${brand.assistant.name}`, `Sluit ${brand.assistant.name}`)}>
              <X size={19} />
            </button>
          )}
        </div>
      </header>

      <div className="chat-scroll" ref={scroller}>
        <div className="msg bot">
          <div className="bot-ic" aria-hidden>
            <Sparkles size={14} />
          </div>
          <div className="bot-body">
            <div className="bubble">
              <Rich text={welcome} />
            </div>
            {intro}
          </div>
        </div>

        {messages.length === 0 && (
          <div className="chat-suggest">
            <span>{t('Suggested questions', 'Veelgestelde vragen')}</span>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={m.id} m={m} onAction={onAction} last={i === messages.length - 1} />
        ))}

        {typing && (
          <div className="msg bot">
            <div className="bot-ic" aria-hidden>
              <Sparkles size={14} />
            </div>
            <div className="bubble typing" aria-label={t(`${title ?? brand.assistant.name} is typing`, `${title ?? brand.assistant.name} is aan het typen`)}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>

      {messages.length > 0 && !typing && (
        <div className="chat-chips">
          {(messages[messages.length - 1]?.followUps ?? suggestions).slice(0, 4).map((s) => (
            <button key={s} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder={t('Ask a question…', 'Stel je vraag…')}
          aria-label={t('Message', 'Bericht')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" className="chat-send" disabled={!draft.trim() || typing} aria-label={t('Send', 'Verstuur')}>
          <ArrowUp size={18} />
        </button>
      </form>
      <p className="chat-disclaimer">
        {disclaimer ?? t(`${brand.assistant.name} is your digital assistant. Answers may contain mistakes.`, `${brand.assistant.name} is je digitale assistent. Antwoorden kunnen fouten bevatten.`)}
      </p>
    </section>
  );
}
