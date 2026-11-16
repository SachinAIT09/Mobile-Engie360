import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { I18nCtx, type I18n, type Lang } from './i18n';
import { DEMO_TZ } from './time';

function readLang(): Lang {
  try {
    const v = localStorage.getItem('engie-demo-lang');
    if (v === 'en' || v === 'nl') return v;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem('engie-demo-lang', l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<I18n>(() => {
    const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
    return {
      lang,
      setLang,
      locale,
      t: (en, nl) => (lang === 'nl' ? nl : en),
      tx: (text) => text[lang],
      eur: (v, digits = 2) =>
        new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(v),
      num: (v, digits = 0) =>
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(v),
      // Date-only keys ("2026-11-28") are calendar days; instants are shown in Amsterdam time.
      date: (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
        new Intl.DateTimeFormat(locale, { ...opts, timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : DEMO_TZ }).format(new Date(iso)),
    };
  }, [lang, setLang]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

