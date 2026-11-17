import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, Smartphone } from 'lucide-react';
import { Card } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { ACTION_KINDS, CATEGORIES, KIND_ICON, KIND_LABEL, ago } from '../kinds';
import { usePaged } from '../paging';
import { Pager, StaffHead } from '../parts';

/** Everything the customer does in the app, as a live table with filters (the Hydro "Customer activity" page). */
export default function StaffActivity() {
  const { t, tx, lang, date } = useI18n();
  const { feed: activity, fresh, now } = useStaff();
  const [filter, setFilter] = useState('all');
  const cat = CATEGORIES.find((c) => c.id === filter);
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const rows = activity.filter((a) => (!cat || cat.kinds.includes(a.kind)) && (!needle || `${a.customerName ?? ''} ${tx(a.text)}`.toLowerCase().includes(needle)));
  const paged = usePaged(rows);

  return (
    <>
      <StaffHead
        icon={Smartphone}
        title={t('Customer activity', 'Klantactiviteit')}
        sub={t(`What customers do in ${brand.portal} (sign-ins, installment changes, savings plan, smart charging, ${brand.assistant.name} questions), across the whole customer base, as it happens.`, `Wat klanten doen in ${brand.portal} (inloggen, termijnbedrag, bespaarplan, slim laden, vragen aan ${brand.assistant.name}), over het hele klantenbestand, op het moment zelf.`)}
      />
      <Card
        title={
          <span className="row" style={{ gap: 10 }}>
            <History size={20} aria-hidden /> {t('Live feed', 'Live feed')}
          </span>
        }
        action={
          <label className="cust-search">
            <Search size={16} aria-hidden />
            <input className="input" type="search" value={q} placeholder={t('Search customer or action', 'Zoek klant of actie')} aria-label={t('Search activity', 'Zoek in activiteit')} onChange={(e) => setQ(e.target.value)} />
          </label>
        }
        sub={t(`${rows.length} of the latest ${activity.length} entries`, `${rows.length} van de laatste ${activity.length} regels`)}
      >
        <div className="pills" role="group" aria-label={t('Filter', 'Filter')}>
          <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('All', 'Alles')}
          </button>
          {CATEGORIES.filter((c) => c.id !== 'views' && c.id !== 'messages').map((c) => (
            <button key={c.id} className={filter === c.id ? 'on' : ''} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              {tx(c.label)}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="small muted staff-empty">{t('Nothing matches this filter or search.', 'Niets gevonden bij dit filter of deze zoekopdracht.')}</p>
        ) : (
          <div className="table-wrap mt">
            <table className="table staff-table">
              <thead>
                <tr>
                  <th>{t('When', 'Wanneer')}</th>
                  <th>{t('Customer', 'Klant')}</th>
                  <th>{t('Action', 'Actie')}</th>
                  <th>{t('Details', 'Details')}</th>
                </tr>
              </thead>
              <tbody aria-live="polite">
                {paged.rows.map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <tr key={a.id} className={fresh.has(a.id) ? 'fresh' : undefined}>
                      <td>
                        <span className="strong small">{date(a.ts, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="xs muted" style={{ display: 'block' }}>
                          {ago(a.ts, lang, now)}
                        </span>
                      </td>
                      <td className="strong small">
                        <Link to={`/staff/customers/${a.customerId ?? ''}`}>{a.customerName}</Link>
                      </td>
                      <td>
                        <span className={`staff-action${ACTION_KINDS.has(a.kind) ? ' change' : ''}`}>
                          <Icon size={14} aria-hidden /> {tx(KIND_LABEL[a.kind])}
                        </span>
                      </td>
                      <td className="small staff-details">{tx(a.text)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager paged={paged} />
      </Card>
    </>
  );
}
