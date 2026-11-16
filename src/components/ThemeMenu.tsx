import { useEffect, useId, useRef, useState } from 'react';
import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useTheme, type ThemePref } from '../lib/theme';

const THEMES: { pref: ThemePref; en: string; nl: string; icon: LucideIcon }[] = [
  { pref: 'dark', en: 'Dark', nl: 'Donker', icon: Moon },
  { pref: 'light', en: 'Light', nl: 'Licht', icon: Sun },
  { pref: 'system', en: 'Match system', nl: 'Volg systeem', icon: Monitor },
];

/** Theme menu: Dark / Light / Match system. Arrow keys move, Escape closes and returns focus to the button. */
export function ThemeMenu() {
  const { t } = useI18n();
  const { pref, setPref } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    items().find((b) => b.getAttribute('aria-checked') === 'true')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
      } else if (e.key === 'Tab') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = THEMES.find((x) => x.pref === pref) ?? THEMES[1]!;
  return (
    <div className="pop-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t('Theme', 'Thema')}: ${t(current.en, current.nl)}`}
        title={t('Theme', 'Thema')}
        onClick={() => setOpen((o) => !o)}
      >
        <Palette size={18} />
      </button>
      {open && (
        <div className="popover narrow theme-menu" role="menu" id={menuId} aria-label={t('Theme', 'Thema')}>
          {THEMES.map((x) => (
            <button
              key={x.pref}
              type="button"
              role="menuitemradio"
              aria-checked={pref === x.pref}
              className="menu-item"
              onClick={() => {
                setPref(x.pref);
                setOpen(false);
                button.current?.focus();
              }}
            >
              <x.icon size={16} />
              <span style={{ flex: 1 }}>{t(x.en, x.nl)}</span>
              {pref === x.pref && <Check size={16} className="tick" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
