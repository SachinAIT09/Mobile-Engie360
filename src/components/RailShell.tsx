import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Search, X, type LucideIcon } from 'lucide-react';
import { useI18n } from '../lib/i18n';

/** One entry in the rail: an in-app route (`to`), a full-page link (`href`) or an action (`onClick`). */
export interface RailItem {
  key: string;
  icon: LucideIcon;
  label: string;
  to?: string;
  end?: boolean;
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
  /** Highlight for href/onClick items (route items use NavLink's own active state). */
  active?: boolean;
  tag?: string;
}

interface Props {
  logo: ReactNode;
  logoTo: string;
  logoLabel: string;
  /** "Ask Eva…" entry at the top of the rail. */
  ask?: { label: string; to: string };
  sections: RailItem[];
  demo?: RailItem[];
  /** Right side of the top bar (language, theme, bell, avatar…). */
  actions: ReactNode;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  children: ReactNode;
  /** Rendered after the body (mobile tab bar, floating chat…). */
  after?: ReactNode;
}

function RailEntry({ item, onNavigate }: { item: RailItem; onNavigate: () => void }) {
  const body = (
    <>
      <item.icon size={20} />
      <span className="rs-lbl">{item.label}</span>
      {item.tag && <span className="rs-tag rs-lbl">{item.tag}</span>}
    </>
  );
  if (item.to) {
    return (
      <NavLink to={item.to} end={item.end} aria-label={item.label} onClick={onNavigate}>
        {body}
      </NavLink>
    );
  }
  if (item.href) {
    return (
      <a href={item.href} aria-label={item.label} className={item.active ? 'active' : undefined} aria-current={item.active ? 'location' : undefined} target={item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noreferrer' : undefined} onClick={onNavigate}>
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      aria-label={item.label}
      onClick={() => {
        item.onClick?.();
        onNavigate();
      }}
    >
      {body}
    </button>
  );
}

/**
 * Hydro-style app shell: a full-width top bar and a 72 px icon rail that widens on hover or keyboard
 * focus to show the section names (content shifts over beside it, never under it). On phones the rail is an
 * off-canvas drawer opened from the menu button in the top bar.
 */
export function RailShell({ logo, logoTo, logoLabel, ask, sections, demo, actions, navOpen, setNavOpen, children, after }: Props) {
  const { t } = useI18n();
  const close = () => setNavOpen(false);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);

  return (
    <div className={`rs${navOpen ? ' nav-open' : ''}`}>
      <a className="skip-link" href="#main-content">
        {t('Skip to content', 'Naar de inhoud')}
      </a>
      <header className="rs-top">
        <button
          type="button"
          className="icon-btn rs-toggle"
          aria-label={navOpen ? t('Close navigation', 'Sluit navigatie') : t('Open navigation', 'Open navigatie')}
          aria-expanded={navOpen}
          aria-controls="app-rail"
          onClick={() => setNavOpen(!navOpen)}
        >
          {navOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link to={logoTo} className="rs-logo" aria-label={logoLabel} onClick={close}>
          {logo}
        </Link>
        <div className="rs-actions">{actions}</div>
      </header>
      <div className="rs-body">
        <div className="rs-slot">
          <aside className="rs-rail" id="app-rail">
            {ask && (
              <Link to={ask.to} className="rs-ask" aria-label={ask.label} title={ask.label} onClick={close}>
                <Search size={18} />
                <span className="rs-lbl">{ask.label}</span>
              </Link>
            )}
            <nav className="rs-nav" aria-label={t('Sections', 'Onderdelen')}>
              {sections.map((s) => (
                <RailEntry key={s.key} item={s} onNavigate={close} />
              ))}
            </nav>
            {demo && demo.length > 0 && (
              <>
                <div className="rs-divider" />
                <nav className="rs-nav" aria-label={t('Demo', 'Demo')}>
                  {demo.map((s) => (
                    <RailEntry key={s.key} item={s} onNavigate={close} />
                  ))}
                </nav>
              </>
            )}
          </aside>
        </div>
        {navOpen && <div className="rs-scrim" aria-hidden="true" onClick={close} />}
        <div className="rs-main" id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
      {after}
    </div>
  );
}
