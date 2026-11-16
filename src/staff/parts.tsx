import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon, ArrowRight, Flame, MessageSquareText, PiggyBank, Send, SlidersHorizontal, Smartphone, Wallet, Zap } from 'lucide-react';
import type { Activity, Conversation, MessageTemplate, StaffOverview } from '../../shared/contract';
import { ThemeMenu } from '../components/ThemeMenu';
import { Card, InsightIc, Kpi } from '../components/ui';
import { useToast } from '../components/toast';
import { useI18n, type Lang } from '../lib/i18n';
import { brand } from '../brand';
import { ACTION_KINDS, KIND_ICON, STAFF_NAME, ago, clock } from './kinds';
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

export function TopActions({ connection }: { connection: Connection }) {
  const { t, lang, setLang } = useI18n();
  return (
    <>
      <span className="rs-welcome hide-m">{t(`Welcome ${STAFF_NAME}`, `Welkom ${STAFF_NAME}`)}</span>
      <ConnectionBadge state={connection} />
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

export function StaffKpis({ o }: { o: StaffOverview }) {
  const { t, eur, num } = useI18n();
  const settlement = o.kpis.expectedSettlement;
  const kpis = [
    { icon: Zap, tone: 'el' as const, label: t('Electricity this month', 'Stroom deze maand'), value: num(o.kpis.electricityThisMonth), unit: 'kWh' },
    { icon: Flame, tone: 'gas' as const, label: t('Gas this month', 'Gas deze maand'), value: num(o.kpis.gasThisMonth), unit: 'm³' },
    { icon: Wallet, tone: 'eur' as const, label: t('Cost so far', 'Kosten tot nu toe'), value: eur(o.kpis.costSoFar, 0) },
    { icon: SlidersHorizontal, tone: 'ink' as const, label: t('Expected at annual statement', 'Verwacht bij jaarnota'), value: `${settlement >= 0 ? '+' : '−'}${eur(Math.abs(settlement), 0)}` },
    { icon: PiggyBank, tone: 'pur' as const, label: t('Savings plan', 'Bespaarplan'), value: eur(o.kpis.savingsPlanPerYear, 0), unit: t('/ year', '/ jaar') },
  ];
  return (
    <div className="grid g-4 staff-kpis">
      {kpis.map((k) => (
        <Kpi key={k.label} icon={k.icon} tone={k.tone} label={k.label} value={k.value} unit={k.unit} />
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
    </Card>
  );
}

/** Compact live feed for the dashboard: the latest few entries and a link to the full table. */
export function ActivityFeed({ items, fresh, limit = 8 }: { items: Activity[]; fresh: Set<string>; limit?: number }) {
  const { t, tx, lang } = useI18n();
  const list = items.slice(0, limit);
  return (
    <Card
      title={t('Live activity', 'Live activiteit')}
      sub={t(`What the customer does in ${brand.portal}, as it happens`, `Wat de klant doet in ${brand.portal}, op het moment zelf`)}
      action={
        <Link to="/staff/activity" className="btn btn-ghost btn-sm">
          {t('See all', 'Alles')} <ArrowRight size={14} />
        </Link>
      }
    >
      {list.length === 0 ? (
        <p className="small muted staff-empty">
          <ActivityIcon size={18} aria-hidden /> {t(`Nothing yet. Sign in to ${brand.portal} on a phone or in another tab and click around.`, `Nog niets. Log in bij ${brand.portal} op een telefoon of in een ander tabblad en klik rond.`)}
        </p>
      ) : (
        <ol className="staff-feed" aria-live="polite">
          {list.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? ActivityIcon;
            return (
              <li key={a.id} className={`${ACTION_KINDS.has(a.kind) ? 'action' : ''}${fresh.has(a.id) ? ' fresh' : ''}`}>
                <span className="staff-feed-ic" aria-hidden>
                  <Icon size={16} />
                </span>
                <span className="grow small">{tx(a.text)}</span>
                <time className="xs muted num" dateTime={a.ts}>
                  {clock(a.ts, lang)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function Composer({ templates, pushDevices, disabled, onSend }: { templates: MessageTemplate[]; pushDevices: number; disabled: boolean; onSend: StaffData['send'] }) {
  const { t, tx, lang } = useI18n();
  const toast = useToast();
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [push, setPush] = useState(true);
  const [busy, setBusy] = useState(false);

  const pick = (tpl: MessageTemplate) => {
    setTemplate(tpl);
    setTitle(tx(tpl.title));
    setBody(tx(tpl.body));
  };
  // A template keeps both languages as long as its text is unchanged; typed text is sent as written.
  const untouched = template && title === tx(template.title) && body === tx(template.body);
  const ready = title.trim().length > 2 && body.trim().length > 2 && !busy && !disabled;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await onSend({
        title: untouched ? template.title : { en: title.trim(), nl: title.trim() },
        body: untouched ? template.body : { en: body.trim(), nl: body.trim() },
        icon: template?.icon ?? 'bell',
        to: template?.to ?? '/',
        push,
        sender: `${STAFF_NAME} · ${brand.name} ${lang === 'nl' ? 'Klantenservice' : 'Customer Service'}`,
      });
      toast(
        push
          ? r.pushed > 0
            ? t(`Sent. Phone notification delivered to ${r.pushed} device${r.pushed === 1 ? '' : 's'}.`, `Verstuurd. Melding afgeleverd op ${r.pushed} ${r.pushed === 1 ? 'apparaat' : 'apparaten'}.`)
            : t('Sent to the app inbox. No phone has notifications turned on yet.', 'Verstuurd naar de inbox in de app. Nog geen telefoon heeft meldingen aangezet.')
          : t('Sent to the app inbox.', 'Verstuurd naar de inbox in de app.'),
      );
      setTemplate(null);
      setTitle('');
      setBody('');
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : t('Could not send the message.', 'Het bericht kon niet worden verstuurd.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t('Write a message', 'Schrijf een bericht')} sub={t('Appears in the app at once, and as a notification on the phone', 'Verschijnt direct in de app, en als melding op de telefoon')}>
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
      <div className="stack" style={{ gap: 12, marginTop: 14 }}>
        <label className="field">
          {t('Title', 'Titel')}
          <input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Your installment advice', 'bijv. Je termijnadvies')} />
        </label>
        <label className="field">
          {t('Message', 'Bericht')}
          <textarea className="input staff-textarea" value={body} maxLength={280} rows={3} onChange={(e) => setBody(e.target.value)} placeholder={t('Write a short, friendly message', 'Schrijf een kort, vriendelijk bericht')} />
        </label>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <label className="row small strong" style={{ cursor: 'pointer', gap: 10 }}>
            <button className={`switch${push ? ' on' : ''}`} role="switch" aria-checked={push} aria-label={t('Also send a phone notification', 'Ook als melding naar de telefoon')} onClick={() => setPush(!push)} />
            <span>
              {t('Also send a phone notification', 'Ook als melding naar de telefoon')}
              <span className="xs muted" style={{ display: 'block', fontWeight: 400 }}>
                {pushDevices > 0 ? t(`${pushDevices} device${pushDevices === 1 ? '' : 's'} will get it`, `${pushDevices} ${pushDevices === 1 ? 'apparaat ontvangt' : 'apparaten ontvangen'} het`) : t('No device has notifications on yet', 'Nog geen apparaat heeft meldingen aan')}
              </span>
            </span>
          </label>
          <button className="btn btn-primary" disabled={!ready} onClick={() => void submit()}>
            <Send size={16} /> {busy ? t('Sending…', 'Versturen…') : t('Send', 'Versturen')}
          </button>
        </div>
      </div>
    </Card>
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
