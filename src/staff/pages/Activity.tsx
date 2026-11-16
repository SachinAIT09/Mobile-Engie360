import { useState } from 'react';
import { History, Smartphone } from 'lucide-react';
import { Card } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { ACTION_KINDS, CATEGORIES, KIND_ICON, KIND_LABEL, ago } from '../kinds';
import { StaffHead } from '../parts';

/** Everything the customer does in the app, as a live table with filters (the Hydro "Customer activity" page). */
export default function StaffActivity() {
  const { t, tx, lang, date } = useI18n();
  const { activity, fresh, overview, now } = useStaff();
  const [filter, setFilter] = useState('all');
  const cat = CATEGORIES.find((c) => c.id === filter);
  const rows = cat ? activity.filter((a) => cat.kinds.includes(a.kind)) : activity;
  const name = overview ? `${overview.customer.firstName} ${overview.customer.lastName}` : '';

  return (
    <>
      <StaffHead
        icon={Smartphone}
        title={t('Customer activity', 'Klantactiviteit')}
        sub={t(
          `Everything the customer does in ${brand.portal} (sign-ins, installment changes, savings plan, smart charging, ${brand.assistant.name} questions and screen views) as it happens.`,
          `Alles wat de klant doet in ${brand.portal} (inloggen, termijnbedrag, bespaarplan, slim laden, vragen aan ${brand.assistant.name} en schermen) op het moment zelf.`,
        )}
      />
      <Card
        title={
          <span className="row" style={{ gap: 10 }}>
            <History size={20} aria-hidden /> {t('Live feed', 'Live feed')}
          </span>
        }
        sub={t(`${rows.length} of the latest ${activity.length} entries`, `${rows.length} van de laatste ${activity.length} regels`)}
      >
        <div className="pills" role="group" aria-label={t('Filter', 'Filter')}>
          <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('All', 'Alles')}
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} className={filter === c.id ? 'on' : ''} aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              {tx(c.label)}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="small muted staff-empty">{t(`Nothing here yet. Sign in to ${brand.portal} on a phone or in another tab.`, `Nog niets. Log in bij ${brand.portal} op een telefoon of in een ander tabblad.`)}</p>
        ) : (
          <div className="table-wrap mt">
            <table className="table staff-table">
              <thead>
                <tr>
                  <th>{t('When', 'Wanneer')}</th>
                  <th className="hide-m">{t('Customer', 'Klant')}</th>
                  <th>{t('Action', 'Actie')}</th>
                  <th>{t('Details', 'Details')}</th>
                </tr>
              </thead>
              <tbody aria-live="polite">
                {rows.map((a) => {
                  const Icon = KIND_ICON[a.kind];
                  return (
                    <tr key={a.id} className={fresh.has(a.id) ? 'fresh' : undefined}>
                      <td>
                        <span className="strong small">{date(a.ts, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="xs muted" style={{ display: 'block' }}>
                          {ago(a.ts, lang, now)}
                        </span>
                      </td>
                      <td className="hide-m strong small">{name}</td>
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
      </Card>
    </>
  );
}
