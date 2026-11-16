import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  BellRing,
  CarFront,
  Download,
  ExternalLink,
  Eye,
  Flame,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  MessageSquareText,
  PiggyBank,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Smartphone,
  Target,
  UserRound,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Activity, ActivityKind, Conversation, MessageTemplate, StaffOverview } from '../../shared/contract';
import { Brand } from '../components/Layout';
import { RailShell, type RailItem } from '../components/RailShell';
import { ThemeMenu } from '../components/ThemeMenu';
import { Card, DemoFlag, InsightIc, Kpi } from '../components/ui';
import { useToast } from '../components/toast';
import { useI18n, type Lang } from '../lib/i18n';
import { brand } from '../brand';
import { useStaffData, type Connection } from './useStaffData';
import './staff.css';

const STAFF_NAME = 'Lotte';

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  session: UserRound,
  page: Eye,
  installment: SlidersHorizontal,
  invoice_download: Download,
  chat: MessageSquareText,
  plan: Target,
  charging: CarFront,
  contact: Mail,
  message_read: Mail,
  push_subscribed: BellRing,
  staff_message: Send,
};

/** Activity kinds that are worth a second look (the customer changed something). */
const ACTION_KINDS: ReadonlySet<ActivityKind> = new Set(['installment', 'plan', 'charging', 'contact', 'push_subscribed', 'invoice_download']);

