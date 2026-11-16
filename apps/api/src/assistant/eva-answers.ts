/**
 * Eva, the customer assistant: scripted answers (pure) in English and Dutch. Each intent answers from the
 * customer's own data passed in as `EvaFacts`; dated questions ("my September bill", "and last month?")
 * use the extracted entities. Website visitors get general answers and a sign-in prompt for personal ones.
 */
import {
  ASSISTANT,
  BRAND,
  DYNAMIC_PRICE,
  MONTHS_LONG_EN,
  MONTHS_LONG_NL,
  PROGRAM,
  fmtEur,
  fmtNum,
  fmtWindow,
  localeOf,
  type ActiveFlexEventRef,
  type AnnualOverview,
  type AssistantAction,
  type AssistantAnswer,
  type AssistantChart,
  type AssistantFact,
  type BreakdownItem,
  type Contract,
  type EvStatus,
  type Insight,
  type Invoice,
  type Lang,
  type MonthSummary,
  type ThisMonth,
  type UsagePoint,
} from '@engie/shared';
import { PERSONAL, PHRASES, type Intent } from './eva-intents.js';
import { normalise, type Entities } from './eva-nlu.js';

export type Audience = 'customer' | 'visitor';

/** Everything Eva may quote. Only `audience` and `lang` are set for website visitors. */
export interface EvaFacts {
  audience: Audience;
  lang: Lang;
  now: Date;
  firstName?: string;
  city?: string;
  gridOperator?: string;
  ibanMasked?: string;
  contract?: Contract;
  evStatus?: EvStatus;
  thisMonth?: ThisMonth;
  lastMonth?: MonthSummary;
  /** Last 12 complete months, oldest first. */
  months?: UsagePoint[];
  breakdown?: BreakdownItem[];
  peakPct?: number;
  invoices?: Invoice[];
  annual?: AnnualOverview;
  insights?: Insight[];
  activeFlexEvent?: ActiveFlexEventRef | null;
}

export interface EvaQuestion {
  intent: Intent | 'FALLBACK';
  entities: Entities;
  text: string;
  route?: string;
}

interface Reply {
  text: string;
  facts?: AssistantFact[];
  chart?: 'monthly' | 'breakdown';
  actions?: AssistantAction[];
  handoff?: boolean;
  signIn?: boolean;
}

function fmt(lang: Lang) {
  return {
    L: (en: string, nl: string) => (lang === 'nl' ? nl : en),
    eur: (v: number, d = 2) => fmtEur(v, lang, d),
    n: (v: number, d = 0) => fmtNum(v, lang, d),
    date: (iso: string) => new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(iso)),
  };
}

const to = (label: string, route: string): AssistantAction => ({ kind: 'route', label, route });
const ask = (label: string, prompt: string): AssistantAction => ({ kind: 'prompt', label, prompt });
const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
const monthName = (p: UsagePoint, lang: Lang) => `${(lang === 'nl' ? MONTHS_LONG_NL : MONTHS_LONG_EN)[Number(p.key.slice(5)) - 1]} ${p.key.slice(0, 4)}`;
const isDynamic = (c: Contract) => c.product === 'DYNAMIC' || c.product === 'DYNAMIC_FIXED_GAS';

export function phrase(id: keyof typeof PHRASES, lang: Lang): string {
  return PHRASES[id][lang];
}

