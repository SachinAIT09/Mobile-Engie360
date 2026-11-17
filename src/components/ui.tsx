import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastCtx, type Notice } from './toast';
import {
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  CheckCircle2,
  ChevronDown,
  FileText,
  Flame,
  Moon,
  Plug,
  Sun,
  TrendingUp,
  WashingMachine,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { InsightIcon, InsightKind } from '../data/insights';
import { useI18n } from '../lib/i18n';

/**
 * Screen header. In the customer app the description (`sub`) is hidden to save height unless `keepSub` is set
 * (when it carries data, not a description). With `stickyTools` the children (filters) sit in their own bar
 * that stays pinned under the app bar while the screen scrolls.
 */
export function PageHead({ eyebrow, title, sub, keepSub = false, stickyTools = false, children }: { eyebrow?: string; title: string; sub?: string; keepSub?: boolean; stickyTools?: boolean; children?: ReactNode }) {
  return (
    <>
      <div className={`page-head${children && stickyTools ? ' has-tools' : ''}`}>
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {sub && <p className={keepSub ? 'keep' : undefined}>{sub}</p>}
        </div>
        {children && !stickyTools && <div className="row wrap">{children}</div>}
      </div>
      {children && stickyTools && <div className="page-tools">{children}</div>}
    </>
  );
}

export function Card({ title, sub, action, children, className = '', id }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <p>{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Delta({ pct, invert = false, suffix }: { pct: number; invert?: boolean; suffix?: string }) {
  const { num } = useI18n();
  // For usage and cost, "up" is bad. `invert` flips that for metrics where up is good.
  const bad = invert ? pct < 0 : pct > 0;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${bad ? 'up' : 'down'}`}>
      <Icon size={13} />
      {num(Math.abs(pct))}%{suffix ? ` ${suffix}` : ''}
    </span>
  );
}

export function Kpi({ icon: Icon, tone, label, value, unit, foot }: { icon: LucideIcon; tone: 'el' | 'gas' | 'eur' | 'ink' | 'pur'; label: string; value: string; unit?: string; foot?: ReactNode }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <span className={`kpi-ic ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <span className="label">{label}</span>
      <span className="value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {foot && <div className="row wrap small muted">{foot}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label, wide = false }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string; wide?: boolean }) {
  return (
    <div className={`seg${wide ? ' wide' : ''}`} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Expander({ icon, title, meta, children, defaultOpen = false, id }: { icon?: ReactNode; title: ReactNode; meta?: ReactNode; children: ReactNode; defaultOpen?: boolean; id?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`expander${open ? ' open' : ''}`} id={id}>
      <button onClick={() => setOpen(!open)} aria-expanded={open}>
        {icon}
        <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
        {meta}
        <ChevronDown size={18} className="chev" />
      </button>
      {open && <div className="body">{children}</div>}
    </div>
  );
}

/** A dialog. `sheet` slides it up from the bottom of the screen, like a phone's payment sheet. */
export function Modal({ title, onClose, children, footer, sheet = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; sheet?: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !dialog.current) return;
      // Keep Tab inside the dialog while it is open.
      const items = [...dialog.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute('disabled'));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  // Focus moves into the dialog when it opens and back to where it was when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => opener?.focus?.();
  }, []);
  return (
    <div className={`modal-backdrop${sheet ? ' sheet' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${sheet ? ' sheet' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={dialog} tabIndex={-1}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Close', 'Sluiten')}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- toasts */

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<{ id: number; msg: string | Notice }[]>([]);
  const dismiss = useCallback((id: number) => setItems((x) => x.filter((i) => i.id !== id)), []);
  const push = useCallback(
    (msg: string | Notice) => {
      const id = Date.now() + Math.random();
      setItems((x) => [...x, { id, msg }]);
      // A message banner stays long enough to read; a confirmation is gone quickly.
      setTimeout(() => dismiss(id), typeof msg === 'string' ? 3200 : 7000);
    },
    [dismiss],
  );
  const toasts = items.filter((i): i is { id: number; msg: string } => typeof i.msg === 'string');
  const notices = items.filter((i): i is { id: number; msg: Notice } => typeof i.msg !== 'string');
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {/* Incoming messages: a notification banner at the top, as on a phone. */}
      <div className="notices" role="status" aria-live="polite">
        {notices.map(({ id, msg }) => (
          <div key={id} className="toast notice">
            <button
              type="button"
              className="notice-open"
              onClick={() => {
                dismiss(id);
                msg.onOpen?.();
              }}
            >
              {msg.icon ?? <InsightIc icon="bell" size={38} />}
              <span className="notice-text">
                <b>{msg.title}</b>
                {msg.body && <span>{msg.body}</span>}
              </span>
            </button>
            <button type="button" className="notice-close" aria-label={t('Dismiss', 'Sluiten')} onClick={() => dismiss(id)}>
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      {/* Short confirmations, just above the tab bar. */}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((i) => (
          <div key={i.id} className="toast">
            <CheckCircle2 size={18} color="#23d2b5" />
            <span>{i.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------------------------------------------------- insight icons */
const ICONS: Record<InsightIcon | 'bell' | 'doc', LucideIcon> = {
  ev: BatteryCharging,
  trend: TrendingUp,
  plug: Plug,
  flame: Flame,
  sun: Sun,
  wallet: Wallet,
  moon: Moon,
  washer: WashingMachine,
  bell: Bell,
  doc: FileText,
};
const TONE: Record<InsightKind, string> = { alert: 'gas', saving: 'eur', tip: 'el', billing: 'ink' };

export function InsightIc({ icon, kind, size = 38 }: { icon: InsightIcon | 'bell' | 'doc'; kind?: InsightKind; size?: number }) {
  const Icon = ICONS[icon];
  const tone = icon === 'ev' ? 'pur' : kind ? TONE[kind] : 'el';
  return (
    <span className={`kpi-ic ${tone}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}

