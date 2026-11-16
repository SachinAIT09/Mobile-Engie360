import type { Text } from '../lib/i18n';
import { brand } from '../brand';

export type InsightKind = 'alert' | 'saving' | 'tip' | 'billing';
export type InsightIcon = 'ev' | 'trend' | 'plug' | 'flame' | 'sun' | 'wallet' | 'moon' | 'washer';

export interface Insight {
  id: string;
  kind: InsightKind;
  icon: InsightIcon;
  title: Text;
  body: Text;
  /** Estimated yearly saving in €, if any. */
  saving?: number;
  /** Optional deep link inside the portal. */
  to?: string;
  cta?: Text;
  source: 'net2grid' | 'engie';
  detail?: Text;
}

export const insights: Insight[] = [
  {
    id: 'ev-peak',
    kind: 'saving',
    icon: 'ev',
    title: { en: 'Charge your EV at night', nl: 'Laad je auto ’s nachts' },
    body: {
      en: '81% of your EV charging happens between 18:00 and 21:00, the most expensive hours on your dynamic tariff.',
      nl: '81% van het laden van je auto gebeurt tussen 18:00 en 21:00, de duurste uren van je dynamische tarief.',
    },
    detail: {
      en: `${brand.partners.disaggregation} recognised a new EV charging pattern from late August (~3.3 kW sessions, 3–4 times a week). Moving these sessions to 01:00–06:00 lowers your average price per kWh from €0.36 to €0.20.`,
      nl: `${brand.partners.disaggregation} herkent sinds eind augustus een nieuw laadpatroon (~3,3 kW sessies, 3–4 keer per week). Door deze sessies naar 01:00–06:00 te verplaatsen daalt je gemiddelde prijs per kWh van €0,36 naar €0,20.`,
    },
    saving: 142,
    to: '/smart-energy',
    cta: { en: 'Set up smart charging', nl: 'Slim laden instellen' },
    source: 'net2grid',
  },
  {
    id: 'up-12',
    kind: 'alert',
    icon: 'trend',
    title: { en: 'Electricity up 12% vs last month', nl: 'Stroomverbruik 12% hoger dan vorige maand' },
    body: {
      en: 'October used 307 kWh against 274 kWh in September. EV charging explains 26 kWh of the increase; colder days explain most of the rest.',
      nl: 'In oktober verbruikte je 307 kWh tegen 274 kWh in september. Het laden van je auto verklaart 26 kWh van de stijging; de koudere dagen het grootste deel van de rest.',
    },
    to: '/energy',
    cta: { en: 'View consumption', nl: 'Bekijk verbruik' },
    source: 'net2grid',
  },
  {
    id: 'night-anomaly',
    kind: 'alert',
    icon: 'moon',
    title: { en: 'Unusual night-time use on 11 Nov', nl: 'Ongebruikelijk nachtverbruik op 11 nov' },
    body: {
      en: 'Between 01:40 and 04:10 your home used about 1.4 kW, roughly six times your normal night load. Was a heater or dryer left on?',
      nl: 'Tussen 01:40 en 04:10 verbruikte je woning ongeveer 1,4 kW, zo’n zes keer je normale nachtverbruik. Stond er een kachel of droger aan?',
    },
    detail: {
      en: `Detected by ${brand.partners.disaggregation} anomaly detection on your smart-meter data. Total extra use: 3.6 kWh (≈ €0.80).`,
      nl: `Gedetecteerd door ${brand.partners.disaggregation}-afwijkingsdetectie op je slimme-meterdata. Extra verbruik: 3,6 kWh (≈ €0,80).`,
    },
    source: 'net2grid',
  },
  {
    id: 'baseload',
    kind: 'saving',
    icon: 'plug',
    title: { en: 'Your always-on use is above average', nl: 'Je sluipverbruik is hoger dan gemiddeld' },
    body: {
      en: 'Your home never drops below 205 W. Similar homes sit around 150 W. Old fridges, network gear and standby devices are the usual causes.',
      nl: 'Je woning komt nooit onder 205 W. Vergelijkbare woningen zitten rond 150 W. Oude koelkasten, netwerkapparatuur en standby-apparaten zijn de gebruikelijke oorzaak.',
    },
    saving: 96,
    source: 'net2grid',
  },
  {
    id: 'installment',
    kind: 'billing',
    icon: 'wallet',
    title: { en: 'Your installment may be too low', nl: 'Je termijnbedrag is mogelijk te laag' },
    body: {
      en: 'With EV charging added, we expect about €156 to pay at your next annual statement. Raising your installment to €198 spreads that out.',
      nl: 'Door het laden van je auto verwachten we bij je volgende jaarnota zo’n €156 bij te betalen. Met een termijnbedrag van €198 spreid je dat.',
    },
    to: '/billing?adjust=1',
    cta: { en: 'Adjust installment', nl: 'Termijnbedrag aanpassen' },
    source: 'engie',
  },
  {
    id: 'thermostat',
    kind: 'tip',
    icon: 'flame',
    title: { en: 'One degree lower saves 6% gas', nl: 'Eén graad lager scheelt 6% gas' },
    body: {
      en: 'Your heating runs at 20.5 °C in the evening. Setting it to 19.5 °C saves about 62 m³ a year.',
      nl: 'Je verwarming staat ’s avonds op 20,5 °C. Op 19,5 °C bespaar je ongeveer 62 m³ per jaar.',
    },
    saving: 78,
    source: 'engie',
  },
  {
    id: 'laundry',
    kind: 'tip',
    icon: 'washer',
    title: { en: 'Run the washer at 13:00 tomorrow', nl: 'Was morgen om 13:00' },
    body: {
      en: 'Tomorrow’s price dips to €0.17/kWh around midday thanks to solar on the grid, half of the evening price.',
      nl: 'De stroomprijs zakt morgen rond het middaguur naar €0,17/kWh door zonnestroom op het net, de helft van de avondprijs.',
    },
    saving: 24,
    source: 'engie',
  },
  {
    id: 'solar',
    kind: 'saving',
    icon: 'sun',
    title: { en: 'Your roof suits 10 solar panels', nl: 'Je dak is geschikt voor 10 zonnepanelen' },
    body: {
      en: 'About 3,600 kWh a year from a south-west roof. With your EV, you would use much of it yourself, which matters now net metering ends on 1 January 2027.',
      nl: 'Ongeveer 3.600 kWh per jaar van een zuidwest-dak. Met je auto gebruik je veel zelf, en dat telt nu de salderingsregeling op 1 januari 2027 stopt.',
    },
    saving: 610,
    cta: { en: 'Ask Eva', nl: 'Vraag het Eva' },
    to: '/assistant?q=solar',
    source: 'engie',
  },
];

