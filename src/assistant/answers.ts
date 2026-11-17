/**
 * Scripted answers (pure). Each intent answers from the local demo data; dated questions
 * ("my September bill", "and last month?") use the extracted entities. Pinned by answers.spec.ts.
 * Swap the whole provider for an LLM later: the reply shape stays the same.
 */
import type { Lang } from '../lib/i18n';
import { brand } from '../brand';
import { contract, customer } from '../data/customer';
import { costOf, lastMonthSummary, monthly, peakSplit, thisMonth, type UsagePoint } from '../data/energy';
import { annualOverview, invoices } from '../data/billing';
import { PHRASES, type Intent } from './intents';
import { normalise, type Entities } from './nlu';
import type { AssistantContext, AssistantReply } from './types';

function fmt(lang: Lang) {
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  return {
    L: (en: string, nl: string) => (lang === 'nl' ? nl : en),
    eur: (v: number, d = 2) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
    n: (v: number, d = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v),
    date: (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)),
  };
}

function base(intent: Intent | 'FALLBACK', ctx: AssistantContext): AssistantReply {
  const { L, eur, n, date } = fmt(ctx.lang);
  const name = customer.firstName;

  switch (intent) {
    case 'GREETING':
      return {
        text: L(
          `Hi ${name}! Ask me about your usage, bills, installment or ways to save.`,
          `Hoi ${name}! Vraag me naar je verbruik, nota’s, termijnbedrag of manieren om te besparen.`,
        ),
      };

    case 'THANKS':
      return { text: L('You’re welcome. Anything else I can help with?', 'Graag gedaan! Kan ik je nog ergens mee helpen?') };

    case 'USAGE':
      return {
        text: L(
          `So far in November (1–16) you’ve used **${n(thisMonth.electricity)} kWh** of electricity and **${n(thisMonth.gas)} m³** of gas. At this pace you’ll finish the month around ${n(thisMonth.forecastElectricity)} kWh and ${n(thisMonth.forecastGas)} m³, which is normal for the start of the heating season.`,
          `In november (1–16) heb je tot nu toe **${n(thisMonth.electricity)} kWh** stroom en **${n(thisMonth.gas)} m³** gas verbruikt. In dit tempo kom je deze maand uit rond ${n(thisMonth.forecastElectricity)} kWh en ${n(thisMonth.forecastGas)} m³, normaal voor het begin van het stookseizoen.`,
        ),
        facts: [
          { label: L('Electricity this month', 'Stroom deze maand'), value: `${n(thisMonth.electricity)} kWh` },
          { label: L('Gas this month', 'Gas deze maand'), value: `${n(thisMonth.gas)} m³` },
          { label: L('Cost so far', 'Kosten tot nu toe'), value: eur(thisMonth.costSoFar) },
          {
            label: L('vs. same period last year', 't.o.v. vorig jaar'),
            value: `+${n(((thisMonth.electricity - thisMonth.prevElectricity) / thisMonth.prevElectricity) * 100)}% ${L('electricity', 'stroom')}`,
            tone: 'up',
          },
        ],
        chart: 'monthly',
        actions: [
          { label: L('Open consumption', 'Open verbruik'), to: '/energy' },
          { label: L('Why is it higher?', 'Waarom is het hoger?'), prompt: L('Why is my energy bill higher this month?', 'Waarom is mijn energierekening hoger deze maand?') },
        ],
      };

    case 'BILL_WHY_HIGH':
      return {
        text: L(
          `Your October electricity use was **${lastMonthSummary.elecVsPrevMonthPct}% higher** than September (${n(lastMonthSummary.electricity)} vs 274 kWh). Two things drove it:\n• **EV charging**: we detected a new electric car from late August, which used ${n(lastMonthSummary.ev)} kWh in October, mostly between 18:00 and 21:00 when your dynamic price is highest.\n• **Colder weather**: gas rose to ${n(lastMonthSummary.gas)} m³ as the heating season started.\nYour monthly installment of ${eur(contract.installment, 0)} stays the same. You only see the difference at the annual statement.`,
          `Je stroomverbruik in oktober was **${lastMonthSummary.elecVsPrevMonthPct}% hoger** dan in september (${n(lastMonthSummary.electricity)} vs 274 kWh). Dat komt door twee dingen:\n• **Laden van je auto**: we herkennen sinds eind augustus een elektrische auto, goed voor ${n(lastMonthSummary.ev)} kWh in oktober, vooral tussen 18:00 en 21:00 als je dynamische prijs het hoogst is.\n• **Kouder weer**: je gasverbruik steeg naar ${n(lastMonthSummary.gas)} m³ door het begin van het stookseizoen.\nJe termijnbedrag van ${eur(contract.installment, 0)} blijft gelijk. Het verschil zie je pas bij de jaarnota.`,
        ),
        facts: [
          { label: L('October cost', 'Kosten oktober'), value: eur(lastMonthSummary.cost), tone: 'up' },
          { label: L('September cost', 'Kosten september'), value: eur(lastMonthSummary.prevCost) },
          { label: L('EV share of October', 'Aandeel auto in oktober'), value: `${n((lastMonthSummary.ev / lastMonthSummary.electricity) * 100)}%` },
        ],
        chart: 'breakdown',
        actions: [
          { label: L('Set up smart charging', 'Slim laden instellen'), to: '/smart-energy' },
          { label: L('Check my installment', 'Check mijn termijnbedrag'), prompt: L('What is my current monthly installment?', 'Wat is mijn huidige termijnbedrag?') },
        ],
      };

    case 'INSTALLMENT':
      return {
        text: L(
          `Your monthly installment is **${eur(contract.installment)}**, collected by direct debit on the ${customer.collectionDay}th. Based on your current use, including EV charging, we estimate **${eur(annualOverview.estimatedTotal, 0)}** for this contract year, about ${eur(annualOverview.expectedSettlement, 0)} more than your installments cover. Our advice is **${eur(contract.advisedInstallment, 0)} a month**.`,
          `Je termijnbedrag is **${eur(contract.installment)}**, per automatische incasso op de ${customer.collectionDay}e. Op basis van je huidige verbruik, inclusief het laden van je auto, schatten we dit contractjaar op **${eur(annualOverview.estimatedTotal, 0)}**, zo’n ${eur(annualOverview.expectedSettlement, 0)} meer dan je termijnen dekken. Ons advies is **${eur(contract.advisedInstallment, 0)} per maand**.`,
        ),
        facts: [
          { label: L('Current installment', 'Huidig termijnbedrag'), value: eur(contract.installment) },
          { label: L('Advised installment', 'Geadviseerd termijnbedrag'), value: eur(contract.advisedInstallment) },
          { label: L('Expected at annual statement', 'Verwacht bij jaarnota'), value: `+${eur(annualOverview.expectedSettlement, 0)}`, tone: 'up' },
        ],
        actions: [{ label: L('Adjust installment', 'Termijnbedrag aanpassen'), to: '/billing?adjust=1' }],
      };

    case 'SAVE':
      return {
        text: L(
          `Here are your three biggest savings, based on your own usage:\n• **Charge your EV at night** (01:00–06:00): about €142 a year on your dynamic tariff.\n• **Lower your always-on use**: your home never drops below 205 W against 150 W in similar homes, worth about €96 a year.\n• **Heating one degree lower** in the evening: about €78 a year on gas.\nRight now ${peakSplit.peakPct}% of your electricity is used in peak hours.`,
          `Dit zijn je drie grootste besparingen, op basis van je eigen verbruik:\n• **Laad je auto ’s nachts** (01:00–06:00): zo’n €142 per jaar met je dynamische tarief.\n• **Verlaag je sluipverbruik**: je woning komt nooit onder 205 W tegen 150 W bij vergelijkbare woningen, goed voor zo’n €96 per jaar.\n• **Verwarming één graad lager** in de avond: zo’n €78 per jaar op gas.\nNu gebruik je ${peakSplit.peakPct}% van je stroom in de duurste uren.`,
        ),
        facts: [{ label: L('Total potential saving', 'Totale besparing'), value: `${eur(316, 0)} ${L('/ year', '/ jaar')}`, tone: 'down' }],
        actions: [
          { label: L('See all insights', 'Alle inzichten'), to: '/insights' },
          { label: L('Plan smart charging', 'Slim laden plannen'), to: '/smart-energy' },
        ],
      };

    case 'INVOICE': {
      const latest = invoices.find((i) => i.kind === 'installment' && i.status === 'paid') ?? invoices[0];
      const annual = invoices.find((i) => i.kind === 'annual');
      if (!latest) return base('FALLBACK', ctx);
      return {
        text: L(
          `Your latest invoice is the installment note for **${latest.period.en}** (${latest.id}) of **${eur(latest.amount)}**. It’s an advance payment, not a bill for actual use: ${eur(latest.lines[0]?.amount ?? 0)} for electricity and ${eur(latest.lines[1]?.amount ?? 0)} for gas. It was paid by direct debit on ${date(latest.paidOn ?? latest.due)}.\nYour actual use is settled once a year. ${annual ? `Your last annual statement (${date(annual.issued)}) came to ${eur(annual.amount)} to pay.` : ''}`,
          `Je laatste nota is de termijnnota voor **${latest.period.nl}** (${latest.id}) van **${eur(latest.amount)}**. Dit is een voorschot, geen afrekening van je werkelijke verbruik: ${eur(latest.lines[0]?.amount ?? 0)} voor stroom en ${eur(latest.lines[1]?.amount ?? 0)} voor gas. Afgeschreven op ${date(latest.paidOn ?? latest.due)}.\nJe werkelijke verbruik rekenen we één keer per jaar af. ${annual ? `Je laatste jaarnota (${date(annual.issued)}) kwam uit op ${eur(annual.amount)} bijbetalen.` : ''}`,
        ),
        facts: latest.lines.map((l) => ({ label: ctx.lang === 'nl' ? l.label.nl : l.label.en, value: eur(l.amount) })),
        actions: [{ label: L('Open bills & payments', 'Open nota’s & betalingen'), to: '/billing' }],
      };
    }

    case 'SOLAR':
      return {
        text: L(
          `Your roof (south-west, about 18 m² usable) fits around **10 panels**, producing roughly **3,600 kWh a year**, more than your current electricity use.\nEstimated saving: **about €610 a year**, investment about €4,900, payback around 8 years. Note: net metering (*salderingsregeling*) ends on 1 January 2027, so using your own solar power directly matters more. Your EV is ideal for that: charging at midday could cover most of it.`,
          `Je dak (zuidwest, zo’n 18 m² bruikbaar) is geschikt voor ongeveer **10 panelen**, goed voor zo’n **3.600 kWh per jaar**, meer dan je huidige stroomverbruik.\nGeschatte besparing: **ongeveer €610 per jaar**, investering zo’n €4.900, terugverdientijd circa 8 jaar. Let op: de salderingsregeling stopt op 1 januari 2027, dus zelf je zonnestroom gebruiken wordt belangrijker. Je auto is daar ideaal voor: overdag laden dekt een groot deel.`,
        ),
        facts: [
          { label: L('Panels', 'Panelen'), value: '10 × 430 Wp' },
          { label: L('Yearly production', 'Opwek per jaar'), value: '≈ 3.600 kWh' },
          { label: L('Yearly saving', 'Besparing per jaar'), value: '≈ €610', tone: 'down' },
          { label: L('Payback', 'Terugverdientijd'), value: L('≈ 8 years', '≈ 8 jaar') },
        ],
        actions: [{ label: L('Request a solar quote', 'Offerte zonnepanelen'), to: '/insights' }],
      };

    case 'CONTRACT':
      return {
        text: L(
          `You have **${contract.product.en}**. Electricity follows the hourly market price (today it ranges from €0.17 to €0.39 per kWh), and gas is fixed at **${eur(contract.gas.price, 2)}/m³** until 1 March 2027. Your electricity is Dutch green power.`,
          `Je hebt **${contract.product.nl}**. Je stroomprijs volgt de uurprijs op de markt (vandaag tussen €0,17 en €0,39 per kWh), en je gasprijs staat vast op **${eur(contract.gas.price, 2)}/m³** tot 1 maart 2027. Je stroom is Nederlandse groene stroom.`,
        ),
        facts: [
          { label: L('Start date', 'Startdatum'), value: date(contract.startDate) },
          { label: L('Gas fixed until', 'Gas vast tot'), value: date(contract.gasFixedUntil) },
          { label: L('Avg. electricity price', 'Gem. stroomprijs'), value: `${eur(contract.electricity.avgPrice)}/kWh` },
        ],
        actions: [{ label: L('View my account', 'Bekijk mijn account'), to: '/account' }],
      };

    case 'EV':
      return {
        text: L(
          `We recognised **EV charging** in your home from late August: sessions of about 3.3 kW, 3–4 times a week. In October that was ${n(lastMonthSummary.ev)} kWh, ${n((lastMonthSummary.ev / lastMonthSummary.electricity) * 100)}% of your electricity.\nTonight’s cheapest hours are **02:00–05:00 (€0.17/kWh)**. With smart charging, your car charges then automatically.`,
          `We herkennen sinds eind augustus **het laden van een elektrische auto**: sessies van ongeveer 3,3 kW, 3–4 keer per week. In oktober was dat ${n(lastMonthSummary.ev)} kWh, ${n((lastMonthSummary.ev / lastMonthSummary.electricity) * 100)}% van je stroom.\nDe goedkoopste uren vannacht zijn **02:00–05:00 (€0,17/kWh)**. Met slim laden laadt je auto dan automatisch.`,
        ),
        actions: [{ label: L('Open Smart Energy', 'Open Slimme Energie'), to: '/smart-energy' }],
      };

    case 'PAYMENT': {
      const open = invoices.find((i) => i.status !== 'paid');
      return {
        text: open
          ? L(
              `Nothing is overdue. Your next payment is **${eur(open.amount)}** for ${open.period.en}, collected by direct debit from ${customer.iban.slice(0, 9)} ••• on **${date(open.due)}**.`,
              `Er staat niets achterstallig. Je volgende betaling is **${eur(open.amount)}** voor ${open.period.nl}, per incasso van ${customer.iban.slice(0, 9)} ••• op **${date(open.due)}**.`,
            )
          : L('All your invoices are paid.', 'Al je nota’s zijn betaald.'),
        actions: [{ label: L('Payment history', 'Betaalgeschiedenis'), to: '/billing' }],
      };
    }

    case 'METER':
      return {
        text: L(
          `You have a smart meter, so you never need to submit readings. The latest reading (today 14:00): electricity ${n(contract.meter.electricityT1)} kWh (normal) / ${n(contract.meter.electricityT2)} kWh (low), gas ${n(contract.meter.gas, 1)} m³.`,
          `Je hebt een slimme meter, dus je hoeft nooit zelf meterstanden door te geven. Laatste stand (vandaag 14:00): stroom ${n(contract.meter.electricityT1)} kWh (normaal) / ${n(contract.meter.electricityT2)} kWh (dal), gas ${n(contract.meter.gas, 1)} m³.`,
        ),
      };

    case 'OUTAGE':
      return {
        text: L(
          `Power cuts are handled by your network operator, not by ${brand.name}. For Utrecht that’s ${brand.partners.networkOperator}; check storingen.nl or call the national outage number 0800-9009. I can’t see any reported outage at your address right now.`,
          `Storingen worden opgelost door je netbeheerder, niet door ${brand.name}. In Utrecht is dat ${brand.partners.networkOperator}; kijk op storingen.nl of bel het landelijk storingsnummer 0800-9009. Op jouw adres zie ik nu geen gemelde storing.`,
        ),
      };

    case 'MOVING':
      return {
        text: L(
          'Moving? Let us know at least 5 working days ahead and take your contract with you at the same rates. Have your new address and move date ready, plus your meter readings on the day you hand over the keys.',
          'Ga je verhuizen? Geef het minimaal 5 werkdagen van tevoren door en neem je contract mee tegen dezelfde tarieven. Houd je nieuwe adres en verhuisdatum bij de hand, en de meterstanden op de dag van de sleuteloverdracht.',
        ),
        actions: [{ label: L('Update my details', 'Gegevens wijzigen'), to: '/account' }],
      };

    case 'HUMAN':
      return {
        text: L(
          'Of course. Customer Service is available Monday to Friday 08:00–20:00 and Saturday 09:00–17:00. I’ll pass along this conversation so you don’t have to repeat yourself.',
          'Natuurlijk. De Klantenservice is bereikbaar van maandag t/m vrijdag 08:00–20:00 en zaterdag 09:00–17:00. Ik geef dit gesprek door, zodat je niets hoeft te herhalen.',
        ),
        actions: [{ label: L('Request a call back', 'Terugbelverzoek'), prompt: L('Thanks', 'Bedankt') }],
      };

    case 'PRODUCTS':
      return {
        text: L(
          `${brand.name} offers four ways to buy energy:\n• **Dynamic Electricity & Gas**: hourly and daily market prices, for active savers.\n• **Dynamic Electricity & Fixed Gas**: flexible power, certainty on gas.\n• **Fixed Electricity & Gas**: fixed rates for 1 to 3 years, carefree and certain.\n• **Variable Electricity & Gas**: rates follow the market, cancel any time.\nWhat matters most to you: certainty, saving actively, or flexibility?`,
          `${brand.name} heeft vier manieren om energie af te nemen:\n• **Dynamische Stroom & Gas**: uur- en dagprijzen, voor actieve bespaarders.\n• **Dynamische Stroom & Vast Gas**: flexibele stroom, zekerheid op gas.\n• **Vaste Stroom & Gas**: vaste tarieven voor 1 tot 3 jaar, zorgeloos zeker.\n• **Variabele Stroom & Gas**: tarieven volgen de markt, altijd opzegbaar.\nWat vind jij het belangrijkst: zekerheid, actief besparen of flexibiliteit?`,
        ),
        actions: [
          { label: L('Certainty', 'Zekerheid'), prompt: L('I want a fixed contract', 'Ik wil een vast contract') },
          { label: L('Saving actively', 'Actief besparen'), prompt: L('Tell me about dynamic tariffs', 'Vertel over dynamische tarieven') },
        ],
      };

    case 'SWITCH':
      return {
        text: L(
          `Switching to ${brand.name} takes about 5 minutes. We handle cancelling your old supplier, and you keep the same meter. You need your postcode, house number, IBAN and expected annual usage (or we estimate it from your household size).`,
          `Overstappen naar ${brand.name} duurt zo’n 5 minuten. Wij regelen de opzegging bij je oude leverancier en je meter blijft hetzelfde. Je hebt je postcode, huisnummer, IBAN en verwachte jaarverbruik nodig (of we schatten het op basis van je huishouden).`,
        ),
      };

    case 'GREEN':
      return {
        text: L(
          `${brand.name} supplies Dutch green electricity from wind and solar parks in the Netherlands. Every customer automatically gets it with all our contracts.`,
          `${brand.name} levert Nederlandse groene stroom uit wind- en zonneparken in Nederland. Iedere klant krijgt die automatisch bij al onze contracten.`,
        ),
      };

    default:
      return {
        text: L(
          'I’m not sure I understood that. I can help with your usage, bills and invoices, installment, contract, EV charging, solar panels and saving tips.',
          'Dat begreep ik niet helemaal. Ik kan helpen met je verbruik, nota’s, termijnbedrag, contract, laden van je auto, zonnepanelen en bespaartips.',
        ),
        actions: [
          { label: L('My usage', 'Mijn verbruik'), prompt: L('How much energy did I consume this month?', 'Hoeveel energie heb ik deze maand verbruikt?') },
          { label: L('Saving tips', 'Bespaartips'), prompt: L('How can I reduce my electricity costs?', 'Hoe kan ik mijn stroomkosten verlagen?') },
        ],
      };
  }
}


