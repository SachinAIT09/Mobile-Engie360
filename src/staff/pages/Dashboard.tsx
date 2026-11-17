import { Link } from 'react-router-dom';
import { BellRing, LayoutDashboard, MailCheck, Smartphone, TriangleAlert, Users } from 'lucide-react';
import { Kpi } from '../../components/ui';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { StaffHead } from '../parts';
import { FeedCard, HealthCard, HourChart, QueuePanel } from '../portfolio';

/** Staff home for the whole customer base: the numbers, what needs attention, and what customers are doing right now. */
export default function StaffDashboard() {
  const { t, num } = useI18n();
  const { portfolio: p, feed, fresh, now } = useStaff();
  const foot = (text: string) => <span className="xs muted">{text}</span>;
  return (
    <>
      <StaffHead
        icon={LayoutDashboard}
        title={t('Dashboard', 'Dashboard')}
        sub={t(`Your customers in ${brand.portal}: who needs attention, and what they are doing right now.`, `Je klanten in ${brand.portal}: wie aandacht nodig heeft, en wat ze nu doen.`)}
      >
        <Link to="/staff/customers" className="btn btn-outline btn-sm">
          <Users size={14} /> {t('All customers', 'Alle klanten')}
        </Link>
      </StaffHead>
      {p && (
        <>
          <div className="grid g-4 staff-kpis">
            <Kpi icon={Users} tone="el" label={t('Customers', 'Klanten')} value={num(p.customers)} foot={foot(t(`${num(p.appUsers)} use the app`, `${num(p.appUsers)} gebruiken de app`))} />
            <Kpi icon={Smartphone} tone="eur" label={t('In the app now', 'Nu in de app')} value={num(p.onlineNow)} foot={foot(t('Updates live', 'Live bijgewerkt'))} />
            <Kpi icon={BellRing} tone="pur" label={t('Active in the last 24 hours', 'Actief in de laatste 24 uur')} value={num(p.activeToday)} foot={foot(t(`${Math.round((p.activeToday / p.appUsers) * 100)}% of app users`, `${Math.round((p.activeToday / p.appUsers) * 100)}% van de app-gebruikers`))} />
            <Kpi icon={TriangleAlert} tone="gas" label={t('Need attention', 'Vragen aandacht')} value={num(p.needAttention)} foot={foot(t(`${Math.round((p.needAttention / p.customers) * 100)}% of customers`, `${Math.round((p.needAttention / p.customers) * 100)}% van de klanten`))} />
            <Kpi
              icon={MailCheck}
              tone="ink"
              label={t('Messages read', 'Berichten gelezen')}
              value={p.messages.sent > 0 ? `${Math.round((p.messages.read / p.messages.sent) * 100)}%` : '–'}
              foot={foot(t(`${num(p.messages.read)} of ${num(p.messages.sent)} sent`, `${num(p.messages.read)} van ${num(p.messages.sent)} verstuurd`))}
            />
          </div>
          <div className="staff-grid wide-left even">
            <QueuePanel queue={p.queue} needAttention={p.needAttention} />
            <FeedCard feed={feed} fresh={fresh} onlineNow={p.onlineNow} now={now} />
          </div>
          <div className="staff-grid even">
            <HourChart p={p} />
            <HealthCard p={p} />
          </div>
        </>
      )}
    </>
  );
}
