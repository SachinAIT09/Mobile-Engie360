import type { Text } from './i18n';
import type { RatePlanId } from './types';
import { DYNAMIC_PRICE } from './usage';

/**
 * Every client-facing name and placeholder lives here. The demo is ENGIE Netherlands-styled; all
 * customer data is fictional and amounts marked [..] are placeholders until ENGIE supplies real values.
 */
export const BRAND = {
  utilityName: 'ENGIE',
  /** Text wordmark used until official logo files are supplied. */
  logoPlaceholder: 'ENGIE',
  /** Company presenting the demo. */
  vendorName: 'PowerConnect.AI',
  /** Customer-facing app name (login heading, settings). */
  appName: 'MijnENGIE',
  staffProductName: 'ENGIE Klantinzicht',
  conceptLabel: 'Concept demo · Sample data',
  conceptLabelNl: 'Conceptdemo · Voorbeelddata',
  customerServicePhone: '[ENGIE klantenservice]',
  website: 'engie.nl',
  /** Partner products named in the UI. Simulated in the demo. */
  partners: {
    disaggregation: 'Net2Grid',
    payments: 'iDEAL',
    networkOperator: 'Stedin',
  },
  /** City used in the seeded demo addresses. */
  demoTown: 'Utrecht',
  /** Centre of the demo area on the staff map (Utrecht-Oost); positions are illustrative. */
  demoMapCenter: { lat: 52.0907, lng: 5.1214 },
} as const;

/** The flex program customers enroll in: smart charging that also answers grid-congestion requests. */
export const PROGRAM = {
  name: { en: 'Slim Laden', nl: 'Slim Laden' } as Text,
  signupIncentive: { en: '[€25 welcome credit]', nl: '[€25 welkomstkorting]' } as Text,
  perEventIncentive: { en: '[€2.50]', nl: '[€2,50]' } as Text,
  maxEventsPerSeason: { en: '[20]', nl: '[20]' } as Text,
  typicalEventHours: { en: '2–3', nl: '2–3' } as Text,
  termsUrl: '#voorwaarden',
  termsSummary: [
    {
      en: 'You let ENGIE use your smart meter data (via Net2Grid) to recognise EV charging and measure flex results.',
      nl: 'Je geeft ENGIE toestemming je slimme-meterdata (via Net2Grid) te gebruiken om laden te herkennen en flexresultaten te meten.',
    },
    {
      en: 'When the grid is busy we may ask you to shift charging for 2–3 hours. Taking part is always your choice.',
      nl: 'Als het stroomnet druk is, vragen we je soms het laden 2–3 uur te verschuiven. Meedoen is altijd jouw keuze.',
    },
    {
      en: 'You get [€25] on sign-up and [€2.50] for each flex moment you join, up to [20] a year.',
      nl: 'Je krijgt [€25] bij aanmelding en [€2,50] per flexmoment waaraan je meedoet, tot [20] per jaar.',
    },
    {
      en: 'You can stop at any time in the app. Credit already earned is kept.',
      nl: 'Je kunt altijd stoppen in de app. Opgebouwde korting houd je.',
    },
  ] as Text[],
} as const;

/** Placeholder average all-in electricity rate (€/kWh) for rough cost estimates. */
export const DEMO_RATE_PER_KWH = 0.25;

/** Scripted assistant naming and copy. */
export const ASSISTANT = {
  staffName: 'Klantinzicht Assistant',
  customerName: { en: 'ENGIE Assistant', nl: 'ENGIE Assistent' } as Text,
  disclosure: 'Scripted demo assistant · answers from live demo data',
  disclosureCustomer: {
    en: 'Demo assistant: scripted answers from sample data, no AI backend connected.',
    nl: 'Demo-assistent: vooraf ingestelde antwoorden op voorbeelddata, geen AI-backend gekoppeld.',
  } as Text,
  placeholderStaff: 'Ask about segments, campaigns, flex events or customers…',
  placeholderCustomer: { en: 'Ask about your bill, usage or charging…', nl: 'Vraag naar je nota, verbruik of laden…' } as Text,
} as const;

/**
 * One rate period rule. Hours are local, `from` inclusive and `to` exclusive (0–24).
 * When `from > to` the rule wraps past midnight (e.g. 23 → 7 means 23:00–07:00).
 * Rules are checked in order; the first rule whose `days` and hours match wins.
 */
export interface RatePeriodRule {
  name: string;
  rate: number;
  days: 'weekday' | 'weekend' | 'all';
  from: number;
  to: number;
}

export interface RatePlanDef {
  label: Text;
  /** Time-based periods. Every hour of every day matches exactly one rule. */
  periods: RatePeriodRule[];
}

const priceName = (p: number) => (p <= 0.2 ? 'goedkoop' : p >= 0.3 ? 'piek' : 'normaal');

/** [Placeholder rates] € / kWh all-in (supply, energy tax, VAT). Not ENGIE's actual prices. */
export const RATE_PLANS: Record<RatePlanId, RatePlanDef> = {
  DYNAMIC: {
    label: { en: 'Dynamic (hourly price)', nl: 'Dynamisch (uurprijs)' },
    periods: DYNAMIC_PRICE.map((rate, h) => ({ name: priceName(rate), rate, days: 'all' as const, from: h, to: h + 1 })),
  },
  DUAL: {
    label: { en: 'Fixed, peak/off-peak', nl: 'Vast, normaal/dal' },
    periods: [
      { name: 'dal', rate: 0.231, days: 'weekend', from: 0, to: 24 },
      { name: 'dal', rate: 0.231, days: 'weekday', from: 23, to: 7 },
      { name: 'normaal', rate: 0.268, days: 'weekday', from: 7, to: 23 },
    ],
  },
  FIXED: {
    label: { en: 'Fixed, single rate', nl: 'Vast, enkeltarief' },
    periods: [{ name: 'vast', rate: 0.259, days: 'all', from: 0, to: 24 }],
  },
};

/** [Placeholder] Dutch grid carbon intensity by local hour 0–23, g CO₂ per kWh (solar at midday, gas at the evening peak). */
export const GRID_CO2_G_PER_KWH: readonly number[] = [
  290, 285, 280, 278, 280, 290, 320, 340, 300, 240, 190, 160, 150, 160, 200, 260, 330, 380, 390, 380, 360, 340, 320, 300,
];

export const SMART_CHARGING = {
  name: { en: 'Slim Laden', nl: 'Slim Laden' } as Text,
  defaultReadyBy: '07:00',
  defaultTargetKwh: 30,
  minTargetKwh: 5,
  maxTargetKwh: 60,
  /** Local hour the planner assumes the car is plugged in. */
  plugInHour: 18,
} as const;
