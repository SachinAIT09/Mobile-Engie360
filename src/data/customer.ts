/**
 * Demo customer. Entirely fictional — no real ENGIE customer data is used anywhere.
 * Replace `getCustomer()` with a MijnENGIE API call when a backend is available.
 */
import type { Text } from '../lib/i18n';

export { DEMO_NOW } from '../lib/time';

export const customer = {
  id: 'C-2003418762',
  customerNo: '2003 418 762',
  firstName: 'Sanne',
  lastName: 'de Vries',
  initials: 'SV',
  email: 'sanne.devries@example.nl',
  phone: '+31 6 2345 6789',
  address: { street: 'Lindelaan 24', postcode: '3581 AB', city: 'Utrecht' },
  household: { residents: 3, homeType: { en: 'Terraced house, 1978', nl: 'Tussenwoning, 1978' } as Text, sizeM2: 118 },
  iban: 'NL91 ABNA 0417 1643 00',
  paymentMethod: { en: 'Direct debit', nl: 'Automatische incasso' } as Text,
  collectionDay: 28,
  memberSince: '2019-03-01',
};

export const contract = {
  product: { en: 'Dynamic Electricity & Fixed Gas', nl: 'Dynamische Stroom & Vast Gas' } as Text,
  startDate: '2025-03-01',
  gasFixedUntil: '2027-03-01',
  electricity: {
    type: { en: 'Dynamic (hourly price)', nl: 'Dynamisch (uurprijs)' } as Text,
    origin: { en: 'Dutch green electricity', nl: 'Nederlandse groene stroom' } as Text,
    avgPrice: 0.25, // € / kWh incl. VAT & energy tax, 12-month average
    ean: '871687120054 318 296',
  },
  gas: {
    type: { en: 'Fixed until 1 Mar 2027', nl: 'Vast tot 1 mrt 2027' } as Text,
    price: 1.25, // € / m³ incl. VAT & energy tax
    ean: '871687140022 715 403',
  },
  /** Fixed costs per month: delivery + network − energy tax reduction. */
  fixedPerMonth: 22.8,
  installment: 185,
  advisedInstallment: 198,
  installmentRange: { min: 140, max: 320 },
  estimatedAnnualCost: 2376,
  annualUsage: { electricityKwh: 3195, gasM3: 1038 },
  meter: {
    type: { en: 'Smart meter (DSMR 5.0)', nl: 'Slimme meter (DSMR 5.0)' } as Text,
    lastReading: '2026-11-16T14:00:00+01:00',
    electricityT1: 18412,
    electricityT2: 15268,
    gas: 9381.4,
  },
};

export type Customer = typeof customer;
export type Contract = typeof contract;
