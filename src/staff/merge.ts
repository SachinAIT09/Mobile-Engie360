import type { StaffOverview } from '../../shared/contract';
import type { Lang, Text } from '../lib/i18n';

/** Merge fields for staff messages: typed as {tokens}, filled in with this customer's data on send. */
export interface MergeField {
  token: string;
  label: Text;
  value: (o: StaffOverview, lang: Lang) => string;
}

const eur = (v: number, lang: Lang) => new Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

export const MERGE_FIELDS: MergeField[] = [
  { token: '{first_name}', label: { en: 'First name', nl: 'Voornaam' }, value: (o) => o.customer.firstName },
  { token: '{installment}', label: { en: 'Installment', nl: 'Termijnbedrag' }, value: (o, lang) => eur(o.installment.pending?.amount ?? o.installment.current, lang) },
  { token: '{advised_installment}', label: { en: 'Advised installment', nl: 'Geadviseerd bedrag' }, value: (o, lang) => eur(o.installment.advised, lang) },
  { token: '{annual_statement}', label: { en: 'Expected annual statement', nl: 'Verwachte jaarnota' }, value: (o, lang) => eur(Math.abs(o.kpis.expectedSettlement), lang) },
  { token: '{cheapest_hours}', label: { en: 'Cheapest hours tonight', nl: 'Goedkoopste uren vannacht' }, value: () => '02:00–05:00' },
];

/** Replace every known {token}; unknown ones are left as typed. */
export function fillMerge(text: string, o: StaffOverview | null, lang: Lang): string {
  if (!o) return text;
  return MERGE_FIELDS.reduce((s, f) => s.split(f.token).join(f.value(o, lang)), text);
}
