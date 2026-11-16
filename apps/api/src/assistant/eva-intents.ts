import type { Text } from '@engie/shared';
import type { IntentDef } from './eva-nlu.js';

export type Intent =
  | 'GREETING'
  | 'THANKS'
  | 'USAGE'
  | 'BILL_WHY_HIGH'
  | 'INSTALLMENT'
  | 'SAVE'
  | 'INVOICE'
  | 'SOLAR'
  | 'CONTRACT'
  | 'EV'
  | 'PAYMENT'
  | 'METER'
  | 'OUTAGE'
  | 'MOVING'
  | 'HUMAN'
  | 'PRODUCTS'
  | 'SWITCH'
  | 'GREEN'
  | 'FLEX';

/** Intents that need the signed-in customer's own data; visitors get a sign-in prompt instead. */
export const PERSONAL: readonly Intent[] = ['USAGE', 'BILL_WHY_HIGH', 'INSTALLMENT', 'INVOICE', 'EV', 'PAYMENT', 'METER', 'FLEX'];

/**
 * Weights: a distinctive topic word ≈ 2.5–3, a supporting word ≈ 1–1.5; threshold 2.
 * Ambiguities resolved here (and pinned in nlu.spec.ts):
 * - "automatische incasso" is a payment, never the car ("=auto" is exact, EV has "incasso" as a negative);
 * - "monthly payment" is the installment, "next payment" a payment;
 * - "save with solar" is SOLAR, not SAVE;
 * - "why … bill … higher" beats plain usage or invoice questions.
 */
