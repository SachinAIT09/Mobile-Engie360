import { useState } from 'react';
import { Download, FileText, History, Search } from 'lucide-react';
import type { AuditAction } from '../../../shared/contract';
import { Card } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { useI18n, type Text } from '../../lib/i18n';
import { useStaff } from '../context';
import { ago } from '../kinds';
import { usePaged } from '../paging';
import { Pager, StaffHead } from '../parts';

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

/** What each quick filter covers: the things an auditor actually asks about. */
const KINDS: { id: string; label: Text; actions: AuditAction[] }[] = [
  { id: 'messages', label: { en: 'Messages', nl: 'Berichten' }, actions: ['MESSAGE_SENT', 'MESSAGE_SCHEDULED', 'MESSAGE_CANCELLED', 'MESSAGE_DISPATCHED', 'ALERT_SENT'] },
  { id: 'records', label: { en: 'Customer records', nl: 'Klantdossiers' }, actions: ['CUSTOMER_VIEWED'] },
  { id: 'exports', label: { en: 'Exports', nl: 'Exports' }, actions: ['REPORT_EXPORTED'] },
  { id: 'access', label: { en: 'Sign-ins', nl: 'Inloggen' }, actions: ['STAFF_SIGNED_IN', 'DEMO_RESET'] },
];
const PERIODS: { id: string; days: number; label: Text }[] = [
  { id: 'today', days: 1, label: { en: 'Last 24 hours', nl: 'Laatste 24 uur' } },
  { id: 'week', days: 7, label: { en: 'Last 7 days', nl: 'Laatste 7 dagen' } },
  { id: 'all', days: 0, label: { en: 'Last 14 days', nl: 'Laatste 14 dagen' } },
];

/**
 * Who did what, and when: every message, every customer record opened, every export and sign-in,
 * by the whole team and by the system. Filter by kind, person, period or text; paged; exports as CSV.
 */
export default function StaffAudit() {
  const { t, tx, date, lang, num } = useI18n();
  const { audit, now } = useStaff();
  const [kind, setKind] = useState('all');
  const [who, setWho] = useState('');
  const [period, setPeriod] = useState('all');
  const [q, setQ] = useState('');

  const people = [...new Set(audit.map((e) => e.actor.name))].sort();
  const actions = KINDS.find((k) => k.id === kind)?.actions;
  const days = PERIODS.find((p) => p.id === period)?.days ?? 0;
  const needle = q.trim().toLowerCase();
  const rows = audit.filter(
    (e) =>
      (!actions || actions.includes(e.action)) &&
      (!who || e.actor.name === who) &&
      (!days || now - new Date(e.at).getTime() < days * 86_400_000) &&
      (!needle || `${e.actor.name} ${tx(e.target)} ${tx(e.summary)} ${tx(ACTION_LABEL[e.action])}`.toLowerCase().includes(needle)),
  );
  const paged = usePaged(rows);
  const staff = new Set(audit.filter((e) => e.actor.kind === 'STAFF').map((e) => e.actor.name)).size;
  const when = (iso: string) => date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const exportCsv = () =>
    downloadCsv('audit-log', [
      [t('When', 'Wanneer'), t('Who', 'Wie'), t('Role', 'Rol'), t('Action', 'Actie'), t('Subject', 'Onderwerp'), t('Details', 'Details')],
      ...rows.map((e) => [when(e.at), e.actor.name, tx(e.actor.role), tx(ACTION_LABEL[e.action]), tx(e.target), tx(e.summary)]),
    ]);

  return (
    <>
      <StaffHead icon={History} title={t('Audit log', 'Auditlog')} sub={t('Who did what, and when: messages to customers, customer records opened, reports exported and sign-ins, by the team and by the system. Updates live.', 'Wie deed wat, en wanneer: berichten aan klanten, geopende klantdossiers, geëxporteerde rapporten en inlogmomenten, door het team en door het systeem. Live bijgewerkt.')} />
      <Card
        title={
          <span className="row" style={{ gap: 10 }}>
            <FileText size={20} aria-hidden /> {t('Activity', 'Activiteit')}
          </span>
        }
        sub={t(`${num(rows.length)} of ${num(audit.length)} entries · ${staff} staff members`, `${num(rows.length)} van ${num(audit.length)} regels · ${staff} medewerkers`)}
        action={
          <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={14} /> {t('Export CSV', 'Exporteer CSV')}
          </button>
        }
      >
        <div className="audit-filters">
          <div className="pills" role="group" aria-label={t('Filter by kind', 'Filter op soort')}>
            <button className={kind === 'all' ? 'on' : ''} aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
              {t('All', 'Alles')}
            </button>
            {KINDS.map((k) => (
              <button key={k.id} className={kind === k.id ? 'on' : ''} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                {tx(k.label)}
              </button>
            ))}
          </div>
          <div className="audit-selects">
            <select className="input audit-filter" value={who} onChange={(e) => setWho(e.target.value)} aria-label={t('Filter by person', 'Filter op persoon')}>
              <option value="">{t('Everyone', 'Iedereen')}</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select className="input audit-filter" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t('Filter by period', 'Filter op periode')}>
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {tx(p.label)}
                </option>
              ))}
            </select>
            <label className="cust-search">
              <Search size={16} aria-hidden />
              <input className="input" type="search" value={q} placeholder={t('Search the log', 'Zoek in het log')} aria-label={t('Search the log', 'Zoek in het log')} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>
        </div>
        {paged.rows.length === 0 ? (
          <p className="small muted staff-empty">
            <History size={18} aria-hidden /> {t('No entries match these filters.', 'Geen regels bij deze filters.')}
          </p>
        ) : (
          <div className="table-wrap mt">
            <table className="table staff-table audit-table">
              <thead>
                <tr>
                  <th>{t('When', 'Wanneer')}</th>
                  <th>{t('Who', 'Wie')}</th>
                  <th>{t('Action', 'Actie')}</th>
                  <th>{t('Subject', 'Onderwerp')}</th>
                  <th className="hide-m">{t('Details', 'Details')}</th>
                </tr>
              </thead>
              <tbody aria-live="polite">
                {paged.rows.map((e) => (
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
        <Pager paged={paged} />
      </Card>
    </>
  );
}
