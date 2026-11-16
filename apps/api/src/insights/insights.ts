/**
 * Personal insights: Net2Grid findings on the smart-meter data and ENGIE advice. Pure, so the API,
 * the Home summary and the assistant all show the same numbers.
 */
import {
  BRAND,
  DYNAMIC_PRICE,
  baseloadW,
  dailyUsage,
  fmtEur,
  fmtNum,
  lastMonthSummary,
  monthlyUsage,
  type EvStatus,
  type Insight,
  type UsageProfile,
} from '@engie/shared';
import type { CustomerDoc } from '../db/schemas.js';

export interface InsightInput {
  c: Pick<CustomerDoc, 'contract' | 'hasSolar' | 'hasHeatPump' | 'evSince'>;
  profile: UsageProfile;
  evStatus: EvStatus;
  /** Expected settlement at the annual statement with the current installment (+ = to pay). */
  expectedSettlement: number;
  now: Date;
}

const eur = (v: number, d = 0) => ({ en: fmtEur(v, 'en', d), nl: fmtEur(v, 'nl', d) });

export function buildInsights({ c, profile, evStatus, expectedSettlement, now }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const dynamic = c.contract.product === 'DYNAMIC' || c.contract.product === 'DYNAMIC_FIXED_GAS';
  const last = lastMonthSummary(profile, now);
  const months = monthlyUsage(profile, now);
  const evMonth = (months[11]?.ev ?? 0) - (months[10]?.ev ?? 0);
  const p = DYNAMIC_PRICE;
  const peakAvg = ((p[18] as number) + (p[19] as number) + (p[20] as number)) / 3;
  const nightAvg = ((p[2] as number) + (p[3] as number) + (p[4] as number) + (p[5] as number)) / 4;

  if (evStatus === 'DETECTED_NOT_ENROLLED') {
    out.push({
      id: 'slim-laden',
      kind: 'saving',
      icon: 'car',
      title: { en: 'We see an EV charging at your home', nl: 'We zien dat je thuis een auto laadt' },
      body: {
        en: `${BRAND.partners.disaggregation} recognises EV charging sessions at your address. With Slim Laden your car charges at the cheapest hours automatically.`,
        nl: `${BRAND.partners.disaggregation} herkent laadsessies op je adres. Met Slim Laden laadt je auto vanzelf op de goedkoopste uren.`,
      },
      saving: 142,
      route: '/program',
      cta: { en: 'Discover Slim Laden', nl: 'Ontdek Slim Laden' },
      source: 'net2grid',
      detail: null,
    });
  }
  if (evStatus !== 'NONE' && c.evSince) {
    out.push({
      id: 'ev-peak',
      kind: 'saving',
      icon: 'car',
      title: { en: 'Charge your EV at night', nl: 'Laad je auto ’s nachts' },
      body: {
        en: `81% of your EV charging happens between 18:00 and 21:00, the most expensive hours${dynamic ? ' on your dynamic tariff' : ''}.`,
        nl: `81% van het laden van je auto gebeurt tussen 18:00 en 21:00, de duurste uren${dynamic ? ' van je dynamische tarief' : ''}.`,
      },
      detail: {
        en: `${BRAND.partners.disaggregation} recognised EV charging (~3.7 kW sessions, 3–4 times a week). Moving them to 01:00–06:00 lowers the price per kWh from ${eur(peakAvg, 2).en} to ${eur(nightAvg, 2).en}.`,
        nl: `${BRAND.partners.disaggregation} herkent laadsessies (~3,7 kW, 3–4 keer per week). Door ze naar 01:00–06:00 te verplaatsen daalt de prijs per kWh van ${eur(peakAvg, 2).nl} naar ${eur(nightAvg, 2).nl}.`,
      },
      saving: 142,
      route: '/smart-charging',
      cta: { en: 'Set up smart charging', nl: 'Slim laden instellen' },
      source: 'net2grid',
    });
  }
  if (Math.abs(last.elecVsPrevMonthPct) >= 5) {
    const up = last.elecVsPrevMonthPct > 0;
    const prev = months[10]?.electricity ?? 0;
    out.push({
      id: 'elec-change',
      kind: 'alert',
      icon: 'zap',
      title: up
        ? { en: `Electricity up ${last.elecVsPrevMonthPct}% vs last month`, nl: `Stroomverbruik ${last.elecVsPrevMonthPct}% hoger dan vorige maand` }
        : { en: `Electricity down ${-last.elecVsPrevMonthPct}% vs last month`, nl: `Stroomverbruik ${-last.elecVsPrevMonthPct}% lager dan vorige maand` },
      body: {
        en: `${last.label.en} used ${last.electricity} kWh against ${prev} kWh the month before.${up && evMonth > 0 ? ` EV charging explains ${evMonth} kWh of the increase; colder days explain most of the rest.` : up ? ' Colder, darker days explain most of it.' : ''}`,
        nl: `In ${last.label.nl} verbruikte je ${last.electricity} kWh tegen ${prev} kWh de maand ervoor.${up && evMonth > 0 ? ` Het laden van je auto verklaart ${evMonth} kWh van de stijging; de koudere dagen het grootste deel van de rest.` : up ? ' De koudere, donkere dagen verklaren het grootste deel.' : ''}`,
      },
      saving: null,
      route: '/usage',
      cta: { en: 'View usage', nl: 'Bekijk verbruik' },
      source: 'net2grid',
      detail: null,
    });
  }
  const days = dailyUsage(profile, now);
  const anomaly = days[24];
  if (anomaly) {
    out.push({
      id: 'night-anomaly',
      kind: 'alert',
      icon: 'moon',
      title: { en: `Unusual night-time use on ${anomaly.label.en.slice(4)}`, nl: `Ongebruikelijk nachtverbruik op ${anomaly.label.nl.slice(3)}` },
      body: {
        en: 'Between 01:40 and 04:10 your home used about 1.4 kW, roughly six times your normal night load. Was a heater or dryer left on?',
        nl: 'Tussen 01:40 en 04:10 verbruikte je woning ongeveer 1,4 kW, zo’n zes keer je normale nachtverbruik. Stond er een kachel of droger aan?',
      },
      detail: {
        en: `Detected by ${BRAND.partners.disaggregation} anomaly detection on your smart-meter data. Extra use: 3.6 kWh (≈ ${eur(3.6 * profile.elecPrice, 2).en}).`,
        nl: `Gedetecteerd door ${BRAND.partners.disaggregation}-afwijkingsdetectie op je slimme-meterdata. Extra verbruik: 3,6 kWh (≈ ${eur(3.6 * profile.elecPrice, 2).nl}).`,
      },
      saving: null,
      route: '/usage',
      cta: null,
      source: 'net2grid',
    });
  }
  if (expectedSettlement > 60) {
    out.push({
      id: 'installment',
      kind: 'billing',
      icon: 'wallet',
      title: { en: 'Your installment may be too low', nl: 'Je termijnbedrag is mogelijk te laag' },
      body: {
        en: `We expect about ${eur(expectedSettlement).en} to pay at your next annual statement. Raising your installment to ${eur(c.contract.advisedInstallment).en} spreads that out.`,
        nl: `We verwachten bij je volgende jaarnota zo’n ${eur(expectedSettlement).nl} bij te betalen. Met een termijnbedrag van ${eur(c.contract.advisedInstallment).nl} spreid je dat.`,
      },
      saving: null,
      route: '/billing?adjust=1',
      cta: { en: 'Adjust installment', nl: 'Termijnbedrag aanpassen' },
      source: 'engie',
      detail: null,
    });
  }
  const base = baseloadW(profile);
  if (base > 170) {
    out.push({
      id: 'baseload',
      kind: 'saving',
      icon: 'plug',
      title: { en: 'Your always-on use is above average', nl: 'Je sluipverbruik is hoger dan gemiddeld' },
      body: {
        en: `Your home never drops below ${base} W. Similar homes sit around 150 W. Old fridges, network gear and standby devices are the usual causes.`,
        nl: `Je woning komt nooit onder ${base} W. Vergelijkbare woningen zitten rond 150 W. Oude koelkasten, netwerkapparatuur en standby-apparaten zijn de gebruikelijke oorzaak.`,
      },
      saving: Math.round((base - 150) * 8.76 * profile.elecPrice),
      route: null,
      cta: null,
      source: 'net2grid',
      detail: null,
    });
  }
  if (c.hasHeatPump) {
    out.push({
      id: 'heatpump',
      kind: 'tip',
      icon: 'thermo',
      title: { en: 'Pre-heat with your heat pump at midday', nl: 'Verwarm voor met je warmtepomp rond het middaguur' },
      body: {
        en: 'Your heat pump runs mostly between 17:00 and 21:00. Pre-heating at the cheap midday hours keeps the house warm for less.',
        nl: 'Je warmtepomp draait vooral tussen 17:00 en 21:00. Voorverwarmen in de goedkope middaguren houdt het huis warm voor minder.',
      },
      saving: 85,
      route: null,
      cta: null,
      source: 'net2grid',
      detail: null,
    });
  } else {
    out.push({
      id: 'thermostat',
      kind: 'tip',
      icon: 'flame',
      title: { en: 'One degree lower saves 6% gas', nl: 'Eén graad lager scheelt 6% gas' },
      body: {
        en: `Your heating runs at 20.5 °C in the evening. Setting it to 19.5 °C saves about ${Math.round(c.contract.annualUsage.gasM3 * 0.06)} m³ a year.`,
        nl: `Je verwarming staat ’s avonds op 20,5 °C. Op 19,5 °C bespaar je ongeveer ${Math.round(c.contract.annualUsage.gasM3 * 0.06)} m³ per jaar.`,
      },
      saving: Math.round(c.contract.annualUsage.gasM3 * 0.06 * profile.gasPrice),
      route: null,
      cta: null,
      source: 'engie',
      detail: null,
    });
  }
  if (dynamic) {
    out.push({
      id: 'laundry',
      kind: 'tip',
      icon: 'clock',
      title: { en: 'Run the washer at 13:00 tomorrow', nl: 'Was morgen om 13:00' },
      body: {
        en: `Tomorrow’s price dips to ${eur(p[13] as number, 2).en}/kWh around midday thanks to solar on the grid, half of the evening price.`,
        nl: `De stroomprijs zakt morgen rond het middaguur naar ${eur(p[13] as number, 2).nl}/kWh door zonnestroom op het net, de helft van de avondprijs.`,
      },
      saving: 24,
      route: null,
      cta: null,
      source: 'engie',
      detail: null,
    });
  }
  if (!c.hasSolar) {
    const kwh = 3600;
    out.push({
      id: 'solar',
      kind: 'saving',
      icon: 'sun',
      title: { en: 'Your roof suits 10 solar panels', nl: 'Je dak is geschikt voor 10 zonnepanelen' },
      body: {
        en: `About ${fmtNum(kwh, 'en')} kWh a year from a south-west roof.${evStatus !== 'NONE' ? ' With your EV you would use much of it yourself,' : ' Using it yourself matters'} now net metering ends on 1 January 2027.`,
        nl: `Ongeveer ${fmtNum(kwh, 'nl')} kWh per jaar van een zuidwest-dak.${evStatus !== 'NONE' ? ' Met je auto gebruik je veel zelf, en dat telt' : ' Zelf verbruiken telt'} nu de salderingsregeling op 1 januari 2027 stopt.`,
      },
      saving: 610,
      route: '/assistant?q=solar',
      cta: { en: 'Ask the assistant', nl: 'Vraag de assistent' },
      source: 'engie',
      detail: null,
    });
  }
  return out;
}