function clock(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ago(iso: string | null, lang: Lang, now: number): string {
  if (!iso) return lang === 'nl' ? 'nog niet gezien' : 'not seen yet';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return lang === 'nl' ? 'zojuist' : 'just now';
  const rtf = new Intl.RelativeTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

function ConnectionBadge({ state }: { state: Connection }) {
  const { t } = useI18n();
  const label = state === 'live' ? t('Live', 'Live') : state === 'connecting' ? t('Connecting…', 'Verbinden…') : t('Offline', 'Offline');
  return (
    <span className={`staff-conn ${state}`} role="status">
      <i aria-hidden /> {label}
    </span>
  );
}

function TopActions({ connection }: { connection: Connection }) {
  const { t, lang, setLang } = useI18n();
  return (
    <>
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

const SECTIONS = [
  { id: 'overview', icon: LayoutDashboard, en: 'Overview', nl: 'Overzicht' },
  { id: 'customer', icon: UserRound, en: 'Customer', nl: 'Klant' },
  { id: 'message', icon: Send, en: 'Message the customer', nl: 'Bericht aan de klant' },
  { id: 'activity', icon: ActivityIcon, en: 'Live activity', nl: 'Live activiteit' },
  { id: 'conversations', icon: MessageSquareText, en: `Conversations with ${brand.assistant.name}`, nl: `Gesprekken met ${brand.assistant.name}` },
] as const;

/** Which section is in view, for the rail highlight. */
function useActiveSection(ready: boolean): string {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    if (!ready) return;
    // A clicked section wins over scroll tracking for a moment: sections sit side by side,
    // so the scroll that follows the click can bring a neighbour into view first.
    let pinnedUntil = 0;
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (SECTIONS.some((x) => x.id === id)) {
        pinnedUntil = Date.now() + 1200;
        setActive(id);
      }
    };
    window.addEventListener('hashchange', onHash);
    const els = SECTIONS.map((x) => document.getElementById(x.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        if (Date.now() < pinnedUntil) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => {
      window.removeEventListener('hashchange', onHash);
      io.disconnect();
    };
  }, [ready]);
  return active;
}

function CustomerCard({ o, now }: { o: StaffOverview; now: number }) {
  const { t, tx, eur, lang } = useI18n();
  const c = o.customer;
  const online = o.online > 0;
  const gap = o.installment.advised - (o.installment.pending?.amount ?? o.installment.current);
  return (
    <Card
      id="customer"
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

function ActivityFeed({ items, fresh }: { items: Activity[]; fresh: Set<string> }) {
  const { t, tx, lang } = useI18n();
  const [onlyActions, setOnlyActions] = useState(false);
  const list = onlyActions ? items.filter((a) => ACTION_KINDS.has(a.kind) || a.kind === 'chat') : items;
  return (
    <Card
      id="activity"
      title={t('Live activity', 'Live activiteit')}
      sub={t(`What the customer does in ${brand.portal}, as it happens`, `Wat de klant doet in ${brand.portal}, op het moment zelf`)}
      action={
        <label className="row xs strong" style={{ cursor: 'pointer', gap: 8 }}>
          <button className={`switch${onlyActions ? ' on' : ''}`} role="switch" aria-checked={onlyActions} aria-label={t('Hide page views', 'Verberg paginaweergaven')} onClick={() => setOnlyActions(!onlyActions)} />
          {t('Hide page views', 'Verberg paginaweergaven')}
        </label>
      }
    >
      {list.length === 0 ? (
        <p className="small muted staff-empty">
          <ActivityIcon size={18} aria-hidden /> {t(`Nothing yet. Open ${brand.portal} in another tab or on a phone and click around.`, `Nog niets. Open ${brand.portal} in een ander tabblad of op een telefoon en klik rond.`)}
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

function Composer({ templates, pushDevices, disabled, onSend }: { templates: MessageTemplate[]; pushDevices: number; disabled: boolean; onSend: ReturnType<typeof useStaffData>['send'] }) {
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
    <Card id="message" title={t('Message the customer', 'Bericht aan de klant')} sub={t('Appears in the app at once, and as a notification on the phone', 'Verschijnt direct in de app, en als melding op de telefoon')}>
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

function Conversations({ list }: { list: Conversation[] }) {
  const { t, lang } = useI18n();
  const [picked, setPicked] = useState<string | null>(null);
  const current = list.find((c) => c.id === picked) ?? list[0] ?? null;
  const preview = (c: Conversation) => [...c.entries].reverse().find((e) => e.role === 'user')?.text ?? '';
  return (
    <Card
      id="conversations"
      title={t(`Conversations with ${brand.assistant.name}`, `Gesprekken met ${brand.assistant.name}`)}
      sub={t(`What customers ask ${brand.assistant.name} in ${brand.portal}, live`, `Wat klanten in ${brand.portal} aan ${brand.assistant.name} vragen, live`)}
      className="staff-conv-card"
    >
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

/** ENGIE Customer Service view: one customer's account, what they do in the app right now, and a way to reach them. */
export default function StaffApp() {
  const { t, eur, num } = useI18n();
  const toast = useToast();
  const data = useStaffData();
  const { overview: o } = data;

  // Ticks so "last seen" stays current between events.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = `${brand.name} ${t('Customer Service', 'Klantenservice')}`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  const [navOpen, setNavOpen] = useState(false);
  const activeSection = useActiveSection(!!o);

  const reset = () => {
    if (!window.confirm(t('Reset the demo? Messages, conversations and changes go back to the start.', 'Demo resetten? Berichten, gesprekken en wijzigingen gaan terug naar het begin.'))) return;
    data.reset().then(
      () => toast(t('Demo reset', 'Demo gereset')),
      () => toast(t('Could not reset the demo', 'De demo kon niet worden gereset')),
    );
  };

  const settlement = o?.kpis.expectedSettlement ?? 0;
  const kpis = useMemo(
    () =>
      o
        ? [
            { icon: Zap, tone: 'el' as const, label: t('Electricity this month', 'Stroom deze maand'), value: num(o.kpis.electricityThisMonth), unit: 'kWh' },
            { icon: Flame, tone: 'gas' as const, label: t('Gas this month', 'Gas deze maand'), value: num(o.kpis.gasThisMonth), unit: 'm³' },
            { icon: Wallet, tone: 'eur' as const, label: t('Cost so far', 'Kosten tot nu toe'), value: eur(o.kpis.costSoFar, 0) },
            { icon: SlidersHorizontal, tone: 'ink' as const, label: t('Expected at annual statement', 'Verwacht bij jaarnota'), value: `${settlement >= 0 ? '+' : '−'}${eur(Math.abs(settlement), 0)}` },
            { icon: PiggyBank, tone: 'pur' as const, label: t('Savings plan', 'Bespaarplan'), value: eur(o.kpis.savingsPlanPerYear, 0), unit: t('/ year', '/ jaar') },
          ]
        : [],
    [o, t, num, eur, settlement],
  );

  const sections: RailItem[] = SECTIONS.map((x) => ({ key: x.id, icon: x.icon, label: t(x.en, x.nl), href: `#${x.id}`, active: activeSection === x.id }));
  const demo: RailItem[] = [
    { key: 'portal', icon: ExternalLink, label: t(`Open ${brand.portal}`, `Open ${brand.portal}`), href: '/app', newTab: true },
    { key: 'start', icon: LayoutGrid, label: t('Start page', 'Startpagina'), href: '/' },
    { key: 'reset', icon: RotateCcw, label: t('Reset demo', 'Demo resetten'), onClick: reset },
  ];

  return (
    <RailShell
      logo={<Brand sub={t('Customer Service', 'Klantenservice')} />}
      logoTo="/staff"
      logoLabel={`${brand.name} ${t('Customer Service', 'Klantenservice')}`}
      sections={sections}
      demo={demo}
      navOpen={navOpen}
      setNavOpen={setNavOpen}
      actions={<TopActions connection={data.connection} />}
    >
    <div className="staff">
      <main className="staff-main">
        <div className="page-head">
          <div>
            <span className="eyebrow">{t('Customer Service', 'Klantenservice')}</span>
            <h1>{t('Customer in view', 'Klant in beeld')}</h1>
            <p>{t(`See what the customer does in ${brand.portal} as it happens, read their conversations with ${brand.assistant.name}, and send them a message.`, `Zie wat de klant in ${brand.portal} doet op het moment zelf, lees de gesprekken met ${brand.assistant.name} en stuur een bericht.`)}</p>
          </div>
        </div>

        {data.connection === 'down' && !o && (
          <div className="card staff-offline" role="alert">
            <h2>{t('The demo server is not running', 'De demoserver draait niet')}</h2>
            <p className="small">
              {t('This view needs the server for live data. Start everything with start-demo.cmd (or npm start) and open this page on port 3000.', 'Deze weergave heeft de server nodig voor live data. Start alles met start-demo.cmd (of npm start) en open deze pagina op poort 3000.')}
            </p>
          </div>
        )}

        {o && (
          <>
            <div className="grid g-4 staff-kpis" id="overview">
              {kpis.map((k) => (
                <Kpi key={k.label} icon={k.icon} tone={k.tone} label={k.label} value={k.value} unit={k.unit} />
              ))}
            </div>
            <div className="staff-grid">
              <div className="stack" style={{ gap: 20 }}>
                <CustomerCard o={o} now={now} />
                <Composer templates={data.templates} pushDevices={o.pushDevices} disabled={data.connection !== 'live'} onSend={data.send} />
              </div>
              <ActivityFeed items={data.activity} fresh={data.fresh} />
            </div>
            <Conversations list={data.conversations} />
          </>
        )}

        <div className="row mt" style={{ justifyContent: 'center' }}>
          <DemoFlag />
        </div>
      </main>
    </div>
    </RailShell>
  );
}
