import { Fragment, useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, History, Mic, PenLine, Send, Sparkles, SquarePen } from 'lucide-react';
import type { EnergyResponse } from '../../../shared/contract';
import { STAFF_SUGGESTIONS, staffPhrase } from '../../assistant/staff';
import type { AssistantReply } from '../../assistant/types';
import { useI18n } from '../../lib/i18n';
import { revealWords, useTypewriter, wordCount } from '../../lib/useTypewriter';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { STAFF_NAME } from '../kinds';
import { StaffHead } from '../parts';
import type { Turn } from '../useStaffAssistant';

/** Paragraphs, "• " bullets and **bold**. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        const bullet = line.startsWith('• ');
        const parts = (bullet ? line.slice(2) : line).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const content = parts.map((p, j) => (p.startsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>));
        return bullet ? (
          <p key={i} className="ai-bullet">
            {content}
          </p>
        ) : (
          <p key={i}>{content}</p>
        );
      })}
    </>
  );
}

/** Usage per month or per appliance, from the sample energy data. */
function MiniChart({ kind, energy }: { kind: 'monthly' | 'breakdown'; energy: EnergyResponse }) {
  const { t, tx } = useI18n();
  const points =
    kind === 'monthly'
      ? energy.monthly.map((m) => ({ label: tx(m.label).slice(0, 3), value: m.electricity, hi: (m.ev ?? 0) > 0 }))
      : energy.breakdown.map((b, i) => ({ label: tx(b.label).split(' ')[0] ?? '', value: b.kwh, hi: i === 0 }));
  const caption = kind === 'monthly' ? t('Electricity per month, kWh (months with EV charging highlighted)', 'Stroom per maand, kWh (maanden met auto laden gemarkeerd)') : t('Electricity per appliance in October, kWh', 'Stroom per apparaat in oktober, kWh');
  return <BarsChart caption={caption} points={points} />;
}