function base(intent: Intent | 'FALLBACK', f: EvaFacts): Reply {
  const { L, eur, n, date } = fmt(f.lang);
  const lang = f.lang;
  const customer = f.audience === 'customer' && !!f.contract;

  if (!customer && PERSONAL.includes(intent as Intent)) {
    return {
      text: L(
        `I can answer that with your own data once you’re signed in to ${BRAND.appName}. For this demo you can sign in as our sample customer.`,
        `Dat kan ik met je eigen gegevens beantwoorden zodra je bent ingelogd bij ${BRAND.appName}. In deze demo kun je inloggen als onze voorbeeldklant.`,
      ),
      actions: [{ kind: 'signIn', label: L('Sign in (demo)', 'Inloggen (demo)') }],
      signIn: true,
    };
  }
  if (!customer && intent === 'CONTRACT') return base('PRODUCTS', f);

  const c = f.contract as Contract;
  const tm = f.thisMonth as ThisMonth;
  const lm = f.lastMonth as MonthSummary;
  const months = f.months ?? [];
  const prevMonth = months[10];
  const hasEv = f.evStatus !== 'NONE' && f.evStatus !== undefined;
  const cheapest = Math.min(...DYNAMIC_PRICE);
  const priciest = Math.max(...DYNAMIC_PRICE);

  switch (intent) {
    case 'GREETING':
      return {
        text: customer
          ? L(`Hi ${f.firstName}! I’m ${ASSISTANT.customerName.en}. Ask me about your usage, invoices, installment or ways to save.`, `Hoi ${f.firstName}! Ik ben ${ASSISTANT.customerName.nl}. Vraag me naar je verbruik, nota’s, termijnbedrag of manieren om te besparen.`)
          : L(`${ASSISTANT.customerIntro.en} Ask me about our energy contracts, switching or green electricity.`, `${ASSISTANT.customerIntro.nl} Vraag me naar onze energiecontracten, overstappen of groene stroom.`),
      };

    case 'THANKS':
      return { text: L('You’re welcome. Anything else I can help with?', 'Graag gedaan! Kan ik je nog ergens mee helpen?') };

    case 'USAGE': {
      const yoy = pct(tm.electricity, tm.prevElectricity);
      return {
        text: L(
          `So far in ${tm.label.en} (day 1–${tm.daysElapsed}) you’ve used **${n(tm.electricity)} kWh** of electricity and **${n(tm.gas)} m³** of gas. At this pace you’ll finish the month around ${n(tm.forecastElectricity)} kWh and ${n(tm.forecastGas)} m³.`,
          `In ${tm.label.nl} (dag 1–${tm.daysElapsed}) heb je tot nu toe **${n(tm.electricity)} kWh** stroom en **${n(tm.gas)} m³** gas verbruikt. In dit tempo kom je deze maand uit rond ${n(tm.forecastElectricity)} kWh en ${n(tm.forecastGas)} m³.`,
        ),
        facts: [
          { label: L('Electricity this month', 'Stroom deze maand'), value: `${n(tm.electricity)} kWh` },
          { label: L('Gas this month', 'Gas deze maand'), value: `${n(tm.gas)} m³` },
          { label: L('Cost so far', 'Kosten tot nu toe'), value: eur(tm.costSoFar) },
          { label: L('vs. same period last year', 't.o.v. vorig jaar'), value: `${yoy >= 0 ? '+' : ''}${yoy}% ${L('electricity', 'stroom')}`, tone: yoy > 0 ? 'warn' : 'good' },
        ],
        chart: 'monthly',
        actions: [to(L('Open usage', 'Open verbruik'), '/usage'), ask(L('Why is it higher?', 'Waarom is het hoger?'), phrase('BILL_WHY_HIGH', lang))],
      };
    }

    case 'BILL_WHY_HIGH': {
      const up = lm.elecVsPrevMonthPct >= 0;
      const evPart = lm.ev > 0
        ? L(
            `\n• **EV charging**: ${BRAND.partners.disaggregation} recognises an electric car at your home, which used ${n(lm.ev)} kWh, mostly between 18:00 and 21:00${isDynamic(c) ? ' when your dynamic price is highest' : ''}.`,
            `\n• **Laden van je auto**: ${BRAND.partners.disaggregation} herkent een elektrische auto bij je thuis, goed voor ${n(lm.ev)} kWh, vooral tussen 18:00 en 21:00${isDynamic(c) ? ' als je dynamische prijs het hoogst is' : ''}.`,
          )
        : '';
      return {
        text: L(
          `Your electricity use in ${lm.label.en} was **${Math.abs(lm.elecVsPrevMonthPct)}% ${up ? 'higher' : 'lower'}** than the month before (${n(lm.electricity)} vs ${n(prevMonth?.electricity ?? 0)} kWh). What drove it:${evPart}\n• **Colder weather**: gas came to ${n(lm.gas)} m³ as the heating season started.\nYour monthly installment of ${eur(c.installment, 0)} stays the same. You only see the difference at the annual statement.`,
          `Je stroomverbruik in ${lm.label.nl} was **${Math.abs(lm.elecVsPrevMonthPct)}% ${up ? 'hoger' : 'lager'}** dan de maand ervoor (${n(lm.electricity)} vs ${n(prevMonth?.electricity ?? 0)} kWh). Dat komt hierdoor:${evPart}\n• **Kouder weer**: je gasverbruik kwam uit op ${n(lm.gas)} m³ door het begin van het stookseizoen.\nJe termijnbedrag van ${eur(c.installment, 0)} blijft gelijk. Het verschil zie je pas bij de jaarnota.`,
        ),
        facts: [
          { label: L(`${lm.label.en} cost`, `Kosten ${lm.label.nl}`), value: eur(lm.cost), tone: lm.cost > lm.prevCost ? 'warn' : 'good' },
          { label: L('Month before', 'Maand ervoor'), value: eur(lm.prevCost) },
          ...(lm.ev > 0 ? [{ label: L('EV share', 'Aandeel auto'), value: `${n((lm.ev / lm.electricity) * 100)}%` }] : []),
        ],
        chart: 'breakdown',
        actions: [
          ...(hasEv ? [to(L('Set up smart charging', 'Slim laden instellen'), '/smart-charging')] : []),
          ask(L('Check my installment', 'Check mijn termijnbedrag'), phrase('INSTALLMENT', lang)),
        ],
      };
    }

    case 'INSTALLMENT': {
      const a = f.annual as AnnualOverview;
      const gap = c.advisedInstallment - c.installment;
      const settle = a.expectedSettlement;
      return {
        text:
          gap >= 5
            ? L(
                `Your monthly installment is **${eur(c.installment)}**, collected by direct debit on the 28th. Based on your current use we estimate **${eur(a.estimatedTotal, 0)}** for this contract year, about ${eur(settle, 0)} more than your installments cover. Our advice is **${eur(c.advisedInstallment, 0)} a month**.`,
                `Je termijnbedrag is **${eur(c.installment)}**, per automatische incasso op de 28e. Op basis van je huidige verbruik schatten we dit contractjaar op **${eur(a.estimatedTotal, 0)}**, zo’n ${eur(settle, 0)} meer dan je termijnen dekken. Ons advies is **${eur(c.advisedInstallment, 0)} per maand**.`,
              )
            : L(
                `Your monthly installment is **${eur(c.installment)}**, collected by direct debit on the 28th. That fits your usage: we estimate **${eur(a.estimatedTotal, 0)}** for this contract year and expect ${settle > 0 ? `about ${eur(settle, 0)} to pay` : `about ${eur(-settle, 0)} back`} at the annual statement.`,
                `Je termijnbedrag is **${eur(c.installment)}**, per automatische incasso op de 28e. Dat past bij je verbruik: we schatten dit contractjaar op **${eur(a.estimatedTotal, 0)}** en verwachten bij de jaarnota ${settle > 0 ? `zo’n ${eur(settle, 0)} bijbetalen` : `zo’n ${eur(-settle, 0)} terug`}.`,
              ),
        facts: [
          { label: L('Current installment', 'Huidig termijnbedrag'), value: eur(c.installment) },
          { label: L('Advised installment', 'Geadviseerd termijnbedrag'), value: eur(c.advisedInstallment) },
          { label: L('Expected at annual statement', 'Verwacht bij jaarnota'), value: `${settle >= 0 ? '+' : '−'}${eur(Math.abs(settle), 0)}`, tone: settle > 60 ? 'warn' : 'good' },
        ],
        actions: [to(L('Adjust installment', 'Termijnbedrag aanpassen'), '/billing?adjust=1')],
      };
    }

    case 'SAVE': {
      const top = (f.insights ?? []).filter((i) => i.saving).sort((a, b) => (b.saving ?? 0) - (a.saving ?? 0)).slice(0, 3);
      const total = top.reduce((s, i) => s + (i.saving ?? 0), 0);
      const lines = top.map((i) => `• **${i.title[lang]}**: ${L('about', 'zo’n')} ${eur(i.saving ?? 0, 0)} ${L('a year', 'per jaar')}.`).join('\n');
      return {
        text: L(
          `Here are your biggest savings, based on your own usage:\n${lines}\nRight now ${f.peakPct ?? 60}% of your electricity is used in peak hours.`,
          `Dit zijn je grootste besparingen, op basis van je eigen verbruik:\n${lines}\nNu gebruik je ${f.peakPct ?? 60}% van je stroom in de duurste uren.`,
        ),
        facts: [{ label: L('Total potential saving', 'Totale besparing'), value: `${eur(total, 0)} ${L('/ year', '/ jaar')}`, tone: 'good' }],
        actions: [to(L('See all insights', 'Alle inzichten'), '/insights'), ...(hasEv ? [to(L('Plan smart charging', 'Slim laden plannen'), '/smart-charging')] : [])],
      };
    }

    case 'INVOICE': {
      const invoices = f.invoices ?? [];
      const latest = invoices.find((i) => i.kind === 'INSTALLMENT' && i.status === 'PAID') ?? invoices[0];
      const annual = invoices.find((i) => i.kind === 'ANNUAL');
      if (!latest) return base('FALLBACK', f);
      return {
        text: L(
          `Your latest invoice is the installment note for **${latest.period.en}** (${latest.number}) of **${eur(latest.amount)}**. It’s an advance payment, not a bill for actual use: ${eur(latest.lines[0]?.amount ?? 0)} for electricity and ${eur(latest.lines[1]?.amount ?? 0)} for gas. It was paid by direct debit on ${date(latest.paidOn ?? latest.due)}.\nYour actual use is settled once a year.${annual ? ` Your last annual statement (${date(annual.issued)}) came to ${eur(annual.amount)}.` : ''}`,
          `Je laatste nota is de termijnnota voor **${latest.period.nl}** (${latest.number}) van **${eur(latest.amount)}**. Dit is een voorschot, geen afrekening van je werkelijke verbruik: ${eur(latest.lines[0]?.amount ?? 0)} voor stroom en ${eur(latest.lines[1]?.amount ?? 0)} voor gas. Afgeschreven op ${date(latest.paidOn ?? latest.due)}.\nJe werkelijke verbruik rekenen we één keer per jaar af.${annual ? ` Je laatste jaarnota (${date(annual.issued)}) kwam uit op ${eur(annual.amount)}.` : ''}`,
        ),
        facts: latest.lines.map((l) => ({ label: l.label[lang], value: eur(l.amount) })),
        actions: [to(L('Open invoices', 'Open facturen'), '/billing')],
      };
    }

    case 'SOLAR':
      return {
        text: L(
          `A typical south-west roof of about 18 m² fits around **10 panels**, producing roughly **3,600 kWh a year**.\nEstimated saving: **about €610 a year**, investment about €4,900, payback around 8 years. Note: net metering (*salderingsregeling*) ends on 1 January 2027, so using your own solar power directly matters more.${hasEv ? ' Your EV is ideal for that: charging at midday could cover most of it.' : ''}`,
          `Op een gemiddeld zuidwest-dak van zo’n 18 m² passen ongeveer **10 panelen**, goed voor zo’n **3.600 kWh per jaar**.\nGeschatte besparing: **ongeveer €610 per jaar**, investering zo’n €4.900, terugverdientijd circa 8 jaar. Let op: de salderingsregeling stopt op 1 januari 2027, dus zelf je zonnestroom gebruiken wordt belangrijker.${hasEv ? ' Je auto is daar ideaal voor: overdag laden dekt een groot deel.' : ''}`,
        ),
        facts: [
          { label: L('Panels', 'Panelen'), value: '10 × 430 Wp' },
          { label: L('Yearly production', 'Opwek per jaar'), value: `≈ ${n(3600)} kWh` },
          { label: L('Yearly saving', 'Besparing per jaar'), value: `≈ ${eur(610, 0)}`, tone: 'good' },
          { label: L('Payback', 'Terugverdientijd'), value: L('≈ 8 years', '≈ 8 jaar') },
        ],
        actions: customer ? [to(L('See my insights', 'Bekijk mijn inzichten'), '/insights')] : [],
      };

    case 'CONTRACT': {
      const dyn = isDynamic(c);
      return {
        text: L(
          `You have **${c.productName.en}**. ${dyn ? `Electricity follows the hourly market price (today between ${eur(cheapest)} and ${eur(priciest)} per kWh)` : `Electricity is ${eur(c.electricity.avgPrice)} per kWh`}, and gas is **${eur(c.gas.price)}/m³**${c.fixedUntil ? `, fixed until ${date(c.fixedUntil)}` : ''}. Your electricity is Dutch green power.`,
          `Je hebt **${c.productName.nl}**. ${dyn ? `Je stroomprijs volgt de uurprijs op de markt (vandaag tussen ${eur(cheapest)} en ${eur(priciest)} per kWh)` : `Je stroomprijs is ${eur(c.electricity.avgPrice)} per kWh`}, en gas kost **${eur(c.gas.price)}/m³**${c.fixedUntil ? `, vast tot ${date(c.fixedUntil)}` : ''}. Je stroom is Nederlandse groene stroom.`,
        ),
        facts: [
          { label: L('Start date', 'Startdatum'), value: date(c.startDate) },
          ...(c.fixedUntil ? [{ label: L('Fixed until', 'Vast tot'), value: date(c.fixedUntil) }] : []),
          { label: L('Avg. electricity price', 'Gem. stroomprijs'), value: `${eur(c.electricity.avgPrice)}/kWh` },
        ],
        actions: [to(L('View my account', 'Bekijk mijn account'), '/profile')],
      };
    }

    case 'EV': {
      const cheap = L(`Tonight’s cheapest hours are **02:00–05:00 (${eur(0.19)}/kWh)**, against ${eur(priciest)} at 18:00.`, `De goedkoopste uren vannacht zijn **02:00–05:00 (${eur(0.19)}/kWh)**, tegen ${eur(priciest)} om 18:00.`);
      if (!hasEv) {
        return {
          text: L(
            `${BRAND.partners.disaggregation} hasn’t recognised EV charging at your home yet. If you get an electric car, ${PROGRAM.name.en} charges it at the cheapest hours automatically. ${cheap}`,
            `${BRAND.partners.disaggregation} herkent bij jou thuis nog geen elektrische auto. Krijg je er een, dan laadt ${PROGRAM.name.nl} hem vanzelf op de goedkoopste uren. ${cheap}`,
          ),
          actions: [to(L(`About ${PROGRAM.name.en}`, `Over ${PROGRAM.name.nl}`), '/program')],
        };
      }
      return {
        text: L(
          `${BRAND.partners.disaggregation} recognises **EV charging** at your home: sessions of about 3.7 kW, 3–4 times a week. In ${lm.label.en} that was ${n(lm.ev)} kWh, ${n((lm.ev / Math.max(1, lm.electricity)) * 100)}% of your electricity.\n${cheap} ${f.evStatus === 'ENROLLED' ? `With ${PROGRAM.name.en} your car charges then automatically.` : `Join ${PROGRAM.name.en} and your car charges then automatically.`}`,
          `${BRAND.partners.disaggregation} herkent **het laden van een elektrische auto** bij je thuis: sessies van ongeveer 3,7 kW, 3–4 keer per week. In ${lm.label.nl} was dat ${n(lm.ev)} kWh, ${n((lm.ev / Math.max(1, lm.electricity)) * 100)}% van je stroom.\n${cheap} ${f.evStatus === 'ENROLLED' ? `Met ${PROGRAM.name.nl} laadt je auto dan automatisch.` : `Meld je aan voor ${PROGRAM.name.nl} en je auto laadt dan automatisch.`}`,
        ),
        actions: [f.evStatus === 'ENROLLED' ? to(L('Open smart charging', 'Open slim laden'), '/smart-charging') : to(L(`Join ${PROGRAM.name.en}`, `Aanmelden ${PROGRAM.name.nl}`), '/program')],
      };
    }

    case 'FLEX': {
      const e = f.activeFlexEvent;
      if (e && e.status !== 'ENDED') {
        const w = fmtWindow(e.windowStart, e.windowEnd, lang);
        return {
          text: L(
            `Yes: the grid in your neighbourhood is busy today between **${w}**. ${e.myResponse === 'PAUSE' ? 'You agreed to shift your charging, thank you!' : e.myResponse === 'OPT_OUT' ? 'You opted out this time, no problem.' : `Shift your charging outside that window and get ${PROGRAM.perEventIncentive.en}.`}`,
            `Ja: het stroomnet in jouw buurt is vandaag druk tussen **${w}**. ${e.myResponse === 'PAUSE' ? 'Je verschuift het laden, bedankt!' : e.myResponse === 'OPT_OUT' ? 'Je doet deze keer niet mee, geen probleem.' : `Verschuif het laden buiten dat tijdvak en ontvang ${PROGRAM.perEventIncentive.nl}.`}`,
          ),
          actions: [to(L('Open flex request', 'Open flexverzoek'), `/flex-events/${e.id}`)],
        };
      }
      return {
        text:
          f.evStatus === 'ENROLLED'
            ? L(
                `There is no flex moment planned right now. As a ${PROGRAM.name.en} customer you get a message when the grid is busy, and ${PROGRAM.perEventIncentive.en} each time you shift your charging.`,
                `Er is nu geen flexmoment gepland. Als ${PROGRAM.name.nl}-klant krijg je een bericht als het net druk is, en ${PROGRAM.perEventIncentive.nl} per keer dat je het laden verschuift.`,
              )
            : L(
                `${PROGRAM.name.en} charges your car at the cheapest hours and asks you to shift charging when the local grid is busy (a flex moment). You get ${PROGRAM.signupIncentive.en} on sign-up and ${PROGRAM.perEventIncentive.en} per flex moment.`,
                `${PROGRAM.name.nl} laadt je auto op de goedkoopste uren en vraagt je het laden te verschuiven als het net in je buurt druk is (een flexmoment). Je krijgt ${PROGRAM.signupIncentive.nl} bij aanmelding en ${PROGRAM.perEventIncentive.nl} per flexmoment.`,
              ),
        actions: [to(L(`About ${PROGRAM.name.en}`, `Over ${PROGRAM.name.nl}`), '/program')],
      };
    }

    case 'PAYMENT': {
      const open = (f.invoices ?? []).find((i) => i.status !== 'PAID');
      return {
        text: open
          ? L(
              `Nothing is overdue. Your next payment is **${eur(open.amount)}** for ${open.period.en}, collected by direct debit from ${f.ibanMasked} on **${date(open.due)}**.`,
              `Er staat niets achterstallig. Je volgende betaling is **${eur(open.amount)}** voor ${open.period.nl}, per incasso van ${f.ibanMasked} op **${date(open.due)}**.`,
            )
          : L('All your invoices are paid.', 'Al je nota’s zijn betaald.'),
        actions: [to(L('Payment history', 'Betaalgeschiedenis'), '/billing')],
      };
    }

    case 'METER':
      return {
        text: L(
          `You have a smart meter, so you never need to submit readings. The latest reading: electricity ${n(c.meter.electricityT1)} kWh (normal) / ${n(c.meter.electricityT2)} kWh (low), gas ${n(c.meter.gas, 1)} m³.`,
          `Je hebt een slimme meter, dus je hoeft nooit zelf meterstanden door te geven. Laatste stand: stroom ${n(c.meter.electricityT1)} kWh (normaal) / ${n(c.meter.electricityT2)} kWh (dal), gas ${n(c.meter.gas, 1)} m³.`,
        ),
      };

    case 'OUTAGE': {
      const op = f.gridOperator ?? BRAND.partners.networkOperator;
      return {
        text: L(
          `Power cuts are handled by your network operator, not by ${BRAND.utilityName}.${customer ? ` For ${f.city} that’s ${op};` : ''} check storingen.nl or call the national outage number 0800-9009.`,
          `Storingen worden opgelost door je netbeheerder, niet door ${BRAND.utilityName}.${customer ? ` In ${f.city} is dat ${op};` : ''} kijk op storingen.nl of bel het landelijk storingsnummer 0800-9009.`,
        ),
      };
    }

    case 'MOVING':
      return {
        text: L(
          'Moving? Let us know at least 5 working days ahead and take your contract with you at the same rates. Have your new address and move date ready, plus your meter readings on the day you hand over the keys.',
          'Ga je verhuizen? Geef het minimaal 5 werkdagen van tevoren door en neem je contract mee tegen dezelfde tarieven. Houd je nieuwe adres en verhuisdatum bij de hand, en de meterstanden op de dag van de sleuteloverdracht.',
        ),
        actions: customer ? [to(L('Update my details', 'Gegevens wijzigen'), '/profile')] : [],
      };

    case 'HUMAN':
      return {
        text: L(
          'Of course. Customer Service is available Monday to Friday 08:00–20:00 and Saturday 09:00–17:00. I’ll pass along this conversation so you don’t have to repeat yourself (demo: no ticket is created).',
          'Natuurlijk. De Klantenservice is bereikbaar van maandag t/m vrijdag 08:00–20:00 en zaterdag 09:00–17:00. Ik geef dit gesprek door, zodat je niets hoeft te herhalen (demo: er wordt geen ticket aangemaakt).',
        ),
        actions: [ask(L('Request a call back (demo)', 'Terugbelverzoek (demo)'), L('Thanks', 'Bedankt'))],
        handoff: true,
      };

    case 'PRODUCTS':
      return {
        text: L(
          `${BRAND.utilityName} offers four ways to buy energy:\n• **Dynamic Electricity & Gas**: hourly and daily market prices, for active savers.\n• **Dynamic Electricity & Fixed Gas**: flexible power, certainty on gas.\n• **Fixed Electricity & Gas**: fixed rates for 1 to 3 years, carefree and certain.\n• **Variable Electricity & Gas**: rates follow the market, cancel any time.\nWhat matters most to you: certainty, saving actively, or flexibility?`,
          `${BRAND.utilityName} heeft vier manieren om energie af te nemen:\n• **Dynamische Stroom & Gas**: uur- en dagprijzen, voor actieve bespaarders.\n• **Dynamische Stroom & Vast Gas**: flexibele stroom, zekerheid op gas.\n• **Vaste Stroom & Gas**: vaste tarieven voor 1 tot 3 jaar, zorgeloos zeker.\n• **Variabele Stroom & Gas**: tarieven volgen de markt, altijd opzegbaar.\nWat vind jij het belangrijkst: zekerheid, actief besparen of flexibiliteit?`,
        ),
        actions: [ask(L('Certainty', 'Zekerheid'), L('I want a fixed contract', 'Ik wil een vast contract')), ask(L('Saving actively', 'Actief besparen'), L('Tell me about dynamic tariffs', 'Vertel over dynamische tarieven'))],
      };

    case 'SWITCH':
      return {
        text: L(
          `Switching to ${BRAND.utilityName} takes about 5 minutes. We handle cancelling your old supplier, and you keep the same meter. You need your postcode, house number, IBAN and expected annual usage (or we estimate it from your household size).`,
          `Overstappen naar ${BRAND.utilityName} duurt zo’n 5 minuten. Wij regelen de opzegging bij je oude leverancier en je meter blijft hetzelfde. Je hebt je postcode, huisnummer, IBAN en verwachte jaarverbruik nodig (of we schatten het op basis van je huishouden).`,
        ),
      };

    case 'GREEN':
      return {
        text: L(
          `${BRAND.utilityName} supplies Dutch green electricity from wind and solar parks in the Netherlands. Every customer automatically gets it with all our contracts.`,
          `${BRAND.utilityName} levert Nederlandse groene stroom uit wind- en zonneparken in Nederland. Iedere klant krijgt die automatisch bij al onze contracten.`,
        ),
      };

    default:
      return {
        text: customer
          ? L(
              'I’m not sure I understood that. In this demo I can help with your usage, invoices, installment, contract, EV charging, solar panels and saving tips. Shall I put you through to Customer Service?',
              'Dat begreep ik niet helemaal. In deze demo kan ik helpen met je verbruik, nota’s, termijnbedrag, contract, laden van je auto, zonnepanelen en bespaartips. Zal ik je doorzetten naar de Klantenservice?',
            )
          : L(
              'I’m not sure I understood that. In this demo I can help with our contracts, switching and green electricity, and with your own account once you sign in.',
              'Dat begreep ik niet helemaal. In deze demo kan ik helpen met onze contracten, overstappen en groene stroom, en met je eigen account zodra je inlogt.',
            ),
        actions: customer
          ? [ask(L('My usage', 'Mijn verbruik'), phrase('USAGE', lang)), ask(L('Customer Service', 'Klantenservice'), phrase('HUMAN', lang))]
          : [ask(L('Which contract suits me?', 'Welk contract past bij mij?'), phrase('PRODUCTS', lang))],
      };
  }
}

