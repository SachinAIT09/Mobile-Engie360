/**
 * Guided demo script for presenter mode (Shift+P in the staff app), as in Hydro Mobile360's presenter bar.
 * The presenter drives the staff app on the laptop; the customer app runs on a phone.
 * Progress and visibility live in localStorage so a page reload keeps the presenter's place.
 */
import type { Text } from './i18n';

export interface DemoStep {
  title: Text;
  /** One talking point for the presenter. */
  say: Text;
  /** Staff app route. */
  route: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    title: { en: 'Customer at a glance', nl: 'Klant in één oogopslag' },
    say: { en: 'Olivia’s usage, costs and installment advice. The badge shows she is in the app on her phone right now.', nl: 'Verbruik, kosten en termijnadvies van Olivia. Het label laat zien dat ze nu in de app op haar telefoon zit.' },
    route: '/staff',
  },
  {
    title: { en: 'Customer activity', nl: 'Klantactiviteit' },
    say: { en: 'On the phone: Billing → Adjust installment → €198. The change appears here at once.', nl: 'Op de telefoon: Betalen → Termijnbedrag aanpassen → €198. De wijziging verschijnt hier meteen.' },
    route: '/staff/activity',
  },
  {
    title: { en: 'Eva conversations', nl: 'Gesprekken met Eva' },
    say: { en: 'On the phone: tap Eva → “Why is my energy bill higher this month?”. Read along here, live.', nl: 'Op de telefoon: tik op Eva → “Waarom is mijn energierekening hoger deze maand?”. Lees hier live mee.' },
    route: '/staff/conversations',
  },
  {
    title: { en: 'Send to phone', nl: 'Naar telefoon sturen' },
    say: { en: 'Tap “Cheapest hours tonight”: a banner in the app, and a notification if they are on.', nl: 'Tik op “Goedkoopste uren vannacht”: een melding in de app, en op de telefoon als meldingen aan staan.' },
    route: '/staff/demo',
  },
  {
    title: { en: 'Personal message', nl: 'Persoonlijk bericht' },
    say: { en: 'Write your own message; see when Olivia reads it.', nl: 'Schrijf een eigen bericht en zie wanneer Olivia het leest.' },
    route: '/staff/messages',
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

/** `?presenter=1` / `?presenter=0` override the remembered choice. Never inside the laptop phone column (an iframe). */
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
