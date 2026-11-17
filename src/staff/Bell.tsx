import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity as ActivityIcon, Bell } from 'lucide-react';
import type { Activity } from '../../shared/contract';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';
import { KIND_ICON, LIVE_CUSTOMER_ID, ago } from './kinds';

const SEEN_KEY = 'engie-demo.staff-seen';

function readSeen(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Top-bar bell: what the customer did since staff last looked, with an unread count (as in the Hydro staff app). */
export function StaffBell({ activity, now }: { activity: Activity[]; now: number }) {
  const { t, tx, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const wrap = useRef<HTMLDivElement>(null);
  // Staff's own messages and plain screen views are not news.
  const items = activity.filter((a) => a.kind !== 'staff_message' && a.kind !== 'page');
  const unread = items.filter((a) => new Date(a.ts).getTime() > seen).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    // Opening the panel counts as having seen everything in it.
    if (!open) {
      const ts = Date.now();
      setSeen(ts);
      try {
        localStorage.setItem(SEEN_KEY, String(ts));
      } catch {
        /* storage unavailable: the badge just comes back after a reload */
      }
    }
    setOpen(!open);
  };

  return (
    <div className="pop-wrap" ref={wrap}>
      <button className="icon-btn staff-bell" aria-label={t(`Customer activity, ${unread} new`, `Klantactiviteit, ${unread} nieuw`)} aria-expanded={open} onClick={toggle}>
        <Bell size={19} />
        {unread > 0 && <span className="staff-bell-count num">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="popover staff-bell-pop">
          <div className="pop-head">
            <h3>{t('Customer activity', 'Klantactiviteit')}</h3>
            <Link to="/staff/activity" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              {t('View all', 'Alles bekijken')}
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="small muted staff-empty" style={{ padding: '14px 16px' }}>
              <ActivityIcon size={18} aria-hidden /> {t(`Nothing yet. It shows here as soon as the customer uses ${brand.portal}.`, `Nog niets. Het verschijnt hier zodra de klant ${brand.portal} gebruikt.`)}
            </p>
          ) : (
            items.slice(0, 12).map((a) => {
              const Icon = KIND_ICON[a.kind];
              return (
                <Link key={a.id} to={`/staff/customers/${LIVE_CUSTOMER_ID}`} className={`pop-item${new Date(a.ts).getTime() > seen ? ' unread' : ''}`} onClick={() => setOpen(false)}>
                  <span className="staff-feed-ic" aria-hidden>
                    <Icon size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="small" style={{ display: 'block' }}>
                      {tx(a.text)}
                    </span>
                    <span className="xs muted">{ago(a.ts, lang, now)}</span>
                  </span>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