// ---------------------------------------------------------------- dated variants

/** The month a question is about: a named month or "last month"; null for "this month". */
export function pickMonth(e: Entities, months: UsagePoint[], now: Date): { point: UsagePoint; prev: UsagePoint | null } | null {
  let m: number | null = e.month;
  const current = Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Europe/Amsterdam' }).format(now)) - 1;
  if (m === null && e.lastMonth) m = (current + 11) % 12;
  if (m === null || m === current) return null;
  const index = months.findIndex((p) => Number(p.key.slice(5)) - 1 === m);
  if (index < 0) return null;
  return { point: months[index] as UsagePoint, prev: months[index - 1] ?? null };
}

function usageForMonth(p: UsagePoint, prev: UsagePoint | null, f: EvaFacts): Reply {
  const { L, eur, n } = fmt(f.lang);
  const c = f.contract as Contract;
  const name = monthName(p, f.lang);
  const yoy = pct(p.electricity, p.prevElectricity || p.electricity);
  const vsPrev = prev ? pct(p.electricity, prev.electricity) : 0;
  const more = (v: number) => (v >= 0 ? L(`${v}% more`, `${v}% meer`) : L(`${-v}% less`, `${-v}% minder`));
  const cost = eur(p.electricity * c.electricity.avgPrice + p.gas * c.gas.price + c.fixedPerMonth);
  return {
    text: L(
      `In **${name}** you used **${n(p.electricity)} kWh** of electricity and **${n(p.gas)} m³** of gas, about **${cost}**.${prev ? ` That’s ${more(vsPrev)} electricity than the month before,` : ''} and ${more(yoy)} than a year earlier.`,
      `In **${name}** verbruikte je **${n(p.electricity)} kWh** stroom en **${n(p.gas)} m³** gas, ongeveer **${cost}**.${prev ? ` Dat is ${more(vsPrev)} stroom dan de maand ervoor,` : ''} en ${more(yoy)} dan een jaar eerder.`,
    ),
    facts: [
      { label: L('Electricity', 'Stroom'), value: `${n(p.electricity)} kWh` },
      { label: 'Gas', value: `${n(p.gas)} m³` },
      { label: L('Estimated cost', 'Geschatte kosten'), value: cost },
      { label: L('vs last year', 't.o.v. vorig jaar'), value: `${yoy >= 0 ? '+' : ''}${yoy}%`, tone: yoy > 0 ? 'warn' : 'good' },
    ],
    chart: 'monthly',
    actions: [to(L('Open usage', 'Open verbruik'), '/usage')],
  };
}

