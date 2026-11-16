import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANG, fmtDate, fmtEur, fmtNum, fmtRelative, fmtTime, fmtWindow, isLang, type Lang, type Text } from '@engie/shared';
import { api, getCurrentToken } from './config';

const STORAGE_KEY = 'mijnengie-demo-lang';

export interface I18n {
  lang: Lang;
  /** Switch language; saved on the phone and (when signed in) on the account, so messages follow it. */
  setLang: (l: Lang) => void;
  /** Inline bilingual string: t('Welcome', 'Welkom'). */
  t: (en: string, nl: string) => string;
  /** Resolve a Text object from the API. */
  tx: (text: Text | null | undefined) => string;
  /** € 185,00 (nl) / €185.00 (en). */
  eur: (v: number, digits?: number) => string;
  num: (v: number, digits?: number) => string;
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  /** 24-hour time, "17:00". */
  time: (iso: string) => string;
  /** "17:00–20:00" */
  window: (startIso: string, endIso: string) => string;
  /** "09:05" / "Gisteren" / "2 nov" */
  relative: (iso: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(
      (v) => {
        if (isLang(v)) setLangState(v);
      },
      () => undefined,
    );
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => undefined);
    if (getCurrentToken()) api.updateLang({ lang: l }).catch(() => undefined);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (en, nl) => (lang === 'nl' ? nl : en),
      tx: (text) => (text ? text[lang] : ''),
      eur: (v, digits = 2) => fmtEur(v, lang, digits),
      num: (v, digits = 0) => fmtNum(v, lang, digits),
      date: (iso, opts) => fmtDate(iso, opts, lang),
      time: (iso) => fmtTime(iso, lang),
      window: (a, b) => fmtWindow(a, b, lang),
      relative: (iso) => fmtRelative(iso, new Date(), lang),
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
