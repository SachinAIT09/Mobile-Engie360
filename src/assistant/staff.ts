/**
 * Scripted assistant for the staff app (the Hydro "AI Assistant" page, for customer service).
 * Same matcher as Eva (nlu.ts), different intents: questions about the whole customer base
 * (what needs attention, installments, EV charging, app activity, message results, cities), a
 * look-up of one customer by name, and message drafts that open in the composer.
 * Pure; pinned by staff.spec.ts.
 */
import type { Activity, AttentionFlag, CustomerSummary, OutboxItem, Portfolio } from '../../shared/contract';
import type { Lang, Text } from '../lib/i18n';
import { brand } from '../brand';
import { TEMPLATES } from '../data/templates';
import { matchIntent, type IntentDef } from './nlu';
import type { AssistantReply } from './types';

export type StaffIntent = 'OVERVIEW' | 'NEXT_ACTION' | 'INSTALLMENT' | 'EV' | 'ANOMALY' | 'ACTIVITY' | 'MESSAGES' | 'CITIES' | 'DRAFT';

export interface StaffAssistantState {
  lang: Lang;
  lastIntent?: string;
  portfolio: Portfolio;
  customers: CustomerSummary[];
  /** Messages sent to groups of customers, newest first. */
  campaigns: OutboxItem[];
  /** The latest things customers did, newest first. */
  feed: Activity[];
}

export const STAFF_INTENTS: readonly IntentDef<StaffIntent>[] = [
  {
    id: 'DRAFT',
    priority: 9,
    groups: [
      { words: ['draft', 'write', 'compose', 'schrijf', 'opstellen', 'concept'], weight: 2.5 },
      { words: ['message', 'bericht', 'notification', 'melding', 'text'], weight: 1 },
    ],
  },
  {
    id: 'NEXT_ACTION',
    priority: 8,
    groups: [
      { words: ['what should i do', 'next best', 'next action', 'next step', 'recommend', 'needs attention', 'need attention', 'priorit', 'wat moet ik doen', 'volgende stap', 'aanbevel', 'aandacht'], weight: 3 },
      { words: ['first', 'now', 'today', 'eerst', 'nu', 'vandaag'], weight: 0.5 },
    ],
    negative: ['city', 'cities', 'plaats', 'stad'],
  },
  {
    id: 'CITIES',
    priority: 7,
    groups: [
      { words: ['city', 'cities', 'region', 'where', 'plaats', 'plaatsen', 'stad', 'steden', 'regio', 'waar'], weight: 3 },
      { words: ['most', 'which', 'meeste', 'welke'], weight: 0.5 },
    ],
  },
  {
    id: 'MESSAGES',
    priority: 7,
    groups: [
      { words: ['messages', 'campaign', 'berichten', 'campagne', 'open rate', 'read rate', 'performing', 'results', 'resultaten', 'gelezen'], weight: 3 },
      { words: ['how', 'hoe', 'sent', 'verstuurd'], weight: 0.5 },
    ],
  },
  {
    id: 'INSTALLMENT',
    priority: 7,
    groups: [
      { words: ['installment', 'termijn', 'termijnbedrag', 'maandbedrag', 'voorschot', 'annual statement', 'jaarnota', 'shortfall', 'tekort'], weight: 3 },
      { words: ['too low', 'te laag', 'how many', 'hoeveel'], weight: 1 },
    ],
  },
  {
    id: 'ANOMALY',
    priority: 7,
    groups: [
      { words: ['anomal', 'unusual', 'night', 'afwijk', 'ongebruikelijk', 'nacht'], weight: 2.5 },
      { words: ['use', 'usage', 'verbruik', 'which', 'welke'], weight: 0.5 },
    ],
  },
  {
    id: 'EV',
    priority: 6,
    groups: [
      { words: ['=ev', 'charging', 'charge', '=car', 'electric car', 'laden', '=auto', 'smart charging', 'slim laden', 'peak', 'piek'], weight: 3 },
      { words: ['how many', 'hoeveel'], weight: 0.5 },
    ],
    negative: ['incasso'],
  },
  {
    id: 'ACTIVITY',
    priority: 5,
    groups: [
      { words: ['activity', 'activiteit', 'in the app', 'in de app', 'online', 'doing', 'doen', 'right now', 'active', 'actief', 'busy', 'druk'], weight: 2.5 },
      { words: ['what', 'who', 'wat', 'wie'], weight: 0.5 },
    ],
  },
  {
    id: 'OVERVIEW',
    priority: 3,
    groups: [
      { words: ['overview', 'summary', 'summarise', 'summarize', 'at a glance', 'customer base', 'how many customers', 'overzicht', 'samenvatting', 'klantenbestand', 'hoeveel klanten'], weight: 3 },
      { words: ['customers', 'klanten'], weight: 0.5 },
    ],
  },
];