function whyForMonth(p: UsagePoint, prev: UsagePoint, f: EvaFacts): Reply {
  const { L, eur, n } = fmt(f.lang);
  const c = f.contract as Contract;
  const name = monthName(p, f.lang);
  const prevName = monthName(prev, f.lang);
  const costOf = (x: UsagePoint) => x.electricity * c.electricity.avgPrice + x.gas * c.gas.price + c.fixedPerMonth;
  const cost = costOf(p);
  const prevCost = costOf(prev);
  const gasDelta = p.gas - prev.gas;
  const elecDelta = p.electricity - prev.electricity;
  const gasDriven = Math.abs(gasDelta * c.gas.price) >= Math.abs(elecDelta * c.electricity.avgPrice);
  const higher = cost > prevCost;
  const driver = gasDriven
    ? L(`gas went from ${n(prev.gas)} to ${n(p.gas)} m³ (${gasDelta > 0 ? 'more' : 'less'} heating)`, `gas ging van ${n(prev.gas)} naar ${n(p.gas)} m³ (${gasDelta > 0 ? 'meer' : 'minder'} stoken)`)
    : L(
        `electricity went from ${n(prev.electricity)} to ${n(p.electricity)} kWh${p.ev > 0 ? `, including ${n(p.ev)} kWh of EV charging` : ''}`,
        `stroom ging van ${n(prev.electricity)} naar ${n(p.electricity)} kWh${p.ev > 0 ? `, waarvan ${n(p.ev)} kWh voor je auto` : ''}`,
      );
  return {
    text: higher
      ? L(
          `Your ${name} costs were **${eur(cost)}** against ${eur(prevCost)} in ${prevName}, **${pct(cost, prevCost)}% higher**. The main driver: ${driver}.`,
          `Je kosten in ${name} waren **${eur(cost)}** tegen ${eur(prevCost)} in ${prevName}, **${pct(cost, prevCost)}% hoger**. De belangrijkste oorzaak: ${driver}.`,
        )
      : L(
          `Good news: ${name} was actually **cheaper** than ${prevName} (${eur(cost)} vs ${eur(prevCost)}). The main reason: ${driver}.`,
          `Goed nieuws: ${name} was juist **goedkoper** dan ${prevName} (${eur(cost)} vs ${eur(prevCost)}). De belangrijkste reden: ${driver}.`,
        ),
    facts: [
      { label: L(`${name} cost`, `Kosten ${name}`), value: eur(cost), tone: higher ? 'warn' : 'good' },
      { label: L(`${prevName} cost`, `Kosten ${prevName}`), value: eur(prevCost) },
    ],
    chart: 'monthly',
    actions: [to(L('Open usage', 'Open verbruik'), '/usage')],
  };
}

