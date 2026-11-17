import { BellRing, CarFront, CreditCard, Download, Eye, Mail, MessageSquareText, Repeat, Send, SlidersHorizontal, Target, UserRound, type LucideIcon } from 'lucide-react';
import type { ActivityKind } from '../../shared/contract';
import type { Lang, Text } from '../lib/i18n';
import { customer } from '../data/customer';
import { DEMO_TZ } from '../lib/time';

export const STAFF_NAME = 'Lotte';

/** The one customer whose app is real (the phone in the demo); everyone else is sample data. */
export const LIVE_CUSTOMER_ID = customer.id;

export const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  session: UserRound,
  page: Eye,
  installment: SlidersHorizontal,
  payment: CreditCard,
  autopay: Repeat,
  invoice_download: Download,
  chat: MessageSquareText,
  plan: Target,
  charging: CarFront,
  contact: Mail,
  message_read: Mail,
  push_subscribed: BellRing,
  staff_message: Send,
};

/** Activity kinds that are worth a second look (the customer changed something). */
export const ACTION_KINDS: ReadonlySet<ActivityKind> = new Set(['installment', 'payment', 'autopay', 'plan', 'charging', 'contact', 'push_subscribed', 'invoice_download']);

/** Filter groups on the Customer activity page (the Hydro "All / Account / Billing / …" pills). */
export const CATEGORIES: { id: string; label: Text; kinds: ActivityKind[] }[] = [
  { id: 'account', label: { en: 'Account', nl: 'Account' }, kinds: ['session', 'contact', 'push_subscribed'] },
  { id: 'billing', label: { en: 'Billing', nl: 'Betalen' }, kinds: ['installment', 'payment', 'autopay', 'invoice_download'] },
  { id: 'savings', label: { en: 'Savings & charging', nl: 'Besparen & laden' }, kinds: ['plan', 'charging'] },
  { id: 'eva', label: { en: 'Eva', nl: 'Eva' }, kinds: ['chat'] },
  { id: 'messages', label: { en: 'Messages', nl: 'Berichten' }, kinds: ['staff_message', 'message_read'] },
  { id: 'views', label: { en: 'Views', nl: 'Weergaven' }, kinds: ['page'] },
];

/** Short action label for the activity table ("CHANGED INSTALLMENT"). */
export const KIND_LABEL: Record<ActivityKind, Text> = {
  session: { en: 'Signed in', nl: 'Ingelogd' },
  page: { en: 'Viewed', nl: 'Bekeken' },
  installment: { en: 'Installment', nl: 'Termijnbedrag' },
  payment: { en: 'Payment', nl: 'Betaling' },
  autopay: { en: 'Automatic payment', nl: 'Automatisch betalen' },
  invoice_download: { en: 'Invoice', nl: 'Nota' },
  chat: { en: 'Asked Eva', nl: 'Vroeg Eva' },
  plan: { en: 'Savings plan', nl: 'Bespaarplan' },
  charging: { en: 'Smart charging', nl: 'Slim laden' },
  contact: { en: 'Details', nl: 'Gegevens' },
  message_read: { en: 'Read message', nl: 'Bericht gelezen' },
  push_subscribed: { en: 'Notifications on', nl: 'Meldingen aan' },
  staff_message: { en: 'Message sent', nl: 'Bericht verstuurd' },
};

export function clock(iso: string, lang: Lang): string {
  // Amsterdam time, like every other time in the demo.
  return new Date(iso).toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: DEMO_TZ });
}

export function ago(iso: string | null, lang: Lang, now: number): string {
  if (!iso) return lang === 'nl' ? 'nog niet gezien' : 'not seen yet';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return lang === 'nl' ? 'zojuist' : 'just now';
  const rtf = new Intl.RelativeTimeFormat(lang === 'nl' ? 'nl-NL' : 'en-GB', { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}
