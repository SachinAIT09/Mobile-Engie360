import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity as ActivityIcon, ArrowRight, Check, Send, Users } from 'lucide-react';
import type { Activity, CustomerSummary, Portfolio, QueueItem } from '../../shared/contract';
import { Card, InsightIc } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { brand } from '../brand';
import { CATEGORIES, KIND_ICON, ago } from './kinds';

/** Small round avatar with a customer's initials. */
export function Initials({ name, live }: { name: string; live?: boolean }) {
  const parts = name.split(' ');
  return (
    <span className={`cust-initials${live ? ' is-live' : ''}`} aria-hidden>
      {(parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')}
    </span>
  );
}

/** Where a segment's "send message" and "view customers" go. */
const segmentLinks = (q: QueueItem) => ({ send: `/staff/messages?segment=${q.id}&template=${q.templateId ?? ''}`, list: `/staff/customers?filter=${q.id}` });

/** The attention queue across the customer base: how many customers each point applies to, and one action for all of them. */
export function QueuePanel({ queue, needAttention }: { queue: QueueItem[]; needAttention: number }) {
  const { t, tx, num } = useI18n();
  return (
    <Card
      title={t('Needs attention', 'Vraagt aandacht')}
      sub={t('Found in customers’ data. Message everyone it applies to in one go.', 'Gevonden in de gegevens van klanten. Stuur iedereen voor wie het geldt in één keer een bericht.')}
      action={<span className={`badge ${needAttention > 0 ? 'warn' : 'ok'}`}>{t(`${num(needAttention)} customers`, `${num(needAttention)} klanten`)}</span>}
      className="attention queue"
    >
      <ul className="attention-list">
        {queue.map((q) => {
          const open = q.count - q.contacted;
          return (
            <li key={q.id} className={`attention-row ${open > 0 ? 'open' : 'contacted'} tone-${q.tone}`}>
              <InsightIc icon={q.icon} kind={q.tone === 'alert' ? 'alert' : q.tone === 'warn' ? 'billing' : undefined} size={38} />
              <div className="grow">
                <div className="strong">
                  <span className="queue-count num">{num(q.count)}</span> {tx(q.title)}
                </div>
                <div className="small muted">{tx(q.detail)}</div>
                {q.contacted > 0 && (
                  <span className="badge info attention-note">
                    <Check size={13} aria-hidden /> {t(`${num(q.contacted)} already sent the message`, `${num(q.contacted)} hebben het bericht al gekregen`)}
                  </span>
                )}
              </div>
              <div className="queue-actions">
                {q.templateId ? (
                  <>
                    <Link to={segmentLinks(q).send} className={`btn ${open > 0 ? 'btn-primary' : 'btn-outline'} btn-sm`}>
                      <Send size={14} /> {t(`Message ${num(q.count)}`, `Bericht aan ${num(q.count)}`)}
                    </Link>
                    <Link to={segmentLinks(q).list} className="btn btn-ghost btn-sm">
                      {t('View customers', 'Bekijk klanten')}
                    </Link>
                  </>
                ) : (
                  <Link to={q.to ?? '/staff'} className="btn btn-primary btn-sm">
                    {t('Open', 'Openen')} <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** What customers are doing in the app right now, across the whole base: who, what, how long ago. */
export function FeedCard({ feed, fresh, onlineNow, now, limit = 6 }: { feed: Activity[]; fresh: Set<string>; onlineNow: number; now: number; limit?: number }) {
  const { t, tx, lang, num } = useI18n();
  const [filter, setFilter] = useState('all');
  const cat = CATEGORIES.find((c) => c.id === filter);
  const rows = (cat ? feed.filter((a) => cat.kinds.includes(a.kind)) : feed).slice(0, limit);
  // Screen views and staff messages are not in this feed, so those two filters are left out.
  const filters = CATEGORIES.filter((c) => c.id !== 'views' && c.id !== 'messages');
  return (
    <Card
      title={t('Live activity', 'Live activiteit')}
      sub={t(`What customers are doing in ${brand.portal} right now`, `Wat klanten nu doen in ${brand.portal}`)}
      action={
        <span className="badge ok">
          <i className="staff-dot on" aria-hidden /> {t(`${num(onlineNow)} in the app now`, `${num(onlineNow)} nu in de app`)}
        </span>
      }
      className="feed-card"
    >
      <div className="pills" role="group" aria-label={t('Filter', 'Filter')}>
        <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          {t('All', 'Alles')}
        </button>
        {filters.map((c) => (
          <button key={c.id} className={filter === c.id ? 'on' : ''} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {tx(c.label)}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="small muted staff-empty">
          <ActivityIcon size={18} aria-hidden /> {t('Nothing of this kind yet.', 'Nog niets van deze soort.')}
        </p>
      ) : (
        <ol className="feed" aria-live="polite">
          {rows.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id} className={fresh.has(a.id) ? 'fresh' : undefined}>
                <Initials name={a.customerName ?? ''} />
                <div className="grow">
                  <Link to={`/staff/customers/${a.customerId ?? ''}`} className="strong small">
                    {a.customerName}
                  </Link>
                  <div className="small feed-what">
                    <Icon size={14} aria-hidden /> {tx(a.text)}
                  </div>
                </div>
                <time className="xs muted" dateTime={a.ts}>
                  {ago(a.ts, lang, now)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
      <Link to="/staff/activity" className="btn btn-ghost btn-sm mt">
        {t('All activity', 'Alle activiteit')} <ArrowRight size={14} />
      </Link>
    </Card>
  );
}

/** Actions in the app today, per hour. */
export function HourChart({ p }: { p: Portfolio }) {
  const { t, num } = useI18n();
  const { chart: c } = useTheme();
  const rows = p.byHour.map((h) => ({ name: `${String(h.hour).padStart(2, '0')}:00`, actions: h.actions }));
  const total = rows.reduce((n, r) => n + r.actions, 0);
  return (
    <Card title={t('App activity today', 'App-activiteit vandaag')} sub={t(`${num(total)} actions so far, per hour`, `${num(total)} acties tot nu toe, per uur`)}>
      <div style={{ width: '100%', height: 230 }}>
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={48} />
            <Tooltip
              cursor={{ fill: c.cursor }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="chart-tip">
                    <b>{label}</b>
                    <div>{t(`${num(Number(payload[0]?.value))} actions`, `${num(Number(payload[0]?.value))} acties`)}</div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey="actions" fill="#00aaff" radius={[5, 5, 3, 3]} animationDuration={600} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** How the base is doing: installments on track or too low, and customers per contract. */
export function HealthCard({ p }: { p: Portfolio }) {
  const { t, tx, num } = useI18n();
  const pct = (n: number) => Math.round((n / p.customers) * 100);
  const max = Math.max(...p.products.map((x) => x.count));
  return (
    <Card
      title={t('Customer base', 'Klantenbestand')}
      sub={t(`${num(p.customers)} customers, ${num(p.appUsers)} use the app`, `${num(p.customers)} klanten, ${num(p.appUsers)} gebruiken de app`)}
      action={
        <Link to="/staff/customers" className="btn btn-ghost btn-sm">
          <Users size={14} /> {t('All customers', 'Alle klanten')}
        </Link>
      }
    >
      <div className="small strong">{t('Installments', 'Termijnbedragen')}</div>
      <div className="split-bar" role="img" aria-label={t(`${pct(p.installments.onTrack)}% on track, ${pct(p.installments.tooLow)}% too low`, `${pct(p.installments.onTrack)}% passend, ${pct(p.installments.tooLow)}% te laag`)}>
        <span className="ok" style={{ width: `${pct(p.installments.onTrack)}%` }} />
        <span className="low" style={{ width: `${100 - pct(p.installments.onTrack)}%` }} />
      </div>
      <div className="row between small split-legend">
        <span>
          <i className="ok" /> {t(`On track: ${num(p.installments.onTrack)}`, `Passend: ${num(p.installments.onTrack)}`)}
        </span>
        <Link to="/staff/customers?filter=installment">
          <i className="low" /> {t(`Too low: ${num(p.installments.tooLow)}`, `Te laag: ${num(p.installments.tooLow)}`)}
        </Link>
      </div>
      <div className="small strong mt">{t('Contracts', 'Contracten')}</div>
      <ul className="appl-list mt-s">
        {p.products.map((x) => (
          <li key={x.label.en}>
            <span className="small">{tx(x.label)}</span>
            <span className="appl-track" aria-hidden>
              <span style={{ width: `${(x.count / max) * 100}%`, background: 'var(--blue)' }} />
            </span>
            <span className="small num">{num(x.count)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Attention flags as small badges (customer list and customer header). */
export function FlagBadges({ c }: { c: CustomerSummary }) {
  const { t } = useI18n();
  if (c.flags.length === 0) return <span className="xs muted">{t('Nothing open', 'Niets open')}</span>;
  return (
    <span className="row wrap" style={{ gap: 6 }}>
      {c.flags.includes('installment') && <span className="badge warn">{t('Installment too low', 'Termijn te laag')}</span>}
      {c.flags.includes('ev-peak') && <span className="badge pur">{t('EV at peak hours', 'Laden in piekuren')}</span>}
      {c.flags.includes('night-use') && <span className="badge danger">{t('Night-time use', 'Nachtverbruik')}</span>}
    </span>
  );
}
