import { CreditCard, Gauge, Home, User, type LucideIcon } from 'lucide-react';
import type { Text } from '../lib/i18n';

/** Customer app bottom tabs (the Eva button sits in the middle). Routes are inside the portal (/app). */
export interface Tab {
  to: string;
  icon: LucideIcon;
  label: Text;
  /** Other routes that keep this tab highlighted (its sub-pages). */
  also?: string[];
}

export const TABS: Tab[] = [
  { to: '/', icon: Home, label: { en: 'Home', nl: 'Home' } },
  { to: '/energy', icon: Gauge, label: { en: 'Energy', nl: 'Energie' }, also: ['/insights', '/smart-energy'] },
  { to: '/billing', icon: CreditCard, label: { en: 'Billing', nl: 'Betalen' } },
  { to: '/account', icon: User, label: { en: 'Profile', nl: 'Profiel' } },
];

/** Screens opened from a tab: shown with a back arrow and a title in the app bar. */
export const SUB_PAGES: Record<string, { title: Text; back: string }> = {
  '/insights': { title: { en: 'Energy insights', nl: 'Energie-inzichten' }, back: '/energy' },
  '/smart-energy': { title: { en: 'Smart Energy', nl: 'Slimme Energie' }, back: '/energy' },
  '/assistant': { title: { en: 'Eva', nl: 'Eva' }, back: '/' },
};