function invoiceFor(q: EvaQuestion, f: EvaFacts): Reply | null {
  const { L, eur, date } = fmt(f.lang);
  const invoices = f.invoices ?? [];
  const t = normalise(q.text);
  const toBilling = to(L('Open invoices', 'Open facturen'), '/billing');
  if (/\b(annual|jaarnota|jaarafrekening|yearly)\b/.test(t)) {
    const a = invoices.find((i) => i.kind === 'ANNUAL');
    if (!a) return null;
    const pay = a.amount >= 0;
    return {
      text: L(
        `Your last annual statement (${a.number}, ${date(a.issued)}) settled your actual use over the previous contract year. After your advance payments it came to **${eur(Math.abs(a.amount))} ${pay ? 'to pay' : 'back to you'}**, settled on ${date(a.paidOn ?? a.due)}.`,
        `Je laatste jaarnota (${a.number}, ${date(a.issued)}) rekende je werkelijke verbruik af over het vorige contractjaar. Na aftrek van je voorschotten kwam die uit op **${eur(Math.abs(a.amount))} ${pay ? 'bijbetalen' : 'terug'}**, verrekend op ${date(a.paidOn ?? a.due)}.`,
      ),
      facts: a.lines.map((l) => ({ label: l.label[f.lang], value: eur(l.amount) })),
      actions: [toBilling],
    };
  }
  const now = Number(new Intl.DateTimeFormat('en-GB', { month: 'numeric', timeZone: 'Europe/Amsterdam' }).format(f.now)) - 1;
  const m = q.entities.month ?? (q.entities.lastMonth ? (now + 11) % 12 : null);
  if (m === null) return null;
  const inv = invoices.find((i) => i.kind === 'INSTALLMENT' && new Date(i.issued).getUTCMonth() === m);
  if (!inv) return null;
  const elec = eur(inv.lines[0]?.amount ?? 0);
  const gas = eur(inv.lines[1]?.amount ?? 0);
  const when = date(inv.paidOn ?? inv.due);
  return {
    text: L(
      `Your **${inv.period.en}** installment invoice (${inv.number}) was **${eur(inv.amount)}**: ${elec} advance for electricity and ${gas} for gas. ${inv.status === 'PAID' ? `Paid by direct debit on ${when}.` : `It will be collected on ${when}.`}`,
      `Je termijnnota van **${inv.period.nl}** (${inv.number}) was **${eur(inv.amount)}**: ${elec} voorschot stroom en ${gas} gas. ${inv.status === 'PAID' ? `Afgeschreven op ${when}.` : `Wordt afgeschreven op ${when}.`}`,
    ),
    facts: inv.lines.map((l) => ({ label: l.label[f.lang], value: eur(l.amount) })),
    actions: [toBilling],
  };
}

