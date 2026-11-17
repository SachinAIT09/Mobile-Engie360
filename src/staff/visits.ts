import type { Activity } from '../../shared/contract';
import type { Text } from '../lib/i18n';

/**
 * One visit to the customer app: everything the customer did in one sitting, as a service agent
 * wants to read it ("this morning, 4 minutes: changed the installment, looked at Billing and Home")
 * instead of a raw event log.
 */
export interface Visit {
  id: string;
  start: string;
  end: string;
  /** What the customer changed or asked, oldest first, repeats removed. */
  actions: Activity[];
  /** Screens looked at, in order of first view, repeats removed. */
  screens: Text[];
}

/** A pause this long starts a new visit. */
export const VISIT_GAP_MS = 30 * 60_000;

const screenName = (a: Activity): Text => ({ en: a.text.en.replace(/^Viewed /, ''), nl: a.text.nl.replace(/^Bekeek /, '') });

/**
 * Group the activity log (newest first) into visits (newest first). Staff's own messages are not
 * something the customer did, and signing in is implied by the visit itself, so both are left out.
 */
export function groupVisits(activity: Activity[]): Visit[] {
  const visits: Visit[] = [];
  const oldestFirst = activity.filter((a) => a.kind !== 'staff_message').sort((a, b) => a.ts.localeCompare(b.ts));
  let current: Visit | null = null;
  for (const a of oldestFirst) {
    if (!current || new Date(a.ts).getTime() - new Date(current.end).getTime() > VISIT_GAP_MS) {
      current = { id: a.id, start: a.ts, end: a.ts, actions: [], screens: [] };
      visits.push(current);
    }
    current.end = a.ts;
    if (a.kind === 'page') {
      const name = screenName(a);
      if (!current.screens.some((s) => s.en === name.en)) current.screens.push(name);
    } else if (a.kind !== 'session' && !current.actions.some((x) => x.kind === a.kind && x.text.en === a.text.en)) {
      current.actions.push(a);
    }
  }
  return visits.reverse();
}

/** Whole minutes a visit lasted (0 = under a minute). */
export const visitMinutes = (v: Visit) => Math.round((new Date(v.end).getTime() - new Date(v.start).getTime()) / 60_000);