/** One phrasing per intent for the suggestion chips; each must round-trip to its intent (spec). */
export const STAFF_PHRASES: Record<StaffIntent, Text> = {
  OVERVIEW: { en: 'Give me an overview of the customer base', nl: 'Geef me een overzicht van het klantenbestand' },
  NEXT_ACTION: { en: 'What needs attention first?', nl: 'Wat vraagt als eerste aandacht?' },
  INSTALLMENT: { en: 'How many customers have an installment that is too low?', nl: 'Hoeveel klanten hebben een te laag termijnbedrag?' },
  EV: { en: 'How many customers charge their EV at peak hours?', nl: 'Hoeveel klanten laden hun auto in piekuren?' },
  ANOMALY: { en: 'Which customers had unusual night-time use?', nl: 'Welke klanten hadden ongebruikelijk nachtverbruik?' },
  ACTIVITY: { en: 'What are customers doing in the app right now?', nl: 'Wat doen klanten nu in de app?' },
  MESSAGES: { en: 'How are our messages performing?', nl: 'Hoe presteren onze berichten?' },
  CITIES: { en: 'Which city has the most customers to follow up?', nl: 'Welke plaats heeft de meeste klanten om op te volgen?' },
  DRAFT: { en: 'Draft a message about the installment', nl: 'Schrijf een bericht over het termijnbedrag' },
};

/** The chips on the empty screen. */
export const STAFF_SUGGESTIONS: StaffIntent[] = ['NEXT_ACTION', 'OVERVIEW', 'INSTALLMENT', 'MESSAGES', 'ACTIVITY', 'DRAFT'];

export const staffPhrase = (id: StaffIntent, lang: Lang) => STAFF_PHRASES[id][lang];

/** Which segment and template a "draft a message about …" question is asking for. */
function draftFor(question: string): { segment: AttentionFlag; templateId: string } {
  const q = question.toLowerCase();
  if (/charg|laden|\bev\b|car|auto|cheap|goedkoop|peak|piek/.test(q)) return { segment: 'ev-peak', templateId: 'cheap-hours' };
  if (/night|nacht|unusual|ongebruikelijk|anomal|afwijk/.test(q)) return { segment: 'night-use', templateId: 'night-use' };
  return { segment: 'installment', templateId: 'installment' };
}

