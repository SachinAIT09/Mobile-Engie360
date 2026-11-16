import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  LogOut,
  Menu,
  Settings,
  User,
  CheckCheck,
  Moon,
  Sun,
  HelpCircle,
} from 'lucide-react';
import { useI18n, type Lang } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { customer } from '../data/customer';
import { DEMO_NOW } from '../lib/time';
import type { InboxMessage } from '../../shared/contract';
import { useLive } from '../api/live';
import { DEMO_NAV, NAV, type NavItem } from './nav';
import { FloatingAssistant } from '../assistant/FloatingAssistant';
import { InsightIc } from './ui';
import { useToast } from './toast';
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

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const opts: Lang[] = ['nl', 'en'];
  return (
    <div className="lang" role="group" aria-label="Language / Taal">
      {opts.map((l) => (
        <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ThemeSwitch() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t('Switch to light theme', 'Licht thema') : t('Switch to dark theme', 'Donker thema')} title={dark ? t('Light theme', 'Licht thema') : t('Dark theme', 'Donker thema')}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
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
  const { messages: items, markRead, markAllRead } = useLive();
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

function ProfileMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };
  return (
    <div className="pop-wrap" ref={ref}>
      <button className="profile-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('Profile menu', 'Profielmenu')}>
        <span className="avatar">{customer.initials}</span>
        <span className="who">
          <b>
            {customer.firstName} {customer.lastName}
          </b>
          <span>
            {t('Customer no.', 'Klantnr.')} {customer.customerNo}
          </span>
        </span>
      </button>
      {open && (
        <div className="popover narrow">
          <div className="pop-head" style={{ justifyContent: 'flex-start', gap: 12 }}>
            <span className="avatar">{customer.initials}</span>
            <div>
              <div className="strong">
                {customer.firstName} {customer.lastName}
              </div>
              <div className="xs muted">{customer.email}</div>
            </div>
          </div>
          <button className="menu-item" onClick={() => go('/account')}>
            <User size={17} /> {t('My account', 'Mijn account')}
          </button>
          <button className="menu-item" onClick={() => go('/account#preferences')}>
            <Settings size={17} /> {t('Preferences', 'Voorkeuren')}
          </button>
          <button className="menu-item" onClick={() => go('/assistant')}>
            <HelpCircle size={17} /> {t('Help & support', 'Hulp & contact')}
          </button>
          <button
            className="menu-item"
            style={{ borderTop: '1px solid var(--line-2)' }}
            onClick={() => {
              setOpen(false);
              toast(t('Demo: sign-out is disabled', 'Demo: uitloggen is uitgeschakeld'));
            }}
          >
            <LogOut size={17} /> {t('Sign out', 'Uitloggen')}
          </button>
        </div>
      )}
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n();
  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={onNavigate}>
      <n.icon size={19} />
      {t(n.en, n.nl)}
      {n.tag && <span className="tag">{n.tag}</span>}
    </NavLink>
  );
  return (
    <>
      <nav className="nav" aria-label={t('Main', 'Hoofdmenu')}>
        {NAV.map(link)}
        <div className="nav-label">{t('Demo', 'Demo')}</div>
        {DEMO_NAV.map(link)}
      </nav>
      <div className="sidebar-foot">
        <strong>{t('Prototype', 'Prototype')}</strong>
        <span className="muted">{t(`Sample customer and data. Not connected to ${brand.name} systems.`, `Voorbeeldklant en -data. Niet gekoppeld aan ${brand.name}-systemen.`)}</span>
      </div>
    </>
  );
}

const MOBILE_TABS: (NavItem & { short: [string, string] })[] = [
  { ...(NAV[0] as NavItem), short: ['Home', 'Home'] },
  { ...(NAV[1] as NavItem), short: ['Usage', 'Verbruik'] },
  { ...(NAV[2] as NavItem), short: ['Bills', 'Nota’s'] },
  { ...(NAV[3] as NavItem), short: ['Insights', 'Inzichten'] },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const { pathname, hash } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const current = [...NAV, ...DEMO_NAV].find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  return (
    <div className="shell">
      <aside className={`sidebar${drawer ? ' open' : ''}`}>
        <NavLink to="/" onClick={() => setDrawer(false)} aria-label={`${brand.portal} home`}>
          <Brand sub={brand.portal} />
        </NavLink>
        <SideNav onNavigate={() => setDrawer(false)} />
      </aside>
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(false)} />}

      <div className="main">
        <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
          <span className="mobile-brand row">
            <button className="icon-btn" onClick={() => setDrawer(true)} aria-label={t('Open menu', 'Open menu')}>
              <Menu size={20} />
            </button>
            <Brand />
          </span>
          <span className="crumb">{current ? t(current.en, current.nl) : ''}</span>
          <span className="spacer" />
          <LangSwitch />
          <span className="hide-m">
            <ThemeSwitch />
          </span>
          <Notifications />
          <ProfileMenu />
        </header>
        <main className="content" key={pathname}>
          <Suspense fallback={<div className="page-loading" aria-busy="true" />}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>

      <nav className="tabbar" aria-label={t('Mobile navigation', 'Mobiele navigatie')}>
        {MOBILE_TABS.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <n.icon size={21} />
            {t(n.short[0], n.short[1])}
          </NavLink>
        ))}
        <button onClick={() => setDrawer(true)}>
          <Menu size={21} />
          {t('More', 'Meer')}
        </button>
      </nav>

      <FloatingAssistant />
    </div>
  );
}