// ---------------------------------------------------------------- dated variants

const MONTH_NAMES: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
};
const CURRENT_MONTH = 10; // November (demo clock)

/** The month a question is about: a named month, "last month" (October), or null for "this month". */
export function pickMonth(e: Entities): { point: UsagePoint; prev: UsagePoint | null } | null {
  let m: number | null = e.month;
  if (m === null && e.lastMonth) m = 9;
  if (m === null || m === CURRENT_MONTH) return null;
  const index = monthly.findIndex((p) => Number(p.key.slice(5)) - 1 === m);
  if (index < 0) return null;
  return { point: monthly[index] as UsagePoint, prev: monthly[index - 1] ?? null };
}

const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
const monthOf = (p: UsagePoint, lang: Lang) => MONTH_NAMES[lang][Number(p.key.slice(5)) - 1] as string;

function usageForMonth(p: UsagePoint, prev: UsagePoint | null, ctx: AssistantContext): AssistantReply {
  const { L, eur, n } = fmt(ctx.lang);
  const month = monthOf(p, ctx.lang);
  const name = `${month} ${p.key.slice(0, 4)}`;
  const yoy = pct(p.electricity, p.prevElectricity ?? p.electricity);
  const vsPrev = prev ? pct(p.electricity, prev.electricity) : 0;
  const more = (v: number) => (v >= 0 ? L(`${v}% more`, `${v}% meer`) : L(`${-v}% less`, `${-v}% minder`));
  const cost = eur(costOf(p.electricity, p.gas));
  return {
    text: L(
      `In **${name}** you used **${n(p.electricity)} kWh** of electricity and **${n(p.gas)} m³** of gas, about **${cost}**.${prev ? ` That’s ${more(vsPrev)} electricity than the month before,` : ''} and ${more(yoy)} than in ${month} last year.`,
      `In **${name}** verbruikte je **${n(p.electricity)} kWh** stroom en **${n(p.gas)} m³** gas, ongeveer **${cost}**.${prev ? ` Dat is ${more(vsPrev)} stroom dan de maand ervoor,` : ''} en ${more(yoy)} dan in ${month} vorig jaar.`,
    ),
    facts: [
      { label: L('Electricity', 'Stroom'), value: `${n(p.electricity)} kWh` },
      { label: 'Gas', value: `${n(p.gas)} m³` },
      { label: L('Estimated cost', 'Geschatte kosten'), value: cost },
      { label: L('vs last year', 't.o.v. vorig jaar'), value: `${yoy >= 0 ? '+' : ''}${yoy}%`, tone: yoy > 0 ? 'up' : 'down' },
    ],
    chart: 'monthly',
    actions: [{ label: L('Open consumption', 'Open verbruik'), to: '/energy' }],
  };
}

