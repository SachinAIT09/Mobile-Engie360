import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronLeft, Sparkles, X } from 'lucide-react';
import { useI18n, type Lang } from '../lib/i18n';
import { customer } from '../data/customer';
import { DEMO_NOW } from '../lib/time';
import type { InboxMessage } from '../../shared/contract';
import { useLive } from '../api/live';
import { SUB_PAGES, TABS, type Tab } from './nav';
import { FloatingAssistant } from '../assistant/FloatingAssistant';
import { InsightIc } from './ui';
import { usePortalAssistant } from '../assistant/portalContext';
import { brand } from '../brand';

export function Brand({ sub }: { sub?: string }) {
  return (
    <span className="brand">
      <span className="brand-mark">{brand.name}</span>
      {sub && <span className="brand-sub">{sub}</span>}
    </span>
  );
}

function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/** "1 hour ago" / "5 dagen geleden", measured on the demo clock for seeded items and the real clock for new ones. */
function timeAgo(iso: string, lang: Lang): string {
  const then = new Date(iso).getTime();
  const now = Math.max(Date.now(), DEMO_NOW.getTime());
  const min = Math.max(0, Math.round((now - then) / 60000));
  const rtf = new Intl.RelativeTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { numeric: 'auto' });
  if (min < 1) return lang === 'nl' ? 'zojuist' : 'just now';
  if (min < 60) return rtf.format(-min, 'minute');
  if (min < 60 * 36) return rtf.format(-Math.round(min / 60), 'hour');
  if (min < 60 * 24 * 45) return rtf.format(-Math.round(min / 1440), 'day');
  return rtf.format(-Math.round(min / 43200), 'month');
}

function Notifications() {
  const { t, tx, lang } = useI18n();
  const navigate = useNavigate();
  const { messages: items, markRead, markAllRead, online } = useLive();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const unread = items.filter((i) => !i.read).length;

  const openItem = (n: InboxMessage) => {
    if (!n.read) markRead(n.id);
    setOpen(false);
    navigate(n.to);
  };

  return (
    <div className="pop-wrap" ref={ref}>
      <button className="icon-btn" aria-label={t(`Notifications, ${unread} unread`, `Meldingen, ${unread} ongelezen`)} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={19} />
        {unread > 0 && <span className="dot" />}
        <span className={`conn-dot${online ? ' on' : ''}`} title={online ? t('Live updates connected', 'Live updates verbonden') : t('Offline', 'Offline')} />
      </button>
      {open && (
        <div className="popover">
          <div className="pop-head">
            <h3>
              {t('Notifications', 'Meldingen')} {unread > 0 && <span className="badge info">{unread}</span>}
            </h3>
            <button className="btn btn-ghost btn-sm" disabled={!unread} onClick={markAllRead}>
              <CheckCheck size={15} /> {t('Mark all read', 'Alles gelezen')}
            </button>
          </div>
          {items.map((n) => (
            <button key={n.id} className={`pop-item${n.read ? '' : ' unread'}`} onClick={() => openItem(n)}>
              <InsightIc icon={n.icon} kind={n.icon === 'moon' ? 'alert' : n.icon === 'wallet' ? 'billing' : undefined} size={34} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="strong small" style={{ display: 'block' }}>
                  {tx(n.title)}
                </span>
                <span className="xs muted" style={{ display: 'block' }}>
                  {tx(n.body)}
                </span>
                <span className="xs muted">
                  {n.sender ? `${n.sender} · ` : ''}
                  {timeAgo(n.createdAt, lang)}
                </span>
              </span>
              {!n.read && <span className="dot" style={{ position: 'static', width: 8, height: 8, borderRadius: 4, background: 'var(--blue)', marginTop: 6 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Customer app shell, a phone app like the Hydro Mobile360 customer app: an app bar (ENGIE on the tabs, a back
 * arrow and title on sub-pages), bottom tabs Home · Energy · Eva · Billing · Profile, and Eva's chat panel.
 * No demo tools here: those live in the staff app.
 */
export function AppShell({ children }: { children?: ReactNode }) {
  const { t, tx } = useI18n();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const { open, setOpen } = usePortalAssistant();
  const sub = SUB_PAGES[pathname];

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  const isActive = (tab: Tab) => (tab.to === '/' ? pathname === '/' : pathname.startsWith(tab.to) || !!tab.also?.some((p) => pathname.startsWith(p)));

  return (
    <div className="app">
      <header className="app-bar">
        {sub ? (
          <>
            <button className="icon-btn" onClick={() => navigate(sub.back)} aria-label={t('Back', 'Terug')}>
              <ChevronLeft size={22} />
            </button>
            <h2 className="app-bar-title">{tx(sub.title)}</h2>
          </>
        ) : (
          <NavLink to="/" className="app-bar-brand" aria-label={`${brand.portal} home`}>
            <Brand sub={brand.portal} />
          </NavLink>
        )}
        <span className="app-bar-actions">
          <Notifications />
          <NavLink to="/account" className="avatar app-avatar" aria-label={t('Profile', 'Profiel')} title={`${customer.firstName} ${customer.lastName}`}>
            {customer.initials}
            <span className="online" />
          </NavLink>
        </span>
      </header>

      <main className="content app-content" key={pathname}>
        <Suspense fallback={<div className="page-loading" aria-busy="true" />}>{children ?? <Outlet />}</Suspense>
      </main>

      <nav className="app-tabs" aria-label={t('Main navigation', 'Hoofdnavigatie')}>
        {TABS.slice(0, 2).map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.to === '/'} className={isActive(tab) ? 'active' : undefined}>
            <tab.icon size={22} />
            <span>{tx(tab.label)}</span>
          </NavLink>
        ))}
        <button className={`app-eva${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? t(`Close ${brand.assistant.name}`, `Sluit ${brand.assistant.name}`) : t(`Ask ${brand.assistant.name}`, `Vraag het ${brand.assistant.name}`)}>
          <span className="app-eva-orb">{open ? <X size={24} /> : <Sparkles size={24} />}</span>
          <span>{brand.assistant.name}</span>
        </button>
        {TABS.slice(2).map((tab) => (
          <NavLink key={tab.to} to={tab.to} className={isActive(tab) ? 'active' : undefined}>
            <tab.icon size={22} />
            <span>{tx(tab.label)}</span>
          </NavLink>
        ))}
      </nav>

      <FloatingAssistant />
    </div>
  );
}
