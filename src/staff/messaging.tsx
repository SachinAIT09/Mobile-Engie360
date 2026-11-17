import { useEffect, useState } from 'react';
import { BellRing, CheckCheck, Clock, MailCheck, MousePointerClick, Search, Send, User, Users, X } from 'lucide-react';
import type { AttentionFlag, CustomerSummary, CustomersResponse, OutboxItem, QueueItem } from '../../shared/contract';
import { API, get } from '../api/client';
import { Card, InsightIc, Kpi } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { clock } from './kinds';
import { usePaged } from './paging';
import { Pager, type Audience } from './parts';
import { Initials } from './portfolio';

/** Step 1 of a message: who it goes to. A group that shares an attention point, or one customer found by search. */
export function AudiencePicker({ queue, audience, onChange }: { queue: QueueItem[]; audience: Audience | undefined; onChange: (a: Audience | undefined) => void }) {
  const { t, tx, num } = useI18n();
  const [mode, setMode] = useState<'segment' | 'customer'>(audience?.kind === 'customer' ? 'customer' : 'segment');
  const [q, setQ] = useState('');
  const [found, setFound] = useState<CustomerSummary[]>([]);
  const groups = queue.filter((x) => x.templateId);

  // Search customers on the server as the name is typed.
  useEffect(() => {
    if (mode !== 'customer' || q.trim().length < 2) return;
    let stale = false;
    const id = setTimeout(() => {
      get<CustomersResponse>(`${API.staffCustomers}?q=${encodeURIComponent(q.trim())}`).then(
        (r) => !stale && setFound(r.rows.slice(0, 6)),
        () => undefined,
      );
    }, 200);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [mode, q]);
  const results = q.trim().length < 2 ? [] : found;

  return (
    <div className="aud">
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <span className="step-label">
          <i>1</i> {t('Who is it for?', 'Voor wie is het?')}
        </span>
        <div className="seg" role="group" aria-label={t('Recipient type', 'Soort ontvanger')}>
          <button className={mode === 'segment' ? 'on' : ''} aria-pressed={mode === 'segment'} onClick={() => setMode('segment')}>
            <Users size={14} aria-hidden /> {t('A group', 'Een groep')}
          </button>
          <button className={mode === 'customer' ? 'on' : ''} aria-pressed={mode === 'customer'} onClick={() => setMode('customer')}>
            <User size={14} aria-hidden /> {t('One customer', 'Eén klant')}
          </button>
        </div>
      </div>

      {mode === 'segment' ? (
        <div className="aud-groups" role="radiogroup" aria-label={t('Group', 'Groep')}>
          {groups.map((g) => {
            const on = audience?.kind === 'segment' && audience.id === g.id;
            return (
              <button key={g.id} role="radio" aria-checked={on} className={`aud-group${on ? ' on' : ''}`} onClick={() => onChange({ kind: 'segment', id: g.id as AttentionFlag, label: tx(g.title), count: g.count, templateId: g.templateId })}>
                <InsightIc icon={g.icon} kind={g.tone === 'alert' ? 'alert' : g.tone === 'warn' ? 'billing' : undefined} size={34} />
                <span className="grow">
                  <span className="small strong">{tx(g.title)}</span>
                  <span className="xs muted">{g.contacted > 0 ? t(`${num(g.contacted)} already messaged today`, `${num(g.contacted)} vandaag al benaderd`) : t('Not messaged today', 'Vandaag nog niet benaderd')}</span>
                </span>
                <span className="aud-count num">{num(g.count)}</span>
              </button>
            );
          })}
        </div>
      ) : audience?.kind === 'customer' ? (
        <div className="aud-picked">
          <Initials name={audience.name} />
          <span className="grow small strong">{audience.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onChange(undefined)}>
            <X size={14} /> {t('Choose another', 'Kies een ander')}
          </button>
        </div>
      ) : (
        <div className="aud-search">
          <label className="cust-search">
            <Search size={16} aria-hidden />
            <input className="input" type="search" value={q} placeholder={t('Search by name, email or customer number', 'Zoek op naam, e-mail of klantnummer')} aria-label={t('Find a customer', 'Zoek een klant')} onChange={(e) => setQ(e.target.value)} />
          </label>
          {results.length > 0 && (
            <ul className="aud-results">
              {results.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onChange({ kind: 'customer', id: c.id, name: `${c.firstName} ${c.lastName}`, live: c.live })}>
                    <Initials name={`${c.firstName} ${c.lastName}`} live={c.live} />
                    <span className="grow">
                      <span className="small strong">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="xs muted">
                        {c.customerNo} · {c.city}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && results.length === 0 && <p className="xs muted">{t('No customer found yet. Keep typing.', 'Nog geen klant gevonden. Typ verder.')}</p>}
        </div>
      )}
    </div>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Results of everything sent in the last 30 days, at a glance. */
export function MessageStats({ items }: { items: OutboxItem[] }) {
  const { t, num } = useI18n();
  const [since] = useState(() => Date.now() - 30 * 86_400_000);
  const recent = items.filter((o) => o.status === 'sent' && o.sentAt && new Date(o.sentAt).getTime() >= since);
  const sent = recent.reduce((n, o) => n + (o.audience?.count ?? 1), 0);
  const delivered = recent.reduce((n, o) => n + (o.audience ? o.audience.delivered : 1), 0);
  const opened = recent.reduce((n, o) => n + (o.audience ? o.audience.read : o.readAt ? 1 : 0), 0);
  const acted = recent.reduce((n, o) => n + (o.audience?.acted ?? 0), 0);
  const foot = (text: string) => <span className="xs muted">{text}</span>;
  return (
    <div className="grid g-4 msg-stats">
      <Kpi icon={Send} tone="el" label={t('Sent, last 30 days', 'Verstuurd, laatste 30 dagen')} value={num(sent)} foot={foot(t(`${recent.length} messages`, `${recent.length} berichten`))} />
      <Kpi icon={BellRing} tone="pur" label={t('Delivered', 'Afgeleverd')} value={`${pct(delivered, sent)}%`} foot={foot(t(`${num(delivered)} reached the app`, `${num(delivered)} kwamen aan in de app`))} />
      <Kpi icon={MailCheck} tone="eur" label={t('Opened', 'Geopend')} value={`${pct(opened, delivered)}%`} foot={foot(t(`${num(opened)} customers`, `${num(opened)} klanten`))} />
      <Kpi icon={MousePointerClick} tone="gas" label={t('Acted on it', 'Actie genomen')} value={`${pct(acted, delivered)}%`} foot={foot(t(`${num(acted)} customers`, `${num(acted)} klanten`))} />
    </div>
  );
}

type StatusFilter = 'all' | 'sent' | 'scheduled' | 'cancelled';

/** Every message sent or scheduled: who it went to and what came of it. Filter by status and kind, paged. */
export function MessageHistory({ items, onCancel }: { items: OutboxItem[]; onCancel: (id: string) => void }) {
  const { t, tx, num, date, lang } = useI18n();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kind, setKind] = useState<'all' | 'group' | 'one'>('all');
  const rows = items.filter((o) => (status === 'all' || o.status === status) && (kind === 'all' || (kind === 'group' ? !!o.audience : !o.audience)));
  const paged = usePaged(rows, 8);
  const when = (iso: string) => date(iso, { day: 'numeric', month: 'short' });
  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: t('All', 'Alle') },
    { id: 'sent', label: t('Sent', 'Verstuurd') },
    { id: 'scheduled', label: t('Scheduled', 'Ingepland') },
    { id: 'cancelled', label: t('Cancelled', 'Geannuleerd') },
  ];
  return (
    <Card
      title={t('Message history', 'Berichtgeschiedenis')}
      sub={t(`${num(rows.length)} of ${num(items.length)} messages`, `${num(rows.length)} van ${num(items.length)} berichten`)}
      className="history-card"
      action={
        <select className="input audit-filter" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label={t('Filter by recipient', 'Filter op ontvanger')}>
          <option value="all">{t('Groups and single customers', 'Groepen en losse klanten')}</option>
          <option value="group">{t('Groups only', 'Alleen groepen')}</option>
          <option value="one">{t('Single customers only', 'Alleen losse klanten')}</option>
        </select>
      }
    >
      <div className="pills" role="group" aria-label={t('Filter by status', 'Filter op status')}>
        {filters.map((f) => (
          <button key={f.id} className={status === f.id ? 'on' : ''} aria-pressed={status === f.id} onClick={() => setStatus(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {paged.rows.length === 0 ? (
        <p className="small muted staff-empty">
          <Send size={18} aria-hidden /> {t('No messages match these filters.', 'Geen berichten bij deze filters.')}
        </p>
      ) : (
        <div className="table-wrap mt">
          <table className="table staff-table history-table">
            <thead>
              <tr>
                <th>{t('Message', 'Bericht')}</th>
                <th>{t('To', 'Aan')}</th>
                <th>{t('When', 'Wanneer')}</th>
                <th className="num">{t('Delivered', 'Afgeleverd')}</th>
                <th className="num">{t('Opened', 'Geopend')}</th>
                <th className="num hide-m">{t('Acted', 'Actie')}</th>
                <th>{t('Status', 'Status')}</th>
              </tr>
            </thead>
            <tbody aria-live="polite">
              {paged.rows.map((o) => {
                const a = o.audience;
                const sent = o.status === 'sent';
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <InsightIc icon={o.icon} size={32} />
                        <span className="small strong history-title">{tx(o.title)}</span>
                      </span>
                    </td>
                    <td className="small">
                      {a ? (
                        <>
                          <span className="strong">{t(`${num(a.count)} customers`, `${num(a.count)} klanten`)}</span>
                          <span className="xs muted" style={{ display: 'block' }}>
                            {tx(a.label)}
                          </span>
                        </>
                      ) : (
                        (o.customer?.name ?? t('Live customer', 'Live klant'))
                      )}
                    </td>
                    <td className="small">
                      {when(o.sentAt ?? o.sendAt)}
                      <span className="xs muted" style={{ display: 'block' }}>
                        {clock(o.sentAt ?? o.sendAt, lang).slice(0, 5)}
                      </span>
                    </td>
                    <td className="small num">{!sent ? '–' : a ? `${pct(a.delivered, a.count)}%` : '100%'}</td>
                    <td className="small num">{!sent ? '–' : a ? `${pct(a.read, a.delivered)}%` : o.readAt ? t('Yes', 'Ja') : t('Not yet', 'Nog niet')}</td>
                    <td className="small num hide-m">{!sent || !a ? '–' : `${pct(a.acted, a.delivered)}%`}</td>
                    <td>
                      {o.status === 'scheduled' ? (
                        <span className="row" style={{ gap: 6 }}>
                          <span className="badge info">
                            <Clock size={12} aria-hidden /> {t('Scheduled', 'Ingepland')}
                          </span>
                          <button className="btn btn-ghost btn-sm" onClick={() => onCancel(o.id)} aria-label={t(`Cancel “${tx(o.title)}”`, `Annuleer “${tx(o.title)}”`)}>
                            {t('Cancel', 'Annuleren')}
                          </button>
                        </span>
                      ) : o.status === 'cancelled' ? (
                        <span className="badge neutral">{t('Cancelled', 'Geannuleerd')}</span>
                      ) : (
                        <span className="badge ok">
                          <CheckCheck size={12} aria-hidden /> {t('Sent', 'Verstuurd')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager paged={paged} />
    </Card>
  );
}
