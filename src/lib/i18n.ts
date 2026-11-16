import { createContext, useContext } from 'react';

export type Lang = 'en' | 'nl';

/** Bilingual text as data: used by the mock data layer so content follows the language switch. */
export type Text = { en: string; nl: string };

export interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Inline bilingual string: t('Welcome', 'Welkom'). */
  t: (en: string, nl: string) => string;
  /** Resolve a Text object. */
  tx: (text: Text) => string;
  eur: (v: number, digits?: number) => string;
  num: (v: number, digits?: number) => string;
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  locale: string;
}

export const I18nCtx = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const v = useContext(I18nCtx);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}