export const INTENTS: readonly IntentDef<Intent>[] = [
  {
    id: 'FLEX',
    priority: 8,
    groups: [{ words: ['flexmoment', 'flex moment', 'flex request', 'flex event', 'flexverzoek', 'netdrukte', 'net is druk', 'grid is busy', 'grid event', 'congestie', 'congestion', 'slim laden', 'later laden', 'laden verschuiven', 'shift charging', 'pause charging'], weight: 3 }],
  },
  {
    id: 'BILL_WHY_HIGH',
    priority: 8,
    groups: [
      { words: ['why', 'waarom', 'how come', 'hoe komt', 'reason', 'oorzaak', 'explain why'], weight: 1.5 },
      { words: ['higher', 'high', 'more', 'hoger', 'hoog', 'meer', 'duurder', 'expensive', 'increase', 'gestegen', 'stijging', 'went up', 'jumped', 'omhoog'], weight: 1.5 },
      { words: ['bill', 'nota', 'rekening', 'energierekening', 'cost', 'costs', 'kosten', 'usage', 'verbruik', 'consumption'], weight: 1 },
    ],
  },
  {
    id: 'USAGE',
    priority: 5,
    groups: [
      { words: ['usage', '=use', '=used', 'consum', 'verbruik', 'kwh', 'm3', 'how much energy', 'how much electricity', 'how much gas', 'hoeveel energie', 'hoeveel stroom', 'hoeveel gas'], weight: 2.5 },
      { words: ['this month', 'today', 'deze maand', 'vandaag', 'so far', 'tot nu toe', 'month', 'maand', 'week'], weight: 1 },
    ],
    negative: ['solar', 'zonnepanel', 'bespar', 'save', 'reduce'],
  },
  {
    id: 'INSTALLMENT',
    priority: 7,
    groups: [
      { words: ['installment', 'termijn', 'termijnbedrag', 'maandbedrag', 'voorschot', 'monthly payment', 'monthly amount', 'advance payment', 'pay each month', 'per maand betalen'], weight: 3 },
      { words: ['current', 'huidig', 'adjust', 'change', 'aanpassen', 'wijzig', 'raise', 'verhogen', 'too low', 'te laag', 'advice', 'advies'], weight: 1 },
    ],
  },
  {
    id: 'INVOICE',
    priority: 6,
    groups: [
      { words: ['invoice', 'nota', 'factuur', 'statement', 'jaarnota', 'jaarafrekening', 'termijnnota', 'annual statement'], weight: 2.5 },
      { words: ['=bill'], weight: 1.5 },
      { words: ['explain', 'uitleg', 'uitleggen', 'latest', 'laatste', 'what is on', 'wat staat', 'show', 'toon', 'last'], weight: 1 },
    ],
    negative: ['why', 'waarom', 'pay', 'betaal', 'installment', 'termijnbedrag'],
  },
  {
    id: 'SAVE',
    priority: 6,
    groups: [
      { words: ['save', 'saving', 'reduce', 'lower', 'cheaper', 'bespar', 'verlag', 'goedkoper', 'tips', '=tip', 'cut', 'minder'], weight: 2.5 },
      { words: ['cost', 'costs', 'kosten', 'bill', 'rekening', 'electricity', 'stroom', 'energy', 'energie', 'gas'], weight: 1 },
    ],
    negative: ['solar', 'zonnepanel', '=zon', 'panel'],
  },
  {
    id: 'SOLAR',
    priority: 7,
    groups: [
      { words: ['solar', 'zonnepanel', 'zonnepanelen', 'panel', 'panels', '=pv', '=zon', 'zonne energie'], weight: 3 },
      { words: ['save', 'bespar', 'roof', '=dak', 'worth', 'loont', 'cost', 'kost', 'payback', 'terugverdien'], weight: 1 },
    ],
  },
  {
    id: 'PRODUCTS',
    priority: 7,
    groups: [
      { words: ['which contract', 'which energy contract', 'welk contract', 'welk energiecontract', 'suits me', 'suit me', 'past bij', 'options', 'aanbod', 'choose', 'kiezen', 'products', 'producten', 'what do you offer', 'wat bieden'], weight: 3 },
    ],
  },
  {
    id: 'CONTRACT',
    priority: 5,
    groups: [
      { words: ['contract', 'tariff', 'tarief', 'tarieven', '=rate', '=rates', 'dynamic', 'dynamisch', 'fixed', '=vast', 'price', 'prijs', 'product'], weight: 2 },
      { words: ['=my', '=mijn', 'current', 'huidig', 'have', 'heb', 'what', 'wat voor'], weight: 0.5 },
    ],
  },
  {
    id: 'EV',
    priority: 6,
    groups: [
      { words: ['=ev', '=evs', 'electric car', 'elektrische auto', '=car', '=auto', 'charge', 'charging', '=laden', 'opladen', 'laadpaal', 'charger', 'laadsessie'], weight: 2.5 },
      { words: ['when', 'wanneer', 'best time', 'cheapest', 'goedkoopst', 'tonight', 'vannacht', 'should', 'beste'], weight: 1 },
    ],
    negative: ['incasso', 'direct debit', 'charges'],
  },
  {
    id: 'PAYMENT',
    priority: 6,
    groups: [
      { words: ['payment', '=pay', '=paid', 'betaal', 'betaling', 'betalen', 'incasso', 'direct debit', 'afschrijving', 'afgeschreven', '=due', 'collect', 'overdue', 'achterstallig'], weight: 2.5 },
      { words: ['when', 'wanneer', 'next', 'volgende', 'open', 'outstanding', 'openstaand'], weight: 1 },
    ],
  },
  {
    id: 'METER',
    priority: 6,
    groups: [{ words: ['meter', 'meterstand', 'meterstanden', 'reading', 'readings', 'slimme meter', 'smart meter'], weight: 3 }],
  },
  {
    id: 'OUTAGE',
    priority: 7,
    groups: [{ words: ['outage', 'storing', 'power cut', 'no power', 'stroomuitval', 'blackout', 'geen stroom'], weight: 3 }],
  },
  {
    id: 'MOVING',
    priority: 6,
    groups: [{ words: ['moving', '=move', 'verhuis', 'verhuizen', 'new address', 'nieuw adres'], weight: 3 }],
  },
  {
    id: 'HUMAN',
    priority: 7,
    groups: [{ words: ['human', 'agent', 'person', 'medewerker', 'customer service', 'klantenservice', 'call me', 'bellen', 'speak to', 'talk to', 'spreken', 'contact'], weight: 3 }],
  },
  {
    id: 'SWITCH',
    priority: 6,
    groups: [{ words: ['switch', 'overstap', 'overstappen', 'become a customer', 'klant worden', 'sign up'], weight: 3 }],
    patterns: [{ re: /\bstap\b.*\bover\b/, weight: 3 }],
  },
  {
    id: 'GREEN',
    priority: 5,
    groups: [{ words: ['green', 'groen', 'groene', 'sustainab', 'duurzaam', 'renewable', 'wind', '=co2'], weight: 3 }],
  },
  {
    id: 'THANKS',
    priority: 1,
    groups: [{ words: ['thanks', 'thank', 'bedankt', '=dank', 'cheers'], weight: 3 }],
  },
  {
    id: 'GREETING',
    priority: 0,
    groups: [],
    patterns: [{ re: /^(hi|hello|hey|hoi|hallo|goedemorgen|goedemiddag|goedenavond|good (morning|afternoon|evening))\b/, weight: 2.5 }],
  },
];

