/**
 * Brand values in one place. Everything the client would supply or rename (name, portal name,
 * assistant name, partner names) lives here; screens read it instead of hard-coding strings.
 */
import type { Text } from './lib/i18n';

export const brand = {
  name: 'ENGIE',
  portal: 'MijnENGIE',
  country: 'Netherlands',
  assistant: { en: 'ENGIE Assistant', nl: 'ENGIE Assistent' } as Text,
  askLabel: { en: 'Ask ENGIE', nl: 'Vraag het ENGIE' } as Text,
  partners: {
    disaggregation: 'Net2Grid',
    networkOperator: 'Stedin',
  },
  /** Shown on every demo surface. */
  demoNotice: {
    en: 'Prototype: sample customer and data. Not connected to ENGIE systems.',
    nl: 'Prototype: voorbeeldklant en -data. Niet gekoppeld aan ENGIE-systemen.',
  } as Text,
} as const;