// ---------------------------------------------------------------- entry point

/** Where the next turn is steered, per intent. */
const FOLLOW_UPS: Partial<Record<Intent | 'FALLBACK', (keyof typeof PHRASES)[]>> = {
  USAGE: ['BILL_WHY_HIGH', 'SAVE', 'INVOICE'],
  BILL_WHY_HIGH: ['INSTALLMENT', 'EV', 'SAVE'],
  INSTALLMENT: ['PAYMENT', 'BILL_WHY_HIGH', 'INVOICE'],
  SAVE: ['EV', 'SOLAR', 'USAGE'],
  INVOICE: ['INSTALLMENT', 'PAYMENT', 'BILL_WHY_HIGH'],
  SOLAR: ['SAVE', 'EV', 'CONTRACT'],
  CONTRACT: ['INSTALLMENT', 'EV', 'GREEN'],
  EV: ['FLEX', 'SAVE', 'BILL_WHY_HIGH'],
  FLEX: ['EV', 'SAVE'],
  PAYMENT: ['INSTALLMENT', 'INVOICE'],
  METER: ['USAGE', 'MOVING'],
  MOVING: ['METER', 'HUMAN'],
  OUTAGE: ['HUMAN'],
  PRODUCTS: ['SWITCH', 'GREEN'],
  SWITCH: ['PRODUCTS', 'GREEN'],
  GREEN: ['PRODUCTS', 'SWITCH'],
  GREETING: ['USAGE', 'BILL_WHY_HIGH', 'SAVE'],
  FALLBACK: ['USAGE', 'BILL_WHY_HIGH', 'SAVE'],
};
const VISITOR_FOLLOW_UPS: (keyof typeof PHRASES)[] = ['PRODUCTS', 'SWITCH', 'GREEN'];