function whyForMonth(p: UsagePoint, prev: UsagePoint, ctx: AssistantContext): AssistantReply {
  const { L, eur, n } = fmt(ctx.lang);
  // Include the year: the comparison month can fall in the previous year (December vs November 2025).
  const name = `${monthOf(p, ctx.lang)} ${p.key.slice(0, 4)}`;
  const prevName = `${monthOf(prev, ctx.lang)} ${prev.key.slice(0, 4)}`;
  const cost = costOf(p.electricity, p.gas);
  const prevCost = costOf(prev.electricity, prev.gas);
  const gasDelta = p.gas - prev.gas;
  const elecDelta = p.electricity - prev.electricity;
  const gasDriven = Math.abs(gasDelta * contract.gas.price) >= Math.abs(elecDelta * contract.electricity.avgPrice);
  const higher = cost > prevCost;
  const ev = p.ev ?? 0;
  const driver = gasDriven
    ? L(`gas went from ${n(prev.gas)} to ${n(p.gas)} m³ (${gasDelta > 0 ? 'more' : 'less'} heating)`, `gas ging van ${n(prev.gas)} naar ${n(p.gas)} m³ (${gasDelta > 0 ? 'meer' : 'minder'} stoken)`)
    : L(
        `electricity went from ${n(prev.electricity)} to ${n(p.electricity)} kWh${ev > 0 ? `, including ${n(ev)} kWh of EV charging` : ''}`,
        `stroom ging van ${n(prev.electricity)} naar ${n(p.electricity)} kWh${ev > 0 ? `, waarvan ${n(ev)} kWh voor je auto` : ''}`,
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
      { label: L(`${name} cost`, `Kosten ${name}`), value: eur(cost), tone: higher ? 'up' : 'down' },
      { label: L(`${prevName} cost`, `Kosten ${prevName}`), value: eur(prevCost) },
    ],
    chart: 'monthly',
    actions: [{ label: L('Open consumption', 'Open verbruik'), to: '/energy' }],
  };
}

