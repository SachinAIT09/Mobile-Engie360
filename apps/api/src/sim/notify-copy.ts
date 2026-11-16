import { PROGRAM, type Lang, type MessageCategory, type MessageKind, type NotifyPreset } from '@engie/shared';

/** A plain in-app notification (no campaign, no flex event behind it). */
export interface NotifyCopy {
  kind: MessageKind;
  category: MessageCategory;
  tag: string;
  title: string;
  body: string;
  cta: string | null;
  route?: string;
}

export interface NotifyContext {
  firstName: string;
  /** e.g. "17:00–20:00" */
  peakWindow: string;
  /** e.g. "06:04" */
  clock: string;
  lang: Lang;
}

type Copy = { title: string; body: string; cta: string };

/** The Net2Grid "EV detected" pop-up message (Flow A). */
export const EV_DETECTED_COPY: Record<Lang, Copy & { tag: string }> = {
  nl: {
    tag: 'Slim Laden',
    title: 'We zien dat je thuis een auto laadt',
    body: `Laad automatisch op de goedkoopste uren met ${PROGRAM.name.nl} en ontvang ${PROGRAM.signupIncentive.nl}. Tik voor meer informatie.`,
    cta: 'Bekijk Slim Laden',
  },
  en: {
    tag: 'Slim Laden',
    title: 'We noticed an EV charging at your home',
    body: `Charge at the cheapest hours automatically with ${PROGRAM.name.en} and get ${PROGRAM.signupIncentive.en}. Tap to learn more.`,
    cta: 'See Slim Laden',
  },
};

/** Campaign copy (merge fields are filled in by the campaign send) for the presets that go through Campaign 360. */
export const CAMPAIGN_COPY: Record<'FLEX_REQUEST' | 'ENROLL_OFFER' | 'INSTALLMENT_ADVICE', Record<Lang, Copy>> = {
  FLEX_REQUEST: {
    nl: {
      title: 'Wil je vandaag {event_window} later laden?',
      body: 'Hoi {first_name}, het stroomnet in jouw buurt is vanavond erg druk. Verschuif het laden van je auto buiten {event_window} en ontvang {incentive}. Lukt het niet? Meld je af in de app.',
      cta: 'Reageer',
    },
    en: {
      title: 'Can you charge later than {event_window} today?',
      body: 'Hi {first_name}, the grid in your neighbourhood is very busy this evening. Shift your EV charging outside {event_window} and get {incentive}. Can’t take part? Opt out in the app.',
      cta: 'Respond',
    },
  },
  ENROLL_OFFER: {
    nl: {
      title: `Laad slimmer en goedkoper met ${PROGRAM.name.nl}`,
      body: `Hoi {first_name}, {neighbours_enrolled} buren met een elektrische auto doen al mee aan ${PROGRAM.name.nl}. Meld je vandaag aan en ontvang {incentive}. Je kunt je voor elk flexmoment afmelden.`,
      cta: 'Aanmelden in 1 minuut',
    },
    en: {
      title: `Charge smarter and cheaper with ${PROGRAM.name.en}`,
      body: `Hi {first_name}, {neighbours_enrolled} EV owners near you have already joined ${PROGRAM.name.en}. Join today and get {incentive}. You can opt out of any flex moment.`,
      cta: 'Join in 1 minute',
    },
  },
  INSTALLMENT_ADVICE: {
    nl: {
      title: 'Je termijnbedrag past niet meer bij je verbruik',
      body: 'Hoi {first_name}, je betaalt nu {installment} per maand. Op basis van je verbruik adviseren we {advised_installment}. Zo voorkom je bijbetalen bij je jaarnota.',
      cta: 'Termijnbedrag aanpassen',
    },
    en: {
      title: 'Your installment no longer matches your usage',
      body: 'Hi {first_name}, you now pay {installment} a month. Based on your usage we advise {advised_installment}. That avoids a bill at your annual statement.',
      cta: 'Adjust installment',
    },
  },
};

type PlainPreset = Exclude<NotifyPreset, 'EV_DETECTED' | 'FLEX_REQUEST' | 'ENROLL_OFFER' | 'INSTALLMENT_ADVICE'>;

