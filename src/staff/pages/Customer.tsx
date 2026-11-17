import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Activity as ActivityIcon, BellRing, CarFront, ChevronLeft, FileText, Send, Sparkles, UserRound } from 'lucide-react';
import type { CustomerDetail } from '../../../shared/contract';
import { API, get, post } from '../../api/client';
import { Card, InsightIc } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { AttentionPanel, CostCard, Outbox, UsageCard, VisitsCard } from '../board';
import { scaleBilling, scaleEnergy } from '../scale';
import { useStaff } from '../context';
import { ACTION_KINDS, CATEGORIES, KIND_ICON, ago, clock } from '../kinds';
import { Conversations, StaffHead } from '../parts';

type Tab = 'overview' | 'timeline' | 'billing' | 'appliances' | 'messages' | 'eva';
const TABS: Tab[] = ['overview', 'timeline', 'billing', 'appliances', 'messages', 'eva'];

/** Everything about the customer in one place: timeline, contract and billing, appliances, messages, Eva. */
export default function StaffCustomer() {
  const { t, tx, eur, num, date, lang } = useI18n();
  const { id = '' } = useParams();
  const ctx = useStaff();
  const { fresh, now } = ctx;
  // The live customer's page runs on the live data; any other customer is loaded here and
  // loaded again whenever something happens in the customer base.
  const isLive = ctx.overview?.customer.id === id;
  const [loaded, setLoaded] = useState<CustomerDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const version = ctx.feed[0]?.id ?? '';
  const outboxVersion = ctx.outbox.length;
  useEffect(() => {
    if (isLive || !id) return;
    let stale = false;
    get<CustomerDetail>(API.staffCustomer(id)).then(
      (d) => {
        if (stale) return;
        setLoaded(d);
        setMissing(false);
      },
      () => !stale && setMissing(true),
    );
    return () => {
      stale = true;
    };
  }, [id, isLive, version, outboxVersion]);
  const detail = !isLive && loaded?.summary.id === id ? loaded : null;
  const o = isLive ? ctx.overview : (detail?.overview ?? null);
  const hasEv = isLive || !!detail?.summary.hasEv;
  const attention = isLive ? ctx.attention : (detail?.attention ?? []);
  const activity = isLive ? ctx.activity : (detail?.activity ?? []);
  const energy = !ctx.energy ? null : isLive ? ctx.energy : detail ? scaleEnergy(ctx.energy, detail.usageScale, detail.summary.hasEv) : null;
  const billing = !ctx.billing || !o ? null : isLive ? ctx.billing : scaleBilling(ctx.billing, o);
  // Messages to this customer: sent to them alone, or to a segment they are in.
  const flagIds = attention.map((a) => a.id);
  const outbox = ctx.outbox.filter((m) => (isLive ? !m.customer && (!m.audience || m.audience.includesLive) : m.customer?.id === id || (m.audience && flagIds.includes(m.audience.segment))));
  const inbox = isLive ? ctx.inbox : [];
  const conversations = isLive ? ctx.conversations : [];
  // A link can open a tab directly (?tab=eva).
  const [params] = useSearchParams();
  const wantedTab = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(wantedTab && TABS.includes(wantedTab) ? wantedTab : 'overview');
  // Opening a customer record is part of the audit trail.
  const name = isLive && ctx.overview ? `${ctx.overview.customer.firstName} ${ctx.overview.customer.lastName}` : detail ? `${detail.summary.firstName} ${detail.summary.lastName}` : '';
  useEffect(() => {
    if (name) post(API.staffAudit, { action: 'CUSTOMER_VIEWED', target: name }).catch(() => undefined);
  }, [name]);
  const [filter, setFilter] = useState('all');
  if (!o) return <StaffHead icon={UserRound} title={t('Customer', 'Klant')} sub={missing ? t('This customer could not be found.', 'Deze klant is niet gevonden.') : t('Loading the customer…', 'Klant wordt geladen…')} />;

  const c = o.customer;
  const online = o.online > 0;
  const cat = CATEGORIES.find((x) => x.id === filter);
  const rows = cat ? activity.filter((a) => cat.kinds.includes(a.kind)) : activity;
  // Group the timeline by calendar day (Amsterdam time, like every date in the app).
  const days: { day: string; items: typeof rows }[] = [];
  for (const a of rows) {
    const day = date(a.ts, { weekday: 'long', day: 'numeric', month: 'long' });
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(a);
    else days.push({ day, items: [a] });
  }
  const total = energy ? energy.breakdown.reduce((s, b) => s + b.kwh, 0) : 0;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: t('Overview', 'Overzicht'), count: attention.filter((a) => a.status === 'open').length },
    { id: 'timeline', label: t('Timeline', 'Tijdlijn'), count: activity.length },
    { id: 'billing', label: t('Contract & billing', 'Contract & betalen') },
    { id: 'appliances', label: t('Appliances', 'Apparaten') },
    { id: 'messages', label: t('Messages', 'Berichten'), count: inbox.length },
    { id: 'eva', label: brand.assistant.name, count: conversations.length },
  ];

  return (
    <>
      <StaffHead icon={UserRound} title={t('Customer', 'Klant')} sub={t('Everything about this customer in one place.', 'Alles over deze klant op één plek.')}>
        <Link to="/staff/customers" className="btn btn-outline btn-sm">
          <ChevronLeft size={14} /> {t('All customers', 'Alle klanten')}
        </Link>
      </StaffHead>

      <section className="card cust-head">
        <span className="cust-avatar" aria-hidden>
          {c.initials}
          <i className={`staff-dot${online ? ' on' : ''}`} />
        </span>
        <div className="grow">
          <h2>
            {c.firstName} {c.lastName}
          </h2>
          <p className="small muted">
            {t('Customer number', 'Klantnummer')} {c.customerNo} · {c.address.street}, {c.address.postcode} {c.address.city} · {c.email}
          </p>
          <div className="row wrap cust-pills">
            <span className={`badge ${online ? 'ok' : 'neutral'}`}>{online ? t('In the app now', 'Nu in de app') : t(`Last seen ${ago(o.lastSeen, lang, now)}`, `Laatst gezien ${ago(o.lastSeen, lang, now)}`)}</span>
            <span className="badge info">{tx(o.contract.product)}</span>
            {hasEv && (
              <span className="badge pur">
                <CarFront size={12} aria-hidden /> {t('Electric car at home', 'Elektrische auto thuis')}
              </span>
            )}
            <span className={`badge ${o.pushDevices > 0 ? 'green' : 'neutral'}`}>
              <BellRing size={12} aria-hidden /> {o.pushDevices > 0 ? t('Phone notifications on', 'Telefoonmeldingen aan') : t('Phone notifications off', 'Telefoonmeldingen uit')}
            </span>
          </div>
        </div>
        <div className="cust-actions">
          <Link to={`/staff/messages?customer=${id}`} className="btn btn-primary btn-sm">
            <Send size={14} /> {t('Send message', 'Stuur bericht')}
          </Link>
          <Link to="/staff/assistant" className="btn btn-outline btn-sm">
            <Sparkles size={14} /> {t(`Ask ${brand.assistant.name}`, `Vraag ${brand.assistant.name}`)}
          </Link>
        </div>
      </section>

      <div className="pills cust-tabs" role="tablist" aria-label={t('Customer details', 'Klantgegevens')}>
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            {x.label}
            {x.count !== undefined && <span className="cust-count num">{x.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="staff-grid wide-left even">
            <AttentionPanel items={attention} customerId={id} />
            {billing && <CostCard billing={billing} installment={o.installment} />}
          </div>
          {energy && (
            <div className="staff-grid wide-left even">
              <UsageCard energy={energy} />
              <VisitsCard activity={activity} online={online} now={now} limit={4} />
            </div>
          )}
        </>
      )}

      {tab === 'timeline' && (
        <Card title={t('Timeline', 'Tijdlijn')} sub={t(`What the customer did in ${brand.portal}, newest first`, `Wat de klant deed in ${brand.portal}, nieuwste eerst`)}>
          <div className="pills" role="group" aria-label={t('Filter', 'Filter')}>
            <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              {t('All', 'Alles')}
            </button>
            {CATEGORIES.map((x) => (
              <button key={x.id} className={filter === x.id ? 'on' : ''} aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>
                {tx(x.label)}
              </button>
            ))}
          </div>
          {days.length === 0 ? (
            <p className="small muted staff-empty">
              <ActivityIcon size={18} aria-hidden /> {t(`Nothing here yet. It fills in as soon as the customer uses ${brand.portal}.`, `Nog niets. Het vult zich zodra de klant ${brand.portal} gebruikt.`)}
            </p>
          ) : (
            days.map((d) => (
              <div key={d.day} className="timeline-day">
                <h3>{d.day}</h3>
                <ol className="staff-feed">
                  {d.items.map((a) => {
                    const Icon = KIND_ICON[a.kind];
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
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'billing' && (
        <div className="staff-grid">
          <Card title={t('Contract', 'Contract')} sub={tx(o.contract.product)}>
            <dl className="kv staff-kv">
              <dt>{t('Electricity', 'Stroom')}</dt>
              <dd>{tx(o.contract.electricity.type)}</dd>
              <dt>{t('Gas', 'Gas')}</dt>
              <dd>{tx(o.contract.gas.type)}</dd>
              <dt>{t('Started', 'Gestart')}</dt>
              <dd>{date(o.contract.startDate)}</dd>
              <dt>{t('Monthly installment', 'Termijnbedrag')}</dt>
              <dd className="num">
                {eur(o.installment.current, 0)}
                {o.installment.pending && (
                  <span className="badge info" style={{ marginLeft: 8 }}>
                    {t('From December', 'Vanaf december')}: {eur(o.installment.pending.amount, 0)}
                  </span>
                )}
              </dd>
              <dt>{t('Advised installment', 'Geadviseerd termijnbedrag')}</dt>
              <dd className="num">{eur(o.installment.advised, 0)}</dd>
              <dt>{t('Estimated cost per year', 'Geschatte kosten per jaar')}</dt>
              <dd className="num">{eur(o.contract.estimatedAnnualCost, 0)}</dd>
              <dt>{t('Payment', 'Betaling')}</dt>
              <dd>
                {tx(c.paymentMethod)}, {t(`on the ${c.collectionDay}th`, `op de ${c.collectionDay}e`)}
              </dd>
              <dt>{t('Meter', 'Meter')}</dt>
              <dd>{tx(o.contract.meter.type)}</dd>
            </dl>
          </Card>
          <Card title={t('Latest invoices', 'Laatste nota’s')} sub={billing ? tx(billing.annualOverview.year) : undefined}>
            {!billing ? (
              <p className="small muted staff-empty">
                <FileText size={18} aria-hidden /> {t('Invoices are loading…', 'Nota’s worden geladen…')}
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table staff-table">
                  <thead>
                    <tr>
                      <th>{t('Period', 'Periode')}</th>
                      <th>{t('Amount', 'Bedrag')}</th>
                      <th>{t('Status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.invoices.slice(0, 6).map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <span className="strong small">{tx(inv.period)}</span>
                          <span className="xs muted" style={{ display: 'block' }}>
                            {inv.id}
                          </span>
                        </td>
                        <td className="num small">{eur(inv.amount)}</td>
                        <td>
                          <span className={`badge ${inv.status === 'paid' ? 'ok' : inv.status === 'open' ? 'warn' : 'info'}`}>
                            {inv.status === 'paid' ? t('Paid', 'Betaald') : inv.status === 'open' ? t('Open', 'Open') : t('Scheduled', 'Ingepland')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'appliances' && energy && (
        <div className="staff-grid">
          <Card title={t('Where the electricity goes', 'Waar de stroom heen gaat')} sub={t('October 2026, recognised from the smart-meter signal', 'Oktober 2026, herkend aan het signaal van de slimme meter')}>
            <ul className="appl-list">
              {energy.breakdown.map((b) => (
                <li key={b.key}>
                  <span className="small strong">{tx(b.label)}</span>
                  <span className="appl-track" aria-hidden>
                    <span style={{ width: `${(b.kwh / energy.breakdown[0]!.kwh) * 100}%`, background: b.color }} />
                  </span>
                  <span className="small num">
                    {num(b.kwh)} kWh · {Math.round((b.kwh / total) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('Patterns', 'Patronen')} sub={t('What stands out in this home', 'Wat opvalt in deze woning')}>
            <dl className="kv staff-kv">
              <dt>{t('Use at peak hours', 'Verbruik in piekuren')}</dt>
              <dd className="num">{energy.peakSplit.peakPct}%</dd>
              <dt>{t('EV charging at peak hours', 'Auto laden in piekuren')}</dt>
              <dd className="num">
                {energy.peakSplit.peakEvPct}% <span className="badge warn" style={{ marginLeft: 8 }}>{t('Most expensive hours', 'Duurste uren')}</span>
              </dd>
              <dt>{t('Always-on load', 'Sluipverbruik')}</dt>
              <dd className="num">
                {energy.benchmark.baseloadW} W <span className="xs muted">{t(`(similar homes ${energy.benchmark.similarBaseloadW} W)`, `(vergelijkbare woningen ${energy.benchmark.similarBaseloadW} W)`)}</span>
              </dd>
              <dt>{t('October vs September', 'Oktober t.o.v. september')}</dt>
              <dd className="num">+{energy.lastMonth.elecVsPrevMonthPct}%</dd>
              <dt>{t('Household', 'Huishouden')}</dt>
              <dd>
                {t(`${c.household.residents} residents`, `${c.household.residents} bewoners`)}, {tx(c.household.homeType)}, {c.household.sizeM2} m²
              </dd>
            </dl>
          </Card>
        </div>
      )}

      {tab === 'messages' && (
        <div className="staff-grid">
          <Outbox items={outbox} />
          <Card title={t('App inbox', 'Inbox in de app')} sub={t('Everything the customer sees under the bell', 'Alles wat de klant onder de bel ziet')}>
            {inbox.length === 0 && (
              <p className="small muted staff-empty">
                <BellRing size={18} aria-hidden /> {t('The app inbox is shown for customers who are in the app right now.', 'De inbox van de app is te zien voor klanten die nu in de app zijn.')}
              </p>
            )}
            <ol className="outbox">
              {inbox.map((m) => (
                <li key={m.id}>
                  <InsightIc icon={m.icon} size={34} />
                  <div className="grow">
                    <div className="small strong">{tx(m.title)}</div>
                    <div className="xs muted">{m.source === 'staff' ? (m.sender ?? brand.name) : t('Automatic', 'Automatisch')}</div>
                  </div>
                  <span className={`badge ${m.read ? 'ok' : 'warn'}`}>{m.read ? t('Read', 'Gelezen') : t('Unread', 'Ongelezen')}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {tab === 'eva' && <Conversations list={conversations} />}
    </>
  );
}