/** One phrasing per intent, used for chips and follow-ups; every one must round-trip to its intent (spec). */
export const PHRASES: Record<Exclude<Intent, 'GREETING' | 'THANKS'>, Text> = {
  USAGE: { en: 'How much energy did I consume this month?', nl: 'Hoeveel energie heb ik deze maand verbruikt?' },
  BILL_WHY_HIGH: { en: 'Why is my energy bill higher this month?', nl: 'Waarom is mijn energierekening hoger deze maand?' },
  INSTALLMENT: { en: 'What is my current monthly installment?', nl: 'Wat is mijn huidige termijnbedrag?' },
  SAVE: { en: 'How can I reduce my electricity costs?', nl: 'Hoe kan ik mijn stroomkosten verlagen?' },
  INVOICE: { en: 'Can you explain my latest invoice?', nl: 'Kun je mijn laatste nota uitleggen?' },
  SOLAR: { en: 'How much could I save with solar panels?', nl: 'Hoeveel kan ik besparen met zonnepanelen?' },
  CONTRACT: { en: 'What contract do I have?', nl: 'Wat voor contract heb ik?' },
  EV: { en: 'When should I charge my EV?', nl: 'Wanneer kan ik mijn auto het best laden?' },
  PAYMENT: { en: 'When is my next payment?', nl: 'Wanneer is mijn volgende betaling?' },
  METER: { en: 'Do I need to submit meter readings?', nl: 'Moet ik meterstanden doorgeven?' },
  OUTAGE: { en: 'Is there a power outage?', nl: 'Is er een storing?' },
  MOVING: { en: 'I am moving house', nl: 'Ik ga verhuizen' },
  HUMAN: { en: 'I want to speak to customer service', nl: 'Ik wil de klantenservice spreken' },
  PRODUCTS: { en: 'Which energy contract suits me?', nl: 'Welk energiecontract past bij mij?' },
  SWITCH: { en: 'How do I switch to ENGIE?', nl: 'Hoe stap ik over naar ENGIE?' },
  GREEN: { en: 'Is your electricity green?', nl: 'Is jullie stroom groen?' },
  FLEX: { en: 'Is there a flex moment today?', nl: 'Is er vandaag een flexmoment?' },
};

/** Suggested questions per portal page (customer) and for the public website (visitor). */
export const SUGGESTIONS: Record<string, (keyof typeof PHRASES)[]> = {
  default: ['USAGE', 'BILL_WHY_HIGH', 'INSTALLMENT', 'SAVE', 'INVOICE', 'SOLAR'],
  '/billing': ['INVOICE', 'INSTALLMENT', 'PAYMENT', 'BILL_WHY_HIGH'],
  '/usage': ['USAGE', 'BILL_WHY_HIGH', 'SAVE'],
  '/smart-charging': ['EV', 'FLEX', 'SAVE'],
  '/insights': ['SAVE', 'SOLAR', 'BILL_WHY_HIGH'],
  '/profile': ['CONTRACT', 'METER', 'MOVING'],
  visitor: ['PRODUCTS', 'SWITCH', 'BILL_WHY_HIGH', 'GREEN'],
};
