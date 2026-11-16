import { CreditCard, Gauge, Headset, Home, LayoutGrid, Lightbulb, MessageCircle, Smartphone, User, Zap, type LucideIcon } from 'lucide-react';

/** Portal navigation. `to` is a route inside the portal (/app); `href` is a full-page link outside it. */
export interface NavItem {
  to: string;
  icon: LucideIcon;
  en: string;
  nl: string;
  tag?: string;
  href?: string;
  newTab?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', icon: Home, en: 'Home', nl: 'Home' },
  { to: '/energy', icon: Gauge, en: 'Energy consumption', nl: 'Energieverbruik' },
  { to: '/billing', icon: CreditCard, en: 'Bills & payments', nl: 'Nota’s & betalingen' },
  { to: '/insights', icon: Lightbulb, en: 'Energy insights', nl: 'Energie-inzichten' },
  { to: '/smart-energy', icon: Zap, en: 'Smart Energy', nl: 'Slimme Energie', tag: 'N2G' },
  { to: '/assistant', icon: MessageCircle, en: 'Eva · AI assistant', nl: 'Eva · AI-assistent' },
  { to: '/account', icon: User, en: 'My account', nl: 'Mijn account' },
];

export const DEMO_NAV: NavItem[] = [
  { to: '/mobile-preview', icon: Smartphone, en: 'Mobile preview', nl: 'Mobiele preview' },
  { to: '/staff', href: '/staff', newTab: true, icon: Headset, en: 'Customer Service view', nl: 'Klantenservice-weergave' },
  { to: '/start', href: '/', icon: LayoutGrid, en: 'Start page', nl: 'Startpagina' },
];
