/**
 * Bilingual text and Dutch/English formatting. Plain functions so the API, the staff app and the
 * customer app all format euros, numbers and dates the same way.
 */
export type Lang = 'en' | 'nl';

/** Bilingual text as data: the API sends it so content follows the customer's language switch. */
export interface Text {
  en: string;
  nl: string;
}

export const LANGS: Lang[] = ['nl', 'en'];
export const DEFAULT_LANG: Lang = 'nl';

export const localeOf = (lang: Lang) => (lang === 'nl' ? 'nl-NL' : 'en-GB');

export function tx(text: Text, lang: Lang): string {
  return text[lang];
}

/** Text from two inline strings: t('Welcome', 'Welkom'). */
export function text(en: string, nl: string): Text {
  return { en, nl };
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'nl';
}

/** € 1.234,56 (nl) / €1,234.56 (en). */
export function fmtEur(v: number, lang: Lang, digits = 2): string {
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function fmtNum(v: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(localeOf(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}
