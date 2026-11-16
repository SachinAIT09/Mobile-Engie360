/**
 * Guided demo script for presenter mode (Shift+P), same idea as the Hydro One demo's presenter bar.
 * Progress and visibility live in localStorage so a page reload keeps the presenter's place.
 */
import type { Text } from './i18n';

export interface DemoStep {
  title: Text;
  /** One talking point for the presenter. */
  say: Text;
  route: string;
  /** Optional question the assistant asks on arrival (step 4). */
  ask?: Text;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: { en: 'Customer dashboard', nl: 'Klantdashboard' },
    say: { en: 'One view of usage, costs, contract and the next payment, personalised for Sanne.', nl: 'Eén overzicht van verbruik, kosten, contract en de volgende betaling, persoonlijk voor Sanne.' },
    route: '/',
  },
  {
    title: { en: 'Usage analytics', nl: 'Verbruiksanalyse' },
    say: { en: 'Switch to Hour: the dynamic price overlay shows why evening EV charging costs more (+12% in October).', nl: 'Kies Uur: de dynamische prijs laat zien waarom ’s avonds laden duurder is (+12% in oktober).' },
    route: '/energy',
  },
  {
    title: { en: 'Bills & installment', nl: 'Nota’s & termijnbedrag' },
    say: { en: 'Drag the installment to €198 and watch the year-end settlement shrink. Download an invoice.', nl: 'Sleep het termijnbedrag naar €198 en zie de eindafrekening kleiner worden. Download een nota.' },
    route: '/billing?adjust=1',
  },
  {
    title: { en: 'AI assistant', nl: 'AI-assistent' },
    say: { en: 'It answers from her own data, then follow up with “and last month?” or “why was December higher?”.', nl: 'Antwoord op basis van haar eigen data. Vraag daarna “en vorige maand?” of “waarom was december hoger?”.' },
    route: '/',
    ask: { en: 'Why is my energy bill higher this month?', nl: 'Waarom is mijn energierekening hoger deze maand?' },
  },
  {
    title: { en: 'Net2Grid smart energy', nl: 'Net2Grid slimme energie' },
    say: { en: 'Appliance recognition found the EV. Smart charging moves it to the cheapest 15-minute blocks.', nl: 'Apparaatherkenning vond de auto. Slim laden verschuift het naar de goedkoopste kwartieren.' },
    route: '/smart-energy',
  },
  {
    title: { en: 'Website widget', nl: 'Website-widget' },
    say: { en: 'Same assistant on engie.nl: general answers for visitors, personal ones after sign-in.', nl: 'Dezelfde assistent op engie.nl: algemene antwoorden voor bezoekers, persoonlijke na inloggen.' },
    route: '/website-demo',
  },
  {
    title: { en: 'Mobile experience', nl: 'Mobiele ervaring' },
    say: { en: 'The full portal at phone size. Scan the QR code to open it on a real phone.', nl: 'Het hele portaal op telefoonformaat. Scan de QR-code om het op een echte telefoon te openen.' },
    route: '/mobile-preview',
  },
];

const VISIBLE_KEY = 'engie-demo.presenter';
const STEP_KEY = 'engie-demo.step';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

/** `?presenter=1` / `?presenter=0` override the remembered choice. Never inside the phone preview iframe. */
export function initialVisible(): boolean {
  if (window.self !== window.top) return false;
  const q = new URLSearchParams(window.location.search).get('presenter');
  if (q === '1' || q === '0') {
    write(VISIBLE_KEY, q);
    return q === '1';
  }
  return read(VISIBLE_KEY) === '1';
}
export const saveVisible = (v: boolean) => write(VISIBLE_KEY, v ? '1' : '0');

export function initialStep(): number {
  const n = Number(read(STEP_KEY));
  return Number.isInteger(n) && n >= 0 && n < DEMO_STEPS.length ? n : 0;
}
export const saveStep = (n: number) => write(STEP_KEY, String(n));

/** Hotkeys are ignored while typing. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}
