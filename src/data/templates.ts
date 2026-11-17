/** Ready-made staff messages (the composer's templates and the demo panel's send-to-phone cards). */
import type { MessageTemplate } from '../../shared/contract';
import type { Text } from '../lib/i18n';
import { brand } from '../brand';

const T = (en: string, nl: string): Text => ({ en, nl });

export const TEMPLATES: MessageTemplate[] = [
  {
    id: 'cheap-hours',
    icon: 'ev',
    title: T('Cheapest hours tonight: 02:00–05:00', 'Goedkoopste uren vannacht: 02:00–05:00'),
    body: T('Charge your car tonight for €0.17/kWh. Smart charging can do it for you.', 'Laad je auto vannacht voor €0,17/kWh. Slim laden regelt het voor je.'),
    to: '/smart-energy',
  },
  {
    id: 'installment',
    icon: 'wallet',
    title: T('Advice: raise your installment to €198', 'Advies: verhoog je termijnbedrag naar €198'),
    body: T('Since EV charging started, €198 a month avoids a bill of about €156 in March.', 'Sinds je je auto laadt, voorkom je met €198 per maand een nabetaling van zo’n €156 in maart.'),
    to: '/billing?adjust=1',
  },
  {
    id: 'night-use',
    icon: 'moon',
    title: T('Did something stay on last night?', 'Bleef er vannacht iets aan staan?'),
    body: T('We saw 1.4 kW between 01:40 and 04:10, six times your normal night use.', 'We zagen 1,4 kW tussen 01:40 en 04:10, zes keer je normale nachtverbruik.'),
    to: '/insights#night-anomaly',
  },
  {
    id: 'invoice',
    icon: 'doc',
    title: T('Your November installment invoice is ready', 'Je termijnnota van november staat klaar'),
    body: T('€185.00, collected on 28 November.', '€185,00, afgeschreven op 28 november.'),
    to: '/billing#invoices',
  },
  {
    id: 'solar',
    icon: 'sun',
    title: T('Your roof fits 10 solar panels', 'Je dak is geschikt voor 10 zonnepanelen'),
    body: T(`About €610 a year. Ask ${brand.assistant.name} what it means for you.`, `Zo’n €610 per jaar. Vraag ${brand.assistant.name} wat het voor jou betekent.`),
    to: '/assistant?q=solar',
  },
];