function chartFor(kind: Reply['chart'], f: EvaFacts): AssistantChart | null {
  if (kind === 'monthly' && f.months?.length) {
    return { kind: 'bar', unit: 'kWh', points: f.months.map((p, i, a) => ({ label: p.label[f.lang], value: p.electricity, highlight: i === a.length - 1 })) };
  }
  if (kind === 'breakdown' && f.breakdown?.length) {
    return { kind: 'bar', unit: 'kWh', points: f.breakdown.map((b) => ({ label: b.label[f.lang], value: b.kwh, highlight: b.key === 'ev' })) };
  }
  return null;
}

export interface EvaAnswer extends AssistantAnswer {
  /** For the staff insights log. */
  handoff: boolean;
  signInPrompt: boolean;
}

export function answerEva(q: EvaQuestion, f: EvaFacts): EvaAnswer {
  let reply: Reply | null = null;
  const personal = f.audience === 'customer' && !!f.contract && !!f.months;
  if (personal && q.intent === 'USAGE') {
    const p = pickMonth(q.entities, f.months as UsagePoint[], f.now);
    if (p) reply = usageForMonth(p.point, p.prev, f);
  }
  if (personal && q.intent === 'BILL_WHY_HIGH') {
    const p = pickMonth(q.entities, f.months as UsagePoint[], f.now);
    // "Last month" already has the richer default answer.
    if (p?.prev && p.point.key !== (f.months as UsagePoint[])[11]?.key) reply = whyForMonth(p.point, p.prev, f);
  }
  if (personal && q.intent === 'INVOICE') reply = invoiceFor(q, f);
  reply ??= base(q.intent, f);

  const ids = f.audience === 'visitor' ? VISITOR_FOLLOW_UPS : (FOLLOW_UPS[q.intent] ?? []);
  return {
    intent: q.intent,
    matched: q.intent !== 'FALLBACK',
    text: reply.text.split('\n').filter((l) => l.trim()),
    facts: reply.facts ?? [],
    chart: chartFor(reply.chart, f),
    followUps: ids.filter((id) => id !== q.intent).map((id) => phrase(id, f.lang)).slice(0, 4),
    actions: reply.actions ?? [],
    context: { lastIntent: q.intent, route: q.route },
    generatedAt: f.now.toISOString(),
    disclosure: ASSISTANT.disclosureCustomer[f.lang],
    handoff: !!reply.handoff,
    signInPrompt: !!reply.signIn,
  };
}
