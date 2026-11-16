import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ToastCtx } from './toast';
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
import { brand } from '../brand';

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row wrap">{children}</div>}
    </div>
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

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
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

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
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
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  const push = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, msg }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className="toast">
            <CheckCircle2 size={18} color="#23d2b5" />
            {i.msg}
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

export function N2GBadge() {
  return <span className="n2g">{brand.partners.disaggregation}</span>;
}

export function DemoFlag({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <span className="demo-flag">{children ?? t('Sample data', 'Voorbeelddata')}</span>;
}
