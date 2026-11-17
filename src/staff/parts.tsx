import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Flame, MessageSquareText, PiggyBank, Send, SlidersHorizontal, Smartphone, Wallet, Zap } from 'lucide-react';
import type { Activity, AttentionFlag, Conversation, EnergyResponse, MessageTemplate, StaffOverview } from '../../shared/contract';
import { ThemeMenu } from '../components/ThemeMenu';
import { Card, Delta, InsightIc, Kpi } from '../components/ui';
import { StaffBell } from './Bell';
import { PhonePreview } from './board';
import { MERGE_FIELDS, fillMerge } from './merge';
import { useToast } from '../components/toast';
import { useI18n, type Lang, type Text } from '../lib/i18n';
import { brand } from '../brand';
import { STAFF_NAME, ago, clock } from './kinds';
import type { Paged } from './paging';
import type { Connection, StaffData } from './useStaffData';

export function ConnectionBadge({ state }: { state: Connection }) {
  const { t } = useI18n();
  const label = state === 'live' ? t('Live', 'Live') : state === 'connecting' ? t('Connecting…', 'Verbinden…') : t('Offline', 'Offline');
  return (
    <span className={`staff-conn ${state}`} role="status">
      <i aria-hidden /> {label}
    </span>
  );
}

export function TopActions({ connection, activity, now }: { connection: Connection; activity: Activity[]; now: number }) {
  const { t, lang, setLang } = useI18n();
  return (
    <>
      <span className="rs-welcome hide-m">{t(`Welcome ${STAFF_NAME}`, `Welkom ${STAFF_NAME}`)}</span>
      <ConnectionBadge state={connection} />
      <StaffBell activity={activity} now={now} />
      <span className="lang" role="group" aria-label={t('Language', 'Taal')}>
        {(['nl', 'en'] as Lang[]).map((l) => (
          <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </span>
      <ThemeMenu />
      <span className="avatar" title={`${STAFF_NAME} · ${brand.name} ${t('Customer Service', 'Klantenservice')}`} aria-label={`${STAFF_NAME}, ${brand.name}`}>
        {STAFF_NAME.slice(0, 1)}
        <span className="online" />
      </span>
    </>
  );
}

/** Page title block used by every staff page (icon tile, H1, one-line subtitle), as in the Hydro staff app. */
export function StaffHead({ icon: Icon, title, sub, children }: { icon: typeof Zap; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="staff-head">
      <span className="staff-head-ic" aria-hidden>
        <Icon size={20} />
      </span>
      <div className="staff-head-text">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {children}
    </div>
  );
}

export function StaffKpis({ o, energy }: { o: StaffOverview; energy: EnergyResponse | null }) {
  const { t, eur, num } = useI18n();
  const settlement = o.kpis.expectedSettlement;
  const m = energy?.thisMonth;
  const vsLastYear = (now: number, prev: number) => (
    <span className="xs muted">
      <Delta pct={Math.round(((now - prev) / prev) * 100)} /> {t('vs last year', 't.o.v. vorig jaar')}
    </span>
  );
  const foot = (text: string) => <span className="xs muted">{text}</span>;
  const kpis = [
    { icon: Zap, tone: 'el' as const, label: t('Electricity this month', 'Stroom deze maand'), value: num(o.kpis.electricityThisMonth), unit: 'kWh', foot: m && vsLastYear(m.electricity, m.prevElectricity) },
    { icon: Flame, tone: 'gas' as const, label: t('Gas this month', 'Gas deze maand'), value: num(o.kpis.gasThisMonth), unit: 'm³', foot: m && vsLastYear(m.gas, m.prevGas) },
    { icon: Wallet, tone: 'eur' as const, label: t('Cost so far', 'Kosten tot nu toe'), value: eur(o.kpis.costSoFar, 0), foot: m && foot(t(`Forecast ${eur(m.forecastCost, 0)} this month`, `Verwacht ${eur(m.forecastCost, 0)} deze maand`)) },
    {
      icon: SlidersHorizontal,
      tone: 'ink' as const,
      label: t('Expected at annual statement', 'Verwacht bij jaarnota'),
      value: `${settlement >= 0 ? '+' : '−'}${eur(Math.abs(settlement), 0)}`,
      foot: foot(settlement > 0 ? t('To pay in March', 'Bijbetalen in maart') : t('Back in March', 'Terug in maart')),
    },
    {
      icon: PiggyBank,
      tone: 'pur' as const,
      label: t('Savings plan', 'Bespaarplan'),
      value: eur(o.kpis.savingsPlanPerYear, 0),
      unit: t('/ year', '/ jaar'),
      foot: foot(t(`${o.plan.length} tip${o.plan.length === 1 ? '' : 's'} chosen`, `${o.plan.length} ${o.plan.length === 1 ? 'tip' : 'tips'} gekozen`)),
    },
  ];
  return (
    <div className="grid g-4 staff-kpis">
      {kpis.map((k) => (
        <Kpi key={k.label} icon={k.icon} tone={k.tone} label={k.label} value={k.value} unit={k.unit} foot={k.foot || undefined} />
      ))}
    </div>
  );
}

export function CustomerCard({ o, now }: { o: StaffOverview; now: number }) {
  const { t, tx, eur, lang } = useI18n();
  const c = o.customer;
  const online = o.online > 0;
  const gap = o.installment.advised - (o.installment.pending?.amount ?? o.installment.current);
  return (
    <Card
      title={`${c.firstName} ${c.lastName}`}
      sub={`${t('Customer number', 'Klantnummer')} ${c.customerNo}`}
      action={
        <span className={`badge ${online ? 'ok' : ''}`}>
          <i className={`staff-dot${online ? ' on' : ''}`} aria-hidden /> {online ? t('In the app now', 'Nu in de app') : t('Not in the app', 'Niet in de app')}
        </span>
      }
    >
      <dl className="kv staff-kv">
        <dt>{t('Address', 'Adres')}</dt>
        <dd>
          {c.address.street}, {c.address.postcode} {c.address.city}
        </dd>
        <dt>{t('Contract', 'Contract')}</dt>
        <dd>{tx(o.contract.product)}</dd>
        <dt>{t('Monthly installment', 'Termijnbedrag')}</dt>
        <dd className="num">
          {eur(o.installment.current, 0)}
          {o.installment.pending && (
            <span className="badge info" style={{ marginLeft: 8 }}>
              {t('New', 'Nieuw')}: {eur(o.installment.pending.amount, 0)}
            </span>
          )}
        </dd>
        <dt>{t('Advised installment', 'Geadviseerd termijnbedrag')}</dt>
        <dd className="num">
          {eur(o.installment.advised, 0)}
          {gap > 0 ? <span className="badge warn" style={{ marginLeft: 8 }}>{t(`${eur(gap, 0)} too low`, `${eur(gap, 0)} te laag`)}</span> : <span className="badge ok" style={{ marginLeft: 8 }}>{t('On track', 'Passend')}</span>}
        </dd>
        <dt>{t('Last seen', 'Laatst gezien')}</dt>
        <dd>{ago(o.lastSeen, lang, now)}</dd>
        <dt>{t('Phone notifications', 'Meldingen op telefoon')}</dt>
        <dd>
          <Smartphone size={15} style={{ verticalAlign: -2 }} aria-hidden />{' '}
          {o.pushDevices > 0 ? t(`On, ${o.pushDevices} device${o.pushDevices === 1 ? '' : 's'}`, `Aan, ${o.pushDevices} ${o.pushDevices === 1 ? 'apparaat' : 'apparaten'}`) : t('Not turned on', 'Niet aangezet')}
        </dd>
        <dt>{t('Unread messages', 'Ongelezen berichten')}</dt>
        <dd className="num">{o.unreadMessages}</dd>
      </dl>
      <Link to="/staff/customer" className="btn btn-outline btn-sm mt">
        {t('Open customer page', 'Open klantpagina')} <ArrowRight size={14} />
      </Link>
    </Card>
  );
}

/** "Page 2 of 7" with previous/next, under any paged table. Hidden when everything fits on one page. */
export function Pager<T>({ paged }: { paged: Paged<T> }) {
  const { t } = useI18n();
  if (paged.pages <= 1) return null;
  return (
    <div className="row between pager">
      <span className="small muted">{t(`Page ${paged.page} of ${paged.pages}`, `Pagina ${paged.page} van ${paged.pages}`)}</span>
      <span className="row" style={{ gap: 8 }}>
        <button className="btn btn-outline btn-sm" disabled={paged.page <= 1} onClick={() => paged.setPage(paged.page - 1)}>
          <ChevronLeft size={14} /> {t('Previous', 'Vorige')}
        </button>
        <button className="btn btn-outline btn-sm" disabled={paged.page >= paged.pages} onClick={() => paged.setPage(paged.page + 1)}>
          {t('Next', 'Volgende')} <ChevronRight size={14} />
        </button>
      </span>
    </div>
  );
}

/** When to send: now, or after this many seconds. */
const SEND_TIMES: { value: string; seconds: number; label: Text }[] = [
  { value: 'now', seconds: 0, label: { en: 'Now', nl: 'Nu' } },
  { value: '1m', seconds: 60, label: { en: 'In 1 minute', nl: 'Over 1 minuut' } },
  { value: '15m', seconds: 900, label: { en: 'In 15 minutes', nl: 'Over 15 minuten' } },
  { value: '1h', seconds: 3600, label: { en: 'In 1 hour', nl: 'Over 1 uur' } },
  { value: '1d', seconds: 86400, label: { en: 'Tomorrow, same time', nl: 'Morgen, zelfde tijd' } },
];

/**
 * Message composer: templates, merge fields filled in with the customer's data, a live preview of the
 * phone notification, and send now or later. `initial` prefills it from a dashboard action or an assistant draft.
 */
/** Who a message goes to: the live customer (default), another customer, or everyone with an attention point. */
export type Audience = { kind: 'segment'; id: AttentionFlag; label: string; count: number; templateId?: string } | { kind: 'customer'; id: string; name: string; /** The live demo customer (their app is real). */ live?: boolean };

export function Composer({ templates, overview, disabled, onSend, initial, audience }: { templates: MessageTemplate[]; overview: StaffOverview | null; disabled: boolean; onSend: StaffData['send']; initial?: MessageTemplate | null; audience?: Audience }) {
  const { t, tx, lang } = useI18n();
  const toast = useToast();
  const [template, setTemplate] = useState<MessageTemplate | null>(initial ?? null);
  const [title, setTitle] = useState(initial ? tx(initial.title) : '');
  const [body, setBody] = useState(initial ? tx(initial.body) : '');
  const [push, setPush] = useState(true);
  const [when, setWhen] = useState('now');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pushDevices = overview?.pushDevices ?? 0;

  const pick = (tpl: MessageTemplate) => {
    setTemplate(tpl);
    setTitle(tx(tpl.title));
    setBody(tx(tpl.body));
  };
  /** Put a merge field where the cursor is in the message. */
  const insert = (token: string) => {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    const end = el ? el.selectionEnd : body.length;
    setBody(`${body.slice(0, at)}${token}${body.slice(end)}`.slice(0, 280));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  // A template keeps both languages as long as its text is unchanged; typed text is sent as written.
  const untouched = template && title === tx(template.title) && body === tx(template.body);
  const mergeWith = audience?.kind === 'customer' && audience.live ? overview : null;
  const finalTitle = fillMerge(title.trim(), mergeWith, lang);
  const finalBody = fillMerge(body.trim(), mergeWith, lang);
  const ready = !!audience && title.trim().length > 2 && body.trim().length > 2 && !busy && !disabled;
  const group = audience?.kind === 'segment';
  const delay = SEND_TIMES.find((s) => s.value === when)?.seconds ?? 0;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await onSend({
        title: untouched ? template.title : { en: finalTitle, nl: finalTitle },
        body: untouched ? template.body : { en: finalBody, nl: finalBody },
        icon: template?.icon ?? 'bell',
        to: template?.to ?? '/',
        push,
        sender: `${STAFF_NAME} · ${brand.name} ${lang === 'nl' ? 'Klantenservice' : 'Customer Service'}`,
        templateId: template?.id,
        segment: audience?.kind === 'segment' ? audience.id : undefined,
        customerId: audience?.kind === 'customer' && !audience.live ? audience.id : undefined,
        sendAt: delay > 0 ? new Date(Date.now() + delay * 1000).toISOString() : undefined,
      });
      toast(
        r.outbox.status === 'scheduled'
          ? t(`Scheduled for ${clock(r.outbox.sendAt, lang).slice(0, 5)}.`, `Ingepland voor ${clock(r.outbox.sendAt, lang).slice(0, 5)}.`)
          : r.outbox.audience
            ? t(`Sent to ${r.outbox.audience.count} customers.`, `Verstuurd aan ${r.outbox.audience.count} klanten.`)
            : push
              ? r.pushed > 0
                ? t(`Sent. Phone notification delivered to ${r.pushed} device${r.pushed === 1 ? '' : 's'}.`, `Verstuurd. Melding afgeleverd op ${r.pushed} ${r.pushed === 1 ? 'apparaat' : 'apparaten'}.`)
                : t('Sent to the app inbox. No phone has notifications turned on yet.', 'Verstuurd naar de inbox in de app. Nog geen telefoon heeft meldingen aangezet.')
              : t('Sent to the app inbox.', 'Verstuurd naar de inbox in de app.'),
      );
      setTemplate(null);
      setTitle('');
      setBody('');
      setWhen('now');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('Could not send the message.', 'Het bericht kon niet worden verstuurd.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="composer-wrap">
      <span className="step-label">
        <i>2</i> {t('What do you want to say?', 'Wat wil je zeggen?')}
      </span>
      {templates.length > 0 && (
        <div className="staff-templates" role="group" aria-label={t('Templates', 'Sjablonen')}>
          {templates.map((tpl) => (
            <button key={tpl.id} className={`staff-template${template?.id === tpl.id ? ' on' : ''}`} aria-pressed={template?.id === tpl.id} onClick={() => pick(tpl)}>
              <InsightIc icon={tpl.icon} size={28} />
              <span className="xs strong">{tx(tpl.title)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="composer">
        <div className="stack" style={{ gap: 12 }}>
          <label className="field">
            {t('Title', 'Titel')}
            <input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Your installment advice', 'bijv. Je termijnadvies')} />
          </label>
          <label className="field">
            {t('Message', 'Bericht')}
            <textarea ref={bodyRef} className="input staff-textarea" value={body} maxLength={280} rows={4} onChange={(e) => setBody(e.target.value)} placeholder={t('Write a short, friendly message', 'Schrijf een kort, vriendelijk bericht')} />
          </label>
          {mergeWith && (
          <div className="merge-fields" role="group" aria-label={t('Insert customer data', 'Klantgegevens invoegen')}>
            <span className="xs muted">{t('Insert:', 'Invoegen:')}</span>
            {MERGE_FIELDS.map((f) => (
              <button key={f.token} type="button" className="merge-chip" onClick={() => insert(f.token)} title={overview ? f.value(overview, lang) : undefined}>
                {tx(f.label)}
              </button>
            ))}
          </div>
          )}
        </div>
        <div className="composer-side">
          <span className="xs strong muted">{t('On the phone', 'Op de telefoon')}</span>
          <PhonePreview title={finalTitle} body={finalBody} />
        </div>
      </div>
      <span className="step-label" style={{ marginTop: 18 }}>
        <i>3</i> {t('When and how?', 'Wanneer en hoe?')}
      </span>
      <div className="row between composer-foot">
        <label className="row small strong" style={{ cursor: 'pointer', gap: 10 }}>
          <button className={`switch${push ? ' on' : ''}`} role="switch" aria-checked={push} aria-label={t('Also send a phone notification', 'Ook als melding naar de telefoon')} onClick={() => setPush(!push)} />
          <span>
            {t('Also send a phone notification', 'Ook als melding naar de telefoon')}
            <span className="xs muted" style={{ display: 'block', fontWeight: 400 }}>
              {pushDevices > 0 ? t(`${pushDevices} device${pushDevices === 1 ? '' : 's'} will get it`, `${pushDevices} ${pushDevices === 1 ? 'apparaat ontvangt' : 'apparaten ontvangen'} het`) : t('No device has notifications on yet', 'Nog geen apparaat heeft meldingen aan')}
            </span>
          </span>
        </label>
        <span className="row" style={{ gap: 10 }}>
          <select className="input composer-when" value={when} onChange={(e) => setWhen(e.target.value)} aria-label={t('When to send', 'Wanneer versturen')}>
            {SEND_TIMES.map((s) => (
              <option key={s.value} value={s.value}>
                {tx(s.label)}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={!ready} onClick={() => void submit()}>
            {delay > 0 ? <Clock size={16} /> : <Send size={16} />} {busy ? t('Sending…', 'Versturen…') : delay > 0 ? t('Schedule', 'Inplannen') : group ? t(`Send to ${audience.count}`, `Verstuur aan ${audience.count}`) : t('Send', 'Versturen')}
          </button>
        </span>
      </div>
    </div>
  );
}

export function Conversations({ list }: { list: Conversation[] }) {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);
  const current = list.find((c) => c.id === picked) ?? list[0] ?? null;
  const preview = (c: Conversation) => [...c.entries].reverse().find((e) => e.role === 'user')?.text ?? '';
  return (
    <Card title={t(`Conversations with ${brand.assistant.name}`, `Gesprekken met ${brand.assistant.name}`)} sub={t(`What the customer asks ${brand.assistant.name} in ${brand.portal}, live`, `Wat de klant in ${brand.portal} aan ${brand.assistant.name} vraagt, live`)} className="staff-conv-card">
      {!current ? (
        <p className="small muted staff-empty">
          <MessageSquareText size={18} aria-hidden /> {t(`No conversations yet. Ask ${brand.assistant.name} something in the customer app.`, `Nog geen gesprekken. Stel ${brand.assistant.name} een vraag in de klant-app.`)}
        </p>
      ) : (
        <div className="staff-conv">
          <ul className="staff-conv-list" aria-label={t('Conversations', 'Gesprekken')}>
            {list.map((c) => (
              <li key={c.id}>
                <button className={c.id === current.id ? 'on' : ''} aria-current={c.id === current.id} onClick={() => setPicked(c.id)}>
                  <span className="row between">
                    <span className="xs strong">
                      <Smartphone size={13} aria-hidden /> {brand.portal}
                    </span>
                    <time className="xs muted num">{clock(c.updatedAt, lang).slice(0, 5)}</time>
                  </span>
                  <span className="small staff-conv-preview">{preview(c)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="staff-thread" aria-live="polite">
            {current.entries.map((e, i) => (
              <div key={`${e.ts}-${i}`} className={`staff-bubble ${e.role}`}>
                <span className="xs muted">
                  {e.role === 'user' ? t('Customer', 'Klant') : brand.assistant.name} · {clock(e.ts, lang).slice(0, 5)}
                  {e.role === 'assistant' && e.intent === 'FALLBACK' && <span className="badge warn" style={{ marginLeft: 6 }}>{t('Not understood', 'Niet begrepen')}</span>}
                  {e.role === 'assistant' && e.intent === 'HUMAN' && <span className="badge info" style={{ marginLeft: 6 }}>{t('Asked for an agent', 'Vroeg om een medewerker')}</span>}
                </span>
                <p>{e.text.replace(/\*\*/g, '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