export function staffReply(question: string, s: StaffAssistantState): AssistantReply {
  const { lang, portfolio: p, customers } = s;
  const L = (en: string, nl: string) => (lang === 'nl' ? nl : en);
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const eur = (v: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
  const n = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const follow = (...ids: StaffIntent[]) => ids.map((id) => staffPhrase(id, lang));
  const queue = (id: AttentionFlag) => p.queue.find((q) => q.id === id);
  const byCity = (pred: (c: CustomerSummary) => boolean) => {
    const counts = new Map<string, number>();
    for (const c of customers) if (pred(c)) counts.set(c.city, (counts.get(c.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  const cityBars = (rows: [string, number][], caption: string) => ({ caption, points: rows.slice(0, 6).map(([label, value], i) => ({ label, value, hi: i === 0 })) });

  // A customer's full name in the question wins over everything: "tell me about Olivia Carter".
  const q = question.toLowerCase();
  const who = customers.find((c) => q.includes(`${c.firstName} ${c.lastName}`.toLowerCase()));
  if (who) {
    const gap = who.advised - who.installment;
    const points = [
      who.flags.includes('installment') && L(`the installment is ${eur(gap)} a month too low`, `het termijnbedrag is ${eur(gap)} per maand te laag`),
      who.flags.includes('ev-peak') && L('the car charges in the most expensive hours', 'de auto laadt in de duurste uren'),
      who.flags.includes('night-use') && L('there was unusual night-time use', 'er was ongebruikelijk nachtverbruik'),
    ].filter(Boolean) as string[];
    return {
      intent: 'CUSTOMER',
      text:
        L(`**${who.firstName} ${who.lastName}** (${who.customerNo}) lives in ${who.city} and has ${who.product.en}. `, `**${who.firstName} ${who.lastName}** (${who.customerNo}) woont in ${who.city} en heeft ${who.product.nl}. `) +
        (points.length ? L(`Open points: ${points.join('; ')}.`, `Open punten: ${points.join('; ')}.`) : L('Nothing needs attention.', 'Niets vraagt aandacht.')) +
        ' ' +
        (who.online ? L('In the app right now.', 'Nu in de app.') : who.appUser ? L('Uses the app.', 'Gebruikt de app.') : L('Does not use the app.', 'Gebruikt de app niet.')),
      facts: [
        { label: L('Installment', 'Termijnbedrag'), value: eur(who.installment), tone: gap > 0 ? 'up' : undefined },
        { label: L('Advised', 'Advies'), value: eur(who.advised) },
        { label: L('Electric car', 'Elektrische auto'), value: who.hasEv ? L('Yes', 'Ja') : L('No', 'Nee') },
      ],
      actions: [{ label: L('Open the customer page', 'Open de klantpagina'), to: `/staff/customers/${who.id}` }],
      followUps: follow('NEXT_ACTION', 'OVERVIEW'),
    };
  }

  const { intent } = matchIntent(question, STAFF_INTENTS, s.lastIntent);
  const low = queue('installment');
  const ev = queue('ev-peak');
  const night = queue('night-use');

  switch (intent) {
    case 'OVERVIEW':
      return {
        intent,
        text: L(
          `${brand.name} has **${n(p.customers)} customers** here; ${n(p.appUsers)} of them (${pct(p.appUsers, p.customers)}%) use ${brand.portal}. **${n(p.onlineNow)}** are in the app right now and ${n(p.activeToday)} were active in the last 24 hours.\n**${n(p.needAttention)} customers** (${pct(p.needAttention, p.customers)}%) have at least one open point.`,
          `${brand.name} heeft hier **${n(p.customers)} klanten**; ${n(p.appUsers)} daarvan (${pct(p.appUsers, p.customers)}%) gebruiken ${brand.portal}. **${n(p.onlineNow)}** zijn nu in de app en ${n(p.activeToday)} waren actief in de laatste 24 uur.\n**${n(p.needAttention)} klanten** (${pct(p.needAttention, p.customers)}%) hebben minstens één open punt.`,
        ),
        facts: [
          { label: L('Customers', 'Klanten'), value: n(p.customers) },
          { label: L('In the app now', 'Nu in de app'), value: n(p.onlineNow), tone: 'down' },
          { label: L('Need attention', 'Vragen aandacht'), value: n(p.needAttention), tone: 'up' },
        ],
        bars: { caption: L('Customers per contract', 'Klanten per contract'), points: p.products.map((x, i) => ({ label: x.label[lang].split(' ')[0] ?? '', value: x.count, hi: i === 0 })) },
        actions: [{ label: L('Open the customer list', 'Open de klantenlijst'), to: '/staff/customers' }],
        followUps: follow('NEXT_ACTION', 'CITIES', 'ACTIVITY'),
      };

    case 'NEXT_ACTION': {
      const open = p.queue.filter((x) => x.count - x.contacted > 0).sort((a, b) => Number(b.id === 'eva-agent') - Number(a.id === 'eva-agent') || b.count - b.contacted - (a.count - a.contacted));
      const first = open[0];
      if (!first) {
        return {
          intent,
          text: L('Nothing is waiting. Every group that needs attention has been sent its message today.', 'Er staat niets open. Elke groep die aandacht vraagt heeft vandaag een bericht gekregen.'),
          actions: [{ label: L('Open the dashboard', 'Open het dashboard'), to: '/staff' }],
          followUps: follow('MESSAGES', 'ACTIVITY'),
        };
      }
      const rest = open.slice(1);
      return {
        intent,
        text:
          L(`Start with **${first.title.en}**: ${n(first.count)} customer${first.count === 1 ? '' : 's'}. ${first.detail.en}`, `Begin met **${first.title.nl}**: ${n(first.count)} ${first.count === 1 ? 'klant' : 'klanten'}. ${first.detail.nl}`) +
          (rest.length ? `\n${L('After that:', 'Daarna:')}\n${rest.map((x) => `• ${x.title[lang]} (${n(x.count)})`).join('\n')}` : ''),
        bars: { caption: L('Customers per open point', 'Klanten per open punt'), points: open.map((x, i) => ({ label: x.title[lang].split(' ')[0] ?? '', value: x.count, hi: i === 0 })) },
        actions: first.templateId
          ? [
              { label: L(`Message all ${n(first.count)}`, `Bericht aan alle ${n(first.count)}`), to: `/staff/messages?segment=${first.id}&template=${first.templateId}` },
              { label: L('View these customers', 'Bekijk deze klanten'), to: `/staff/customers?filter=${first.id}` },
            ]
          : [{ label: L('Open it', 'Openen'), to: first.to ?? '/staff' }],
        followUps: follow('INSTALLMENT', 'DRAFT', 'CITIES'),
      };
    }

    case 'INSTALLMENT': {
      const rows = customers.filter((c) => c.flags.includes('installment'));
      const shortfall = rows.reduce((sum, c) => sum + (c.advised - c.installment) * 12, 0);
      const avg = rows.length ? Math.round(rows.reduce((sum, c) => sum + (c.advised - c.installment), 0) / rows.length) : 0;
      return {
        intent,
        text: L(
          `**${n(rows.length)} customers** (${pct(rows.length, p.customers)}%) pay an installment below the advised amount, on average **${eur(avg)} a month** too little. Left as it is, they will have to pay about **${eur(shortfall)}** in total at their annual statements.${low && low.contacted > 0 ? ` ${n(low.contacted)} of them were already sent the advice today.` : ''}`,
          `**${n(rows.length)} klanten** (${pct(rows.length, p.customers)}%) betalen een termijnbedrag onder het advies, gemiddeld **${eur(avg)} per maand** te weinig. Als dit zo blijft, betalen ze samen zo’n **${eur(shortfall)}** bij op hun jaarnota’s.${low && low.contacted > 0 ? ` ${n(low.contacted)} van hen kregen het advies vandaag al.` : ''}`,
        ),
        facts: [
          { label: L('Too low', 'Te laag'), value: n(rows.length), tone: 'up' },
          { label: L('Average gap', 'Gemiddeld verschil'), value: L(`${eur(avg)} / month`, `${eur(avg)} / maand`) },
          { label: L('Total to pay extra', 'Totaal bijbetalen'), value: eur(shortfall), tone: 'up' },
        ],
        bars: cityBars(byCity((c) => c.flags.includes('installment')), L('Installment too low, per city', 'Termijnbedrag te laag, per plaats')),
        actions: [
          { label: L(`Message all ${n(rows.length)}`, `Bericht aan alle ${n(rows.length)}`), to: '/staff/messages?segment=installment&template=installment' },
          { label: L('View these customers', 'Bekijk deze klanten'), to: '/staff/customers?filter=installment' },
        ],
        followUps: follow('DRAFT', 'CITIES', 'MESSAGES'),
      };
    }

    case 'EV': {
      const evs = customers.filter((c) => c.hasEv).length;
      const count = ev?.count ?? 0;
      return {
        intent,
        text: L(
          `${n(evs)} customers have an electric car at home. **${n(count)}** of them charge mostly between 18:00 and 21:00, the most expensive hours on a dynamic tariff. Smart charging would save each of them about €142 a year, **${eur(count * 142)}** together.`,
          `${n(evs)} klanten hebben thuis een elektrische auto. **${n(count)}** van hen laden vooral tussen 18:00 en 21:00, de duurste uren bij een dynamisch tarief. Slim laden bespaart elk van hen zo’n €142 per jaar, samen **${eur(count * 142)}**.`,
        ),
        facts: [
          { label: L('EV drivers', 'Rijders'), value: n(evs) },
          { label: L('Charging at peak', 'Laden in piek'), value: n(count), tone: 'up' },
          { label: L('Possible saving', 'Mogelijke besparing'), value: L(`${eur(count * 142)} / year`, `${eur(count * 142)} / jaar`), tone: 'down' },
        ],
        actions: [
          { label: L(`Message all ${n(count)}`, `Bericht aan alle ${n(count)}`), to: '/staff/messages?segment=ev-peak&template=cheap-hours' },
          { label: L('View these customers', 'Bekijk deze klanten'), to: '/staff/customers?filter=ev-peak' },
        ],
        followUps: follow('DRAFT', 'INSTALLMENT', 'NEXT_ACTION'),
      };
    }

    case 'ANOMALY': {
      const rows = customers.filter((c) => c.flags.includes('night-use'));
      return {
        intent,
        text:
          L(`**${n(rows.length)} customers** had several times their normal night-time use in the past week, usually a heater or dryer left on:`, `**${n(rows.length)} klanten** hadden in de afgelopen week meerdere keren hun normale nachtverbruik, meestal een kachel of droger die aan bleef staan:`) +
          `\n${rows.slice(0, 6).map((c) => `• ${c.firstName} ${c.lastName}, ${c.city}`).join('\n')}` +
          (rows.length > 6 ? `\n${L(`and ${rows.length - 6} more.`, `en nog ${rows.length - 6}.`)}` : ''),
        actions: [
          { label: L(`Message all ${n(night?.count ?? rows.length)}`, `Bericht aan alle ${n(night?.count ?? rows.length)}`), to: '/staff/messages?segment=night-use&template=night-use' },
          { label: L('View these customers', 'Bekijk deze klanten'), to: '/staff/customers?filter=night-use' },
        ],
        followUps: follow('NEXT_ACTION', 'DRAFT'),
      };
    }

    case 'ACTIVITY': {
      const total = p.byHour.reduce((sum, h) => sum + h.actions, 0);
      return {
        intent,
        text:
          L(`**${n(p.onlineNow)} customers** are in ${brand.portal} right now and ${n(p.activeToday)} used it in the last 24 hours. So far today: about ${n(total)} actions.`, `**${n(p.onlineNow)} klanten** zijn nu in ${brand.portal} en ${n(p.activeToday)} gebruikten de app in de laatste 24 uur. Vandaag tot nu toe: ongeveer ${n(total)} acties.`) +
          (s.feed.length ? `\n${L('The latest:', 'Het laatste:')}\n${s.feed.map((a) => `• ${a.customerName}: ${a.text[lang]}`).join('\n')}` : ''),
        bars: { caption: L('Actions in the app today, per hour', 'Acties in de app vandaag, per uur'), points: p.byHour.slice(-8).map((h, i, list) => ({ label: `${String(h.hour).padStart(2, '0')}h`, value: h.actions, hi: i === list.length - 1 })) },
        actions: [{ label: L('Open customer activity', 'Open klantactiviteit'), to: '/staff/activity' }],
        followUps: follow('NEXT_ACTION', 'OVERVIEW'),
      };
    }

    case 'MESSAGES': {
      const sent = s.campaigns.reduce((sum, c) => sum + c.audience!.count, 0);
      const delivered = s.campaigns.reduce((sum, c) => sum + c.audience!.delivered, 0);
      const opened = s.campaigns.reduce((sum, c) => sum + c.audience!.read, 0);
      const acted = s.campaigns.reduce((sum, c) => sum + c.audience!.acted, 0);
      const best = [...s.campaigns].filter((c) => c.audience!.delivered > 20).sort((a, b) => b.audience!.acted / b.audience!.delivered - a.audience!.acted / a.audience!.delivered)[0];
      return {
        intent,
        text:
          L(
            `In the last three months the team sent **${n(s.campaigns.length)} messages to groups**, ${n(sent)} deliveries in all. **${pct(opened, delivered)}%** were opened and **${pct(acted, delivered)}%** of customers did what the message asked.`,
            `In de laatste drie maanden stuurde het team **${n(s.campaigns.length)} berichten aan groepen**, samen ${n(sent)} afleveringen. **${pct(opened, delivered)}%** werd geopend en **${pct(acted, delivered)}%** van de klanten deed wat het bericht vroeg.`,
          ) + (best ? `\n${L(`Best result: “${best.title.en}” to ${n(best.audience!.count)} customers, ${pct(best.audience!.acted, best.audience!.delivered)}% acted on it.`, `Beste resultaat: “${best.title.nl}” aan ${n(best.audience!.count)} klanten, ${pct(best.audience!.acted, best.audience!.delivered)}% deed er iets mee.`)}` : ''),
        facts: [
          { label: L('Sent', 'Verstuurd'), value: n(sent) },
          { label: L('Opened', 'Geopend'), value: `${pct(opened, delivered)}%`, tone: 'down' },
          { label: L('Acted', 'Actie genomen'), value: `${pct(acted, delivered)}%`, tone: 'down' },
        ],
        bars: { caption: L('From sent to acted', 'Van verstuurd tot actie'), points: [
          { label: L('Sent', 'Verstuurd'), value: sent },
          { label: L('Delivered', 'Afgeleverd'), value: delivered },
          { label: L('Opened', 'Geopend'), value: opened },
          { label: L('Acted', 'Actie'), value: acted, hi: true },
        ] },
        actions: [
          { label: L('Open messages', 'Open berichten'), to: '/staff/messages' },
          { label: L('Open reports', 'Open rapporten'), to: '/staff/reports' },
        ],
        followUps: follow('NEXT_ACTION', 'DRAFT'),
      };
    }

    case 'CITIES': {
      const rows = byCity((c) => c.flags.length > 0);
      const top = rows[0];
      return {
        intent,
        text: top
          ? L(`**${top[0]}** has the most customers to follow up: ${n(top[1])}. Next are ${rows.slice(1, 4).map(([city, count]) => `${city} (${n(count)})`).join(', ')}.`, `**${top[0]}** heeft de meeste klanten om op te volgen: ${n(top[1])}. Daarna ${rows.slice(1, 4).map(([city, count]) => `${city} (${n(count)})`).join(', ')}.`)
          : L('No customers need follow-up right now.', 'Er zijn nu geen klanten om op te volgen.'),
        bars: cityBars(rows, L('Customers with an open point, per city', 'Klanten met een open punt, per plaats')),
        actions: [{ label: L('Open reports', 'Open rapporten'), to: '/staff/reports' }],
        followUps: follow('NEXT_ACTION', 'INSTALLMENT'),
      };
    }

    case 'DRAFT': {
      const d = draftFor(question);
      const tpl = TEMPLATES.find((t) => t.id === d.templateId)!;
      const count = queue(d.segment)?.count ?? 0;
      return {
        intent,
        text: L(`Here is a draft for the ${n(count)} customers it applies to. Open it in the composer to edit, preview and send.`, `Hier is een concept voor de ${n(count)} klanten voor wie het geldt. Open het in de editor om het aan te passen, te bekijken en te versturen.`),
        draft: { templateId: tpl.id, title: tpl.title[lang], body: tpl.body[lang], to: `/staff/messages?segment=${d.segment}&template=${tpl.id}` },
        actions: [{ label: L('Open in the composer', 'Open in de editor'), to: `/staff/messages?segment=${d.segment}&template=${tpl.id}` }],
        followUps: [L('Draft a message about smart charging', 'Schrijf een bericht over slim laden'), L('Draft a message about the night-time use', 'Schrijf een bericht over het nachtverbruik'), staffPhrase('NEXT_ACTION', lang)],
      };
    }

    default:
      return {
        intent: 'FALLBACK',
        text: L(
          'I did not catch that. I can tell you what needs attention, how installments, EV charging and messages are doing, what customers are doing in the app, look up a customer by full name, or draft a message.',
          'Dat begreep ik niet. Ik kan vertellen wat aandacht vraagt, hoe het gaat met termijnbedragen, laden en berichten, wat klanten in de app doen, een klant opzoeken op volledige naam, of een bericht schrijven.',
        ),
        followUps: follow('NEXT_ACTION', 'OVERVIEW', 'DRAFT'),
      };
  }
}