export function isPlainPreset(p: NotifyPreset): p is PlainPreset {
  return p !== 'EV_DETECTED' && p !== 'FLEX_REQUEST' && p !== 'ENROLL_OFFER' && p !== 'INSTALLMENT_ADVICE';
}

export function notifyCopy(preset: PlainPreset, c: NotifyContext): NotifyCopy {
  const nl = c.lang === 'nl';
  switch (preset) {
    case 'HEAT_PUMP_DETECTED':
      return {
        kind: 'HEAT_PUMP_DETECTED', category: 'Alerts', tag: nl ? 'Warmtepomp' : 'Heat pump',
        title: nl ? 'We herkennen een warmtepomp in je verbruik' : 'We recognise a heat pump in your usage',
        body: nl
          ? `Hoi ${c.firstName}, Net2Grid ziet sinds kort een warmtepomp in je slimme-meterdata. Bekijk je inzichten voor tips om goedkoper te verwarmen.`
          : `Hi ${c.firstName}, Net2Grid recently spotted a heat pump in your smart-meter data. See your insights for tips to heat for less.`,
        cta: nl ? 'Bekijk inzichten' : 'View insights',
        route: '/insights',
      };
    case 'NIGHT_USAGE':
      return {
        kind: 'USAGE', category: 'Alerts', tag: nl ? 'Verbruik' : 'Usage',
        title: nl ? 'Ongebruikelijk nachtverbruik' : 'Unusual night-time consumption',
        body: nl
          ? 'Vannacht tussen 01:40 en 04:10 verbruikte je woning ongeveer 1,4 kW, zo’n zes keer meer dan normaal. Stond er iets aan?'
          : 'Last night between 01:40 and 04:10 your home used about 1.4 kW, roughly six times the normal load. Was something left on?',
        cta: nl ? 'Bekijk verbruik' : 'View usage',
        route: '/usage',
      };
    case 'CHEAP_HOURS':
      return {
        kind: 'PRICE', category: 'Alerts', tag: nl ? 'Uurprijs' : 'Hourly price',
        title: nl ? 'Goedkoopste uren morgen: 12:00–15:00' : 'Cheapest hours tomorrow: 12:00–15:00',
        body: nl
          ? `Stroom kost morgen rond het middaguur € 0,17 per kWh. Tussen ${c.peakWindow} is het het duurst. Plan de was of het laden slim in.`
          : `Electricity costs €0.17 per kWh around midday tomorrow. It is most expensive between ${c.peakWindow}. Plan laundry or charging around it.`,
        cta: null,
      };
    case 'CHARGING_COMPLETE':
      return {
        kind: 'CHARGING', category: 'Alerts', tag: 'Slim Laden',
        title: nl ? 'Je auto is opgeladen' : 'Your EV is charged',
        body: nl
          ? `Klaar om ${c.clock}. Deze sessie: 30 kWh voor € 5,70, € 4,10 goedkoper dan direct laden.`
          : `Finished at ${c.clock}. This session: 30 kWh for €5.70, €4.10 less than charging straight away.`,
        cta: null,
        route: '/smart-charging',
      };
    case 'ANNUAL_STATEMENT':
      return {
        kind: 'BILL', category: 'Billing', tag: nl ? 'Jaarnota' : 'Annual statement',
        title: nl ? 'Je jaarnota staat klaar' : 'Your annual statement is ready',
        body: nl
          ? `Hoi ${c.firstName}, je jaarnota staat klaar in de app. Bekijk wat je hebt verbruikt en of je termijnbedrag nog past.`
          : `Hi ${c.firstName}, your annual statement is ready in the app. See what you used and whether your installment still fits.`,
        cta: nl ? 'Bekijk nota' : 'View statement',
        route: '/billing',
      };
    case 'METER_READING':
      return {
        kind: 'METER', category: 'Alerts', tag: nl ? 'Meterstand' : 'Meter reading',
        title: nl ? 'Meterstanden ontvangen' : 'Meter readings received',
        body: nl ? 'Je slimme meter heeft je meterstanden doorgegeven. Je hoeft niets te doen.' : 'Your smart meter sent in your readings. There is nothing you need to do.',
        cta: null,
        route: '/usage',
      };
  }
}
