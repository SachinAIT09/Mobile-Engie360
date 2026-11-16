import { BRAND } from './brand';
import type { NotifyPreset } from './types';

export type NotifyGroup = 'Net2Grid' | 'Slim Laden' | 'Account & billing';

export interface NotifyPresetInfo {
  id: NotifyPreset;
  group: NotifyGroup;
  /** Tile title on the demo control panel. */
  label: string;
  /** One line, in plain words, of what the customer sees. */
  detail: string;
  /** Who the preset makes sense for; other customers get the tile disabled with this reason. */
  needs?: 'ENROLLED' | 'NOT_ENROLLED' | 'INSTALLMENT_GAP';
}

/** The "quick send" catalogue: every phone notification the demo can fire with one click. */
export const NOTIFY_PRESETS: NotifyPresetInfo[] = [
  { id: 'EV_DETECTED', group: 'Net2Grid', label: 'New EV detected', detail: `${BRAND.partners.disaggregation} recognises EV charging; the phone opens the Slim Laden pop-up.`, needs: 'NOT_ENROLLED' },
  { id: 'HEAT_PUMP_DETECTED', group: 'Net2Grid', label: 'Heat pump detected', detail: 'A heat pump shows up in the usage; tips for the dynamic contract.' },
  { id: 'NIGHT_USAGE', group: 'Net2Grid', label: 'Night-time usage alert', detail: 'Unusual consumption last night, with a link to the usage screen.' },
  { id: 'CHEAP_HOURS', group: 'Slim Laden', label: 'Cheap hours tomorrow', detail: 'Tomorrow’s cheapest hours on the dynamic price.' },
  { id: 'CHARGING_COMPLETE', group: 'Slim Laden', label: 'Charging complete', detail: 'The car is charged, with the kWh and what it cost.', needs: 'ENROLLED' },
  { id: 'FLEX_REQUEST', group: 'Slim Laden', label: 'Flex request', detail: 'Asks to shift charging out of a busy grid hour; the customer answers on the phone.', needs: 'ENROLLED' },
  { id: 'ENROLL_OFFER', group: 'Slim Laden', label: 'Slim Laden offer', detail: 'Invites the customer to join Slim Laden.', needs: 'NOT_ENROLLED' },
  { id: 'INSTALLMENT_ADVICE', group: 'Account & billing', label: 'Installment advice', detail: 'The monthly installment is below the advice; one tap to adjust it.', needs: 'INSTALLMENT_GAP' },
  { id: 'ANNUAL_STATEMENT', group: 'Account & billing', label: 'Annual statement ready', detail: 'The yearly statement is ready to view.' },
  { id: 'METER_READING', group: 'Account & billing', label: 'Meter reading received', detail: 'Smart-meter reading received; nothing to do.' },
];
