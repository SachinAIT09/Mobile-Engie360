import { Mail, Send } from 'lucide-react';
import { Card } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { useStaff } from '../context';
import { KIND_ICON, ago } from '../kinds';
import { Composer, StaffHead } from '../parts';

/** Write to the customer, and see what was sent and read. */
export default function StaffMessages() {
  const { t, tx, lang } = useI18n();
  const { overview, templates, connection, send, activity, now } = useStaff();
  const history = activity.filter((a) => a.kind === 'staff_message' || a.kind === 'message_read');
  return (
    <>
      <StaffHead
        icon={Send}
        title={t('Messages', 'Berichten')}
        sub={t('Send the customer a personal message. It lands in the app inbox at once, and on the phone if notifications are on.', 'Stuur de klant een persoonlijk bericht. Het staat direct in de inbox van de app, en op de telefoon als meldingen aan staan.')}
      />
      <div className="staff-grid">
        <Composer templates={templates} pushDevices={overview?.pushDevices ?? 0} disabled={connection !== 'live'} onSend={send} />
        <Card title={t('Sent and read', 'Verstuurd en gelezen')} sub={t('This session', 'Deze sessie')}>
          {history.length === 0 ? (
            <p className="small muted staff-empty">
              <Mail size={18} aria-hidden /> {t('No messages yet.', 'Nog geen berichten.')}
            </p>
          ) : (
            <ol className="staff-feed">
              {history.map((a) => {
                const Icon = KIND_ICON[a.kind];
                return (
                  <li key={a.id} className={a.kind === 'message_read' ? 'action' : ''}>
                    <span className="staff-feed-ic" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className="grow small">{tx(a.text)}</span>
                    <span className="xs muted">{ago(a.ts, lang, now)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
