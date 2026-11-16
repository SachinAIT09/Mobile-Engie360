import { LayoutDashboard } from 'lucide-react';
import { useI18n } from '../../lib/i18n';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { ActivityFeed, CustomerCard, StaffHead, StaffKpis } from '../parts';

/** Staff home: the customer at a glance and what they are doing right now. */
export default function StaffDashboard() {
  const { t } = useI18n();
  const { overview: o, activity, fresh, now } = useStaff();
  return (
    <>
      <StaffHead
        icon={LayoutDashboard}
        title={t('Dashboard', 'Dashboard')}
        sub={t(`Your customer in ${brand.portal}: usage, costs, installment advice and what they are doing right now.`, `Je klant in ${brand.portal}: verbruik, kosten, termijnadvies en wat de klant nu doet.`)}
      />
      {o && (
        <>
          <StaffKpis o={o} />
          <div className="staff-grid">
            <CustomerCard o={o} now={now} />
            <ActivityFeed items={activity} fresh={fresh} />
          </div>
        </>
      )}
    </>
  );
}
