import { createContext, useContext } from 'react';
import type { ActivityKind, ChargingRequest, ContactRequest, InboxMessage, InstallmentState } from '../../shared/contract';
import { contract } from '../data/customer';
import { notificationsSeed } from '../data/insights';
import { DEMO_NOW } from '../lib/time';

/** The parts of the customer's account that change during a demo, kept in sync with the server. */
export interface LiveData {
  /** True while the server answers; false = running on local demo data only. */
  online: boolean;
  installment: InstallmentState;
  /** Insight ids in the savings plan. */
  plan: string[];
  /** Inbox, newest first. */
  messages: InboxMessage[];
  /** Bumped when the demo is reset, so screens remount with fresh state. */
  resetVersion: number;
  setInstallment: (amount: number) => Promise<void>;
  togglePlan: (id: string, on: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  saveContact: (c: ContactRequest) => void;
  saveCharging: (c: ChargingRequest) => void;
  /** Tell staff what the customer did (page views, downloads). Fire and forget. */
  track: (kind: ActivityKind, route?: string) => void;
  /** Restore the starting data on the server (or locally when offline). */
  resetDemo: () => Promise<void>;
}

const HOUR = 3600000;
/** How long ago each seeded notification arrived, matching its "5 days ago" label in the mock-up. */
const SEED_AGE_H = [5 * 24, 1, 2 * 24, 31 * 24];

/** Starting state when no server is reachable: the mock-up's own data. */
export const localDefaults = (): Pick<LiveData, 'installment' | 'plan' | 'messages'> => ({
  installment: { current: contract.installment, advised: contract.advisedInstallment, pending: null },
  plan: ['ev-peak'],
  messages: notificationsSeed.map((n, i) => ({
    id: n.id,
    source: 'system',
    icon: n.icon,
    title: n.title,
    body: n.body,
    to: n.to,
    createdAt: new Date(DEMO_NOW.getTime() - (SEED_AGE_H[i] ?? 24) * HOUR).toISOString(),
    read: !n.unread,
  })),
});

export const LiveCtx = createContext<LiveData | null>(null);

export function useLive(): LiveData {
  const v = useContext(LiveCtx);
  if (!v) throw new Error('useLive must be used inside LiveProvider');
  return v;
}

/** The installment that applies now: a confirmed change counts from its start month, shown as "new". */
export function effectiveInstallment(i: InstallmentState): number {
  return i.pending?.amount ?? i.current;
}