/** Inline SVG bar chart with a screen-reader table (no chart library needed on this page). */
function BarsChart({ caption, points }: { caption: string; points: { label: string; value: number; hi?: boolean }[] }) {
  const id = useId();
  const W = 320;
  const H = 140;
  const base = H - 22;
  const top = 18;
  const max = Math.max(...points.map((p) => p.value));
  const slot = W / points.length;
  const bw = Math.min(26, slot * 0.6);
  return (
    <figure className="ai-chart" aria-labelledby={`${id}-cap`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-cap`} preserveAspectRatio="none">
        <line x1={0} x2={W} y1={base} y2={base} className="axis" />
        {points.map((p, i) => {
          const h = Math.max(1, ((base - top) * p.value) / max);
          const x = i * slot + (slot - bw) / 2;
          return (
            <g key={i}>
              <rect x={x} y={base - h} width={bw} height={h} rx={Math.min(6, bw / 3)} className={p.hi ? 'ai-bar hi' : 'ai-bar'} />
              {points.length <= 8 && (
                <text x={x + bw / 2} y={base - h - 4} textAnchor="middle" className="val">
                  {p.value.toLocaleString('en-GB')}
                </text>
              )}
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" className="lab">
                {p.label.length > 8 ? `${p.label.slice(0, 7)}…` : p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption id={`${id}-cap`} className="xs muted">
        {caption}
      </figcaption>
      <table className="sr-only">
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.label}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const TONE = { up: 'warn', down: 'ok' } as const;

/** One answer: text revealed word by word, then key numbers, chart, draft card, buttons and follow-up chips. */
function AnswerView({ answer, animate, onAsk, onNavigate, onGrow }: { answer: AssistantReply; animate: boolean; onAsk: (q: string) => void; onNavigate: (to: string) => void; onGrow: () => void }) {
  const { t } = useI18n();
  const { energy } = useStaff();
  const total = wordCount(answer.text);
  const { count, done } = useTypewriter(total, animate);
  useEffect(() => {
    onGrow();
  }, [count, done, onGrow]);
  // With a draft card, its own button opens the composer; the same action is not repeated below.
  const actions = (answer.actions ?? []).filter((a) => a.to && !(answer.draft && a.to.startsWith('/staff/messages')));
  return (
    <div className="ai-bubble bot" aria-busy={!done}>
      <Rich text={done ? answer.text : revealWords(answer.text, count)} />
      {done && (
        <>
          {answer.facts && answer.facts.length > 0 && (
            <ul className="ai-facts" aria-label={t('Key numbers', 'Kerncijfers')}>
              {answer.facts.map((f) => (
                <li key={f.label} className={`ai-fact ${f.tone ? TONE[f.tone] : ''}`}>
                  <span>{f.label}</span>
                  <strong>{f.value}</strong>
                </li>
              ))}
            </ul>
          )}
          {answer.bars && <BarsChart caption={answer.bars.caption} points={answer.bars.points} />}
          {answer.chart && energy && <MiniChart kind={answer.chart} energy={energy} />}
          {answer.draft && (
            <div className="ai-draft">
              <span className="badge pur">
                <PenLine size={12} aria-hidden /> {t('Draft message', 'Conceptbericht')}
              </span>
              <strong>{answer.draft.title}</strong>
              <p>{answer.draft.body}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onNavigate(answer.draft!.to ?? `/staff/messages?template=${answer.draft!.templateId}`)}>
                <Send size={14} /> {t('Open in the composer', 'Open in de editor')}
              </button>
            </div>
          )}
          {actions.length > 0 && (
            <div className="ai-actions">
              {actions.map((a) => (
                <button key={a.label} type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate(a.to!)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {answer.followUps && answer.followUps.length > 0 && (
            <div className="ai-follow" role="group" aria-label={t('Follow-up questions', 'Vervolgvragen')}>
              {answer.followUps.map((f) => (
                <button key={f} type="button" className="ai-chip" onClick={() => onAsk(f)}>
                  {f}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TurnView({ turn, latest, onAsk, onNavigate, onGrow }: { turn: Turn; latest: boolean; onAsk: (q: string) => void; onNavigate: (to: string) => void; onGrow: () => void }) {
  const { t } = useI18n();
  return (
    <div className="ai-turn">
      <div className="ai-bubble user">{turn.question}</div>
      {turn.status === 'pending' && (
        <div className="ai-bubble bot typing" role="status" aria-label={t(`${brand.assistant.name} is typing`, `${brand.assistant.name} is aan het typen`)}>
          <span />
          <span />
          <span />
        </div>
      )}
      {turn.status === 'error' && (
        <div className="ai-bubble bot error" role="alert">
          {t('Sorry, I could not answer that. Please try again.', 'Sorry, dat kon ik niet beantwoorden. Probeer het opnieuw.')}
        </div>
      )}
      {turn.answer && <AnswerView answer={turn.answer} animate={latest} onAsk={onAsk} onNavigate={onNavigate} onGrow={onGrow} />}
    </div>
  );
}

/**
 * Full-page staff assistant, laid out like the Hydro Mobile360 one: centred greeting with suggestion
 * chips, the transcript, a pill-shaped composer, and a tool rail on the right (new chat, recent questions).
 */
export default function StaffAssistantPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { assistant } = useStaff();
  const { turns, busy, ask, clear, history } = assistant;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollDown = useCallback(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);
  useEffect(scrollDown, [turns.length, scrollDown]);

  const send = useCallback(
    (q: string) => {
      ask(q);
      setShowHistory(false);
      inputRef.current?.focus();
    },
    [ask],
  );

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    send(draft);
    setDraft('');
  };

  const newChat = () => {
    clear();
    setDraft('');
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const chips = STAFF_SUGGESTIONS.map((id) => staffPhrase(id, lang));

  return (
    <div className="ai-page">
      <StaffHead icon={Sparkles} title={brand.assistant.name} sub={t('Ask about the whole customer base: what needs attention, installments, EV charging, app activity and message results, or look up a customer by name.', 'Vraag naar het hele klantenbestand: wat aandacht vraagt, termijnbedragen, laden, app-activiteit en resultaten van berichten, of zoek een klant op naam.')} />
      <div className="ai-layout">
        <section className="ai-main" aria-label={brand.assistant.name}>
          <div ref={logRef} className="ai-log" role="log" aria-live="polite" aria-label={t('Conversation', 'Gesprek')}>
            {turns.length === 0 ? (
              <div className="ai-empty">
                <span className="ai-orb" aria-hidden>
                  <Sparkles size={30} />
                </span>
                <h2 className="ai-title">{brand.assistant.name}</h2>
                <p className="ai-greet">
                  {t(
                    `Hi ${STAFF_NAME}, I’m ${brand.assistant.name}. Ask me about your customers: who needs attention, how installments and messages are doing, or what is happening in the app. I can also look up a customer by name and draft a message.`,
                    `Hoi ${STAFF_NAME}, ik ben ${brand.assistant.name}. Vraag me naar je klanten: wie aandacht nodig heeft, hoe het gaat met termijnbedragen en berichten, of wat er in de app gebeurt. Ik kan ook een klant opzoeken op naam en een bericht schrijven.`,
                  )}
                </p>
                <div className="ai-chips" role="group" aria-label={t('Suggested questions', 'Voorgestelde vragen')}>
                  {chips.map((s) => (
                    <button key={s} type="button" className="ai-chip" onClick={() => send(s)}>
                      <Sparkles size={13} aria-hidden />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ai-turns">
                {turns.map((turn, i) => (
                  <TurnView key={turn.id} turn={turn} latest={i === turns.length - 1} onAsk={send} onNavigate={(to) => navigate(to)} onGrow={scrollDown} />
                ))}
              </div>
            )}
          </div>

          <form className="ai-compose" onSubmit={submit}>
            <label htmlFor="assistant-q" className="sr-only">
              {t(`Ask ${brand.assistant.name} a question`, `Stel ${brand.assistant.name} een vraag`)}
            </label>
            <textarea
              id="assistant-q"
              ref={inputRef}
              rows={1}
              maxLength={300}
              placeholder={t('Type your message', 'Typ je bericht')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button type="button" className="ai-round ghost" aria-label={t('Voice input (not available)', 'Spraakinvoer (niet beschikbaar)')} title={t('Voice input is not available', 'Spraakinvoer is niet beschikbaar')} disabled>
              <Mic size={18} />
            </button>
            <button type="submit" className="ai-round" aria-label={t('Send question', 'Verstuur vraag')} disabled={!draft.trim() || busy}>
              <ArrowUp size={18} />
            </button>
          </form>
          <p className="ai-disclosure">{t('Answers are based on your customers’ data. Check before you act on them.', 'Antwoorden zijn gebaseerd op de gegevens van je klanten. Controleer ze voordat je ernaar handelt.')}</p>
        </section>

        <aside className="ai-tools" aria-label={t('Conversation tools', 'Gesprekshulpmiddelen')}>
          <button type="button" className="ai-tool" aria-label={t('New chat', 'Nieuw gesprek')} title={t('New chat', 'Nieuw gesprek')} onClick={newChat}>
            <SquarePen size={20} />
          </button>
          <button type="button" className={`ai-tool${showHistory ? ' on' : ''}`} aria-label={t('Recent questions', 'Recente vragen')} title={t('Recent questions', 'Recente vragen')} aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
            <History size={20} />
          </button>
          {showHistory && (
            <div className="ai-history" role="region" aria-label={t('Recent questions', 'Recente vragen')}>
              <strong>{t('Recent questions', 'Recente vragen')}</strong>
              {history.length === 0 ? (
                <span className="small muted">{t('Nothing asked yet this session.', 'Nog niets gevraagd in deze sessie.')}</span>
              ) : (
                history.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)}>
                    {q}
                  </button>
                ))
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