function invoiceFor(q: AnswerQuestion, ctx: AssistantContext): AssistantReply | null {
  const { L, eur, date } = fmt(ctx.lang);
  const t = normalise(q.text);
  const toBilling = { label: L('Open bills & payments', 'Open nota’s & betalingen'), to: '/billing#invoices' };
  if (/\b(annual|jaarnota|jaarafrekening|yearly)\b/.test(t)) {
    const a = invoices.find((i) => i.kind === 'annual');
    if (!a) return null;
    return {
      text: L(
        `Your last annual statement (${a.id}, ${date(a.issued)}) settled your actual use for March 2025 – February 2026. After your advance payments it came to **${eur(a.amount)} to pay**, collected on ${date(a.paidOn ?? a.due)}.`,
        `Je laatste jaarnota (${a.id}, ${date(a.issued)}) rekende je werkelijke verbruik af over maart 2025 – februari 2026. Na aftrek van je voorschotten kwam die uit op **${eur(a.amount)} bijbetalen**, afgeschreven op ${date(a.paidOn ?? a.due)}.`,
      ),
      facts: a.lines.map((l) => ({ label: l.label[ctx.lang], value: eur(l.amount) })),
      actions: [toBilling],
    };
  }
  const m = q.entities.month ?? (q.entities.lastMonth ? 9 : null);
  if (m === null) return null;
  const inv = invoices.find((i) => i.kind === 'installment' && Number(i.issued.slice(5, 7)) - 1 === m);
  if (!inv) return null;
  const elec = eur(inv.lines[0]?.amount ?? 0);
  const gas = eur(inv.lines[1]?.amount ?? 0);
  const when = date(inv.paidOn ?? inv.due);
  return {
    text: L(
      `Your **${inv.period.en}** installment invoice (${inv.id}) was **${eur(inv.amount)}**: ${elec} advance for electricity and ${gas} for gas. ${inv.status === 'paid' ? `Paid by direct debit on ${when}.` : `It will be collected on ${when}.`}`,
      `Je termijnnota van **${inv.period.nl}** (${inv.id}) was **${eur(inv.amount)}**: ${elec} voorschot stroom en ${gas} gas. ${inv.status === 'paid' ? `Afgeschreven op ${when}.` : `Wordt afgeschreven op ${when}.`}`,
    ),
    facts: inv.lines.map((l) => ({ label: l.label[ctx.lang], value: eur(l.amount) })),
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
  EV: ['SAVE', 'SOLAR', 'BILL_WHY_HIGH'],
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

export interface AnswerQuestion {
  intent: Intent | 'FALLBACK';
  entities: Entities;
  text: string;
}

export function phrase(id: keyof typeof PHRASES, lang: Lang): string {
  return PHRASES[id][lang];
}

export function answerFor(q: AnswerQuestion, ctx: AssistantContext): AssistantReply {
  let reply: AssistantReply | null = null;
  if (q.intent === 'USAGE') {
    const p = pickMonth(q.entities);
    if (p) reply = usageForMonth(p.point, p.prev, ctx);
  }
  if (q.intent === 'BILL_WHY_HIGH') {
    const p = pickMonth(q.entities);
    if (p?.prev && p.point.key !== '2026-10') reply = whyForMonth(p.point, p.prev, ctx);
  }
  if (q.intent === 'INVOICE') reply = invoiceFor(q, ctx);
  reply ??= base(q.intent, ctx);

  const ids = FOLLOW_UPS[q.intent] ?? [];
  const followUps = ids.filter((id) => id !== q.intent).map((id) => phrase(id, ctx.lang));
  return { ...reply, intent: q.intent, followUps };
}
