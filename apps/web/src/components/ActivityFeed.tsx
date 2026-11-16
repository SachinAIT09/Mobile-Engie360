import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { activityLabel, type CustomerActivity } from '@engie/shared';
import { CATEGORY_ICON, useActivity } from '../lib/activity';
import { timeAgo } from '../lib/reports';
import { Icon } from './icons';
import './activity.css';

const PANEL_ROWS = 20;

/** One feed row: icon, who, what, when. Links to the customer's timeline. */
export function ActivityRow({ a, onNavigate, showName = true }: { a: CustomerActivity; onNavigate?: () => void; showName?: boolean }) {
  return (
    <Link to={`/customers/${a.customerId}`} className={`act-row cat-${a.category}`} onClick={onNavigate}>
      <span className="act-ico" aria-hidden="true">
        <Icon name={CATEGORY_ICON[a.category]} size={16} />
      </span>
      <span className="act-body">
        <span className="act-title">
          {showName && <strong>{a.customerName}</strong>}
          {showName ? ' · ' : ''}
          {activityLabel(a.kind)}
        </span>
        <span className="act-sum">{a.summary}</span>
      </span>
      <time className="act-time" dateTime={a.at}>
        {timeAgo(a.at)}
      </time>
    </Link>
  );
}

/**
 * Top-bar bell: unread count of customer app activity plus the live-connection dot. Opens a panel with the
 * latest entries; opening it marks everything seen.
 */
export function ActivityBell({ connDot, connTitle }: { connDot: string; connTitle: string }) {
  const { items, unread, markSeen, muteViewToasts, setMuteViewToasts } = useActivity();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) markSeen();
    setOpen((o) => !o);
  };
  const close = () => setOpen(false);
  const label = unread > 0 ? `Customer activity, ${unread} new` : 'Customer activity';

  return (
    <div className="menu-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="iconbtn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title={`${label} · ${connTitle}`}
        onClick={toggle}
      >
        <Icon name="bell" size={18} />
        {unread > 0 ? (
          <span className="act-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : (
          <span className={`dot ${connDot}`} aria-hidden="true" />
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {connTitle}
      </span>
      {open && (
        <div className="act-panel" id={panelId} role="region" aria-label="Customer activity">
          <div className="act-panel-head">
            <strong>Customer activity</strong>
            <span className={`dot ${connDot}`} aria-hidden="true" title={connTitle} />
            <span className="small muted">from the mobile app, live</span>
          </div>
          {items.length === 0 ? (
            <p className="act-empty">Nothing yet. Actions customers take in the app show up here as they happen.</p>
          ) : (
            <div className="act-list">
              {items.slice(0, PANEL_ROWS).map((a) => (
                <ActivityRow key={a.id} a={a} onNavigate={close} />
              ))}
            </div>
          )}
          <div className="act-panel-foot">
            <label className="act-mute">
              <input type="checkbox" checked={muteViewToasts} onChange={(e) => setMuteViewToasts(e.target.checked)} />
              Mute pop-ups for screen views
            </label>
            <Link to="/activity" onClick={close}>
              View all activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
