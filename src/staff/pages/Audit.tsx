import { useState } from 'react';
import { Download, FileText, History } from 'lucide-react';
import type { AuditAction } from '../../../shared/contract';
import { Card } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { useI18n, type Text } from '../../lib/i18n';
import { useStaff } from '../context';
import { ago } from '../kinds';
import { StaffHead } from '../parts';

const ACTION_LABEL: Record<AuditAction, Text> = {
  MESSAGE_SENT: { en: 'Message sent', nl: 'Bericht verstuurd' },
  MESSAGE_SCHEDULED: { en: 'Message scheduled', nl: 'Bericht ingepland' },
  MESSAGE_CANCELLED: { en: 'Message cancelled', nl: 'Bericht geannuleerd' },
  MESSAGE_DISPATCHED: { en: 'Scheduled message sent', nl: 'Ingepland bericht verstuurd' },
  ALERT_SENT: { en: 'Automatic notification', nl: 'Automatische melding' },
  CUSTOMER_VIEWED: { en: 'Customer record opened', nl: 'Klantdossier geopend' },
  REPORT_EXPORTED: { en: 'Report exported', nl: 'Rapport geëxporteerd' },
  STAFF_SIGNED_IN: { en: 'Signed in', nl: 'Ingelogd' },
  DEMO_RESET: { en: 'Demo reset', nl: 'Demo gereset' },
};
const ACTION_TONE: Record<AuditAction, string> = { MESSAGE_SENT: 'info', MESSAGE_SCHEDULED: 'pur', MESSAGE_CANCELLED: 'danger', MESSAGE_DISPATCHED: 'ok', ALERT_SENT: 'warn', CUSTOMER_VIEWED: 'neutral', REPORT_EXPORTED: 'green', STAFF_SIGNED_IN: 'neutral', DEMO_RESET: 'neutral' };

/** Who did what, newest first, live (the Hydro "Audit log" page). */
export default function StaffAudit() {
  const { t, tx, date, lang } = useI18n();
  const { audit, now } = useStaff();
  const [action, setAction] = useState<AuditAction | ''>('');
  const rows = audit.filter((e) => !action || e.action === action);
  const people = new Set(audit.filter((e) => e.actor.kind === 'STAFF').map((e) => e.actor.name)).size;
  const when = (iso: string) => date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const exportCsv = () =>
    downloadCsv('audit-log', [
      [t('When', 'Wanneer'), t('Who', 'Wie'), t('Role', 'Rol'), t('Action', 'Actie'), t('Target', 'Onderwerp'), t('Details', 'Details')],
      ...rows.map((e) => [when(e.at), e.actor.name, tx(e.actor.role), tx(ACTION_LABEL[e.action]), tx(e.target), tx(e.summary)]),
    ]);

  return (
    <>
      <StaffHead icon={History} title={t('Audit log', 'Auditlog')} sub={t('Every message sent, scheduled or cancelled, every automatic notification and every demo reset, with who did it. Updates live.', 'Elk verstuurd, ingepland of geannuleerd bericht, elke automatische melding en elke demo-reset, met wie het deed. Live bijgewerkt.')} />
      <Card
        title={
          <span className="row" style={{ gap: 10 }}>
            <FileText size={20} aria-hidden /> {t('Latest activity', 'Laatste activiteit')}
          </span>
        }
        sub={t(`${rows.length} of the latest ${audit.length} entries · ${people} staff ${people === 1 ? 'member' : 'members'}`, `${rows.length} van de laatste ${audit.length} regels · ${people} ${people === 1 ? 'medewerker' : 'medewerkers'}`)}
        action={
          <span className="row" style={{ gap: 10 }}>
            <select className="input audit-filter" value={action} onChange={(e) => setAction(e.target.value as AuditAction | '')} aria-label={t('Filter by action', 'Filter op actie')}>
              <option value="">{t('All actions', 'Alle acties')}</option>
              {(Object.keys(ACTION_LABEL) as AuditAction[]).map((a) => (
                <option key={a} value={a}>
                  {tx(ACTION_LABEL[a])}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={14} /> {t('Export CSV', 'Exporteer CSV')}
            </button>
          </span>
        }
      >
        {rows.length === 0 ? (
          <p className="small muted staff-empty">
            <History size={18} aria-hidden /> {action ? t('No entries for this action.', 'Geen regels voor deze actie.') : t('Nothing logged yet.', 'Nog niets vastgelegd.')}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table staff-table audit-table">
              <thead>
                <tr>
                  <th>{t('When', 'Wanneer')}</th>
                  <th>{t('Who', 'Wie')}</th>
                  <th>{t('Action', 'Actie')}</th>
                  <th>{t('Target', 'Onderwerp')}</th>
                  <th className="hide-m">{t('Details', 'Details')}</th>
                </tr>
              </thead>
              <tbody aria-live="polite">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="strong small">{when(e.at)}</span>
                      <span className="xs muted" style={{ display: 'block' }}>
                        {ago(e.at, lang, now)}
                      </span>
                    </td>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <span className={`audit-avatar${e.actor.kind === 'SYSTEM' ? ' system' : ''}`} aria-hidden>
                          {e.actor.name.slice(0, 1)}
                        </span>
                        <span>
                          <span className="strong small" style={{ display: 'block' }}>
                            {e.actor.name}
                          </span>
                          <span className="xs muted">{tx(e.actor.role)}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${ACTION_TONE[e.action]}`}>{tx(ACTION_LABEL[e.action])}</span>
                    </td>
                    <td className="small strong audit-target">{tx(e.target)}</td>
                    <td className="small hide-m staff-details">{tx(e.summary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