export const totalSavings = insights.reduce((s, i) => s + (i.saving ?? 0), 0);

export interface Notification {
  id: string;
  icon: InsightIcon | 'bell' | 'doc';
  title: Text;
  body: Text;
  time: Text;
  unread: boolean;
  to: string;
}

export const notificationsSeed: Notification[] = [
  {
    id: 'n1',
    icon: 'moon',
    title: { en: 'Unusual night-time consumption', nl: 'Ongebruikelijk nachtverbruik' },
    body: { en: '1.4 kW between 01:40 and 04:10 on 11 Nov.', nl: '1,4 kW tussen 01:40 en 04:10 op 11 nov.' },
    time: { en: '5 days ago', nl: '5 dagen geleden' },
    unread: true,
    to: '/insights#night-anomaly',
  },
  {
    id: 'n2',
    icon: 'ev',
    title: { en: 'Cheapest hours tonight: 02:00–05:00', nl: 'Goedkoopste uren vannacht: 02:00–05:00' },
    body: { en: 'Charge your EV for €0.17/kWh.', nl: 'Laad je auto voor €0,17/kWh.' },
    time: { en: '1 hour ago', nl: '1 uur geleden' },
    unread: true,
    to: '/smart-energy',
  },
  {
    id: 'n3',
    icon: 'wallet',
    title: { en: 'Installment collected on 28 Nov', nl: 'Termijnbedrag wordt 28 nov afgeschreven' },
    body: { en: '€185.00 from NL91 ABNA ••• 1643 00.', nl: '€185,00 van NL91 ABNA ••• 1643 00.' },
    time: { en: '2 days ago', nl: '2 dagen geleden' },
    unread: true,
    to: '/billing',
  },
  {
    id: 'n4',
    icon: 'doc',
    title: { en: 'October installment invoice available', nl: 'Termijnnota oktober beschikbaar' },
    body: { en: 'TN-202610-48283', nl: 'TN-202610-48283' },
    time: { en: '1 month ago', nl: '1 maand geleden' },
    unread: false,
    to: '/billing',
  },
];
