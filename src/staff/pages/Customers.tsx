import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import type { CustomerFilter, CustomersResponse } from '../../../shared/contract';
import { API, get } from '../../api/client';
import { Card } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useStaff } from '../context';
import { ago } from '../kinds';
import { StaffHead } from '../parts';
import { FlagBadges, Initials } from '../portfolio';

const FILTERS: { id: CustomerFilter; label: [string, string] }[] = [
  { id: 'all', label: ['All', 'Alle'] },
  { id: 'attention', label: ['Needs attention', 'Vraagt aandacht'] },
  { id: 'installment', label: ['Installment too low', 'Termijn te laag'] },
  { id: 'ev-peak', label: ['EV at peak hours', 'Laden in piekuren'] },
  { id: 'night-use', label: ['Night-time use', 'Nachtverbruik'] },
  { id: 'online', label: ['In the app now', 'Nu in de app'] },
];

/** Every customer, searchable and filterable; a row opens that customer's page. */
export default function StaffCustomers() {
  const { t, tx, eur, num, lang } = useI18n();
  const navigate = useNavigate();
  const { now, portfolio, connection } = useStaff();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') ?? 'all') as CustomerFilter;
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [failed, setFailed] = useState(false);

  // The list is searched and paged on the server; it reloads when the query changes or customers act.
  const version = `${portfolio?.needAttention ?? 0}-${portfolio?.onlineNow ?? 0}`;
  useEffect(() => {
    let stale = false;
    const url = `${API.staffCustomers}?q=${encodeURIComponent(q)}&filter=${filter}&page=${page}`;
    get<CustomersResponse>(url).then(
      (r) => {
        if (stale) return;
        setData(r);
        setFailed(false);
      },
      () => !stale && setFailed(true),
    );
    return () => {
      stale = true;
    };
  }, [q, filter, page, version, connection]);

  const set = (next: Record<string, string>) => {
    const merged = { q, filter, page: String(page), ...next };
    const clean: Record<string, string> = {};
    if (merged.q) clean.q = merged.q;
    if (merged.filter !== 'all') clean.filter = merged.filter;
    if (merged.page !== '1') clean.page = merged.page;
    setParams(clean, { replace: true });
  };
  const pages = data ? Math.max(1, Math.ceil(data.matched / data.pageSize)) : 1;

  return (
    <>
      <StaffHead icon={Users} title={t('Customers', 'Klanten')} sub={t('Search by name, email, customer number or city, or filter on what needs attention. Open a customer for the full picture.', 'Zoek op naam, e-mail, klantnummer of plaats, of filter op wat aandacht vraagt. Open een klant voor het hele beeld.')} />
      <Card
        title={data ? t(`${num(data.matched)} of ${num(data.total)} customers`, `${num(data.matched)} van ${num(data.total)} klanten`) : t('Customers', 'Klanten')}
        action={
          <label className="cust-search">
            <Search size={16} aria-hidden />
            <input className="input" type="search" value={q} placeholder={t('Search customers', 'Zoek klanten')} aria-label={t('Search customers', 'Zoek klanten')} onChange={(e) => set({ q: e.target.value, page: '1' })} />
          </label>
        }
      >
        <div className="pills" role="group" aria-label={t('Filter', 'Filter')}>
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'on' : ''} aria-pressed={filter === f.id} onClick={() => set({ filter: f.id, page: '1' })}>
              {t(f.label[0], f.label[1])}
            </button>
          ))}
        </div>
        {failed && !data ? (
          <p className="small muted staff-empty">{t('The customer list could not be loaded. It retries when the connection is back.', 'De klantenlijst kon niet worden geladen. Er wordt opnieuw geprobeerd zodra de verbinding terug is.')}</p>
        ) : !data ? (
          <span className="skel" style={{ height: 320, marginTop: 16 }} />
        ) : data.rows.length === 0 ? (
          <p className="small muted staff-empty">
            <Users size={18} aria-hidden /> {t('No customers match. Try another search or filter.', 'Geen klanten gevonden. Probeer een andere zoekopdracht of filter.')}
          </p>
        ) : (
          <>
            <div className="table-wrap mt">
              <table className="table staff-table cust-table">
                <thead>
                  <tr>
                    <th>{t('Customer', 'Klant')}</th>
                    <th className="hide-m">{t('City', 'Plaats')}</th>
                    <th className="hide-m">{t('Contract', 'Contract')}</th>
                    <th>{t('Installment', 'Termijnbedrag')}</th>
                    <th>{t('Attention', 'Aandacht')}</th>
                    <th>{t('Last in the app', 'Laatst in de app')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((c) => (
                    <tr key={c.id} className="row-link" onClick={() => navigate(`/staff/customers/${c.id}`)}>
                      <td>
                        <span className="row" style={{ gap: 10 }}>
                          <Initials name={`${c.firstName} ${c.lastName}`} live={c.live} />
                          <span>
                            <Link to={`/staff/customers/${c.id}`} className="strong small" onClick={(e) => e.stopPropagation()}>
                              {c.firstName} {c.lastName}
                            </Link>
                            <span className="xs muted" style={{ display: 'block' }}>
                              {c.customerNo}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="small hide-m">{c.city}</td>
                      <td className="small hide-m">{tx(c.product)}</td>
                      <td className="small num">
                        {eur(c.installment, 0)}
                        {c.installment < c.advised && <span className="xs muted"> / {eur(c.advised, 0)}</span>}
                      </td>
                      <td>
                        <FlagBadges c={c} />
                      </td>
                      <td className="small">
                        {c.online ? (
                          <span className="badge ok">
                            <i className="staff-dot on" aria-hidden /> {t('Now', 'Nu')}
                          </span>
                        ) : c.appUser ? (
                          ago(c.lastSeen, lang, now)
                        ) : (
                          <span className="muted">{t('No app', 'Geen app')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row between pager">
              <span className="small muted">{t(`Page ${data.page} of ${pages}`, `Pagina ${data.page} van ${pages}`)}</span>
              <span className="row" style={{ gap: 8 }}>
                <button className="btn btn-outline btn-sm" disabled={data.page <= 1} onClick={() => set({ page: String(data.page - 1) })}>
                  <ChevronLeft size={14} /> {t('Previous', 'Vorige')}
                </button>
                <button className="btn btn-outline btn-sm" disabled={data.page >= pages} onClick={() => set({ page: String(data.page + 1) })}>
                  {t('Next', 'Volgende')} <ChevronRight size={14} />
                </button>
              </span>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
