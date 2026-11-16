import type { CustomerActivityCategory, CustomerActivityKind } from './types';

/** Category and short label for each customer-activity kind. Both apps read this. */
export const ACTIVITY_META: Record<CustomerActivityKind, { category: CustomerActivityCategory; label: string }> = {
  SIGNED_IN: { category: 'account', label: 'Signed in' },
  SIGNED_OUT: { category: 'account', label: 'Signed out' },
  CHANNELS_UPDATED: { category: 'account', label: 'Updated alert channels' },
  CONTACT_UPDATED: { category: 'account', label: 'Changed contact details' },
  PREFERENCES_UPDATED: { category: 'account', label: 'Changed notification preferences' },
  LANGUAGE_CHANGED: { category: 'account', label: 'Changed language' },
  PAYMENT_MADE: { category: 'billing', label: 'Paid invoice (iDEAL)' },
  AUTOPAY_ON: { category: 'billing', label: 'Turned on direct debit' },
  AUTOPAY_OFF: { category: 'billing', label: 'Turned off direct debit' },
  INSTALLMENT_CHANGED: { category: 'billing', label: 'Changed monthly installment' },
  INVOICE_DOWNLOADED: { category: 'billing', label: 'Downloaded invoice' },
  ENROLLED: { category: 'program', label: 'Joined Slim Laden' },
  NOT_EV: { category: 'program', label: 'Said "not my EV"' },
  REMIND_LATER: { category: 'program', label: 'Asked to be reminded later' },
  MESSAGE_OPENED: { category: 'program', label: 'Opened message' },
  MESSAGE_DECLINED: { category: 'program', label: 'Declined offer' },
  SAVINGS_PLAN_UPDATED: { category: 'program', label: 'Updated savings plan' },
  FLEX_OPENED: { category: 'flex', label: 'Opened flex request' },
  FLEX_OPTED_IN: { category: 'flex', label: 'Agreed to shift charging' },
  FLEX_OPTED_OUT: { category: 'flex', label: 'Opted out of flex request' },
  SMART_CHARGING_UPDATED: { category: 'charging', label: 'Changed smart charging' },
  CHARGING_BOOST: { category: 'charging', label: 'Boosted charging' },
  ASSISTANT_ASKED: { category: 'assistant', label: 'Asked the assistant' },
  ASSISTANT_HANDOFF: { category: 'assistant', label: 'Assistant handed over to customer service' },
  VIEWED_BILLING: { category: 'view', label: 'Viewed invoices' },
  VIEWED_INVOICE: { category: 'view', label: 'Viewed an invoice' },
  VIEWED_USAGE: { category: 'view', label: 'Viewed usage' },
  VIEWED_ENERGY: { category: 'view', label: 'Viewed Slim Energie' },
  VIEWED_INSIGHTS: { category: 'view', label: 'Viewed insights' },
  VIEWED_FLEX_RESULT: { category: 'view', label: 'Viewed flex result' },
  VIEWED_PROGRAM: { category: 'view', label: 'Viewed Slim Laden' },
};

export const ACTIVITY_CATEGORIES: { id: CustomerActivityCategory; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'program', label: 'Offers & program' },
  { id: 'flex', label: 'Flex events' },
  { id: 'charging', label: 'Charging' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'view', label: 'Views' },
];

export function activityCategory(kind: CustomerActivityKind): CustomerActivityCategory {
  return ACTIVITY_META[kind].category;
}

export function activityLabel(kind: CustomerActivityKind): string {
  return ACTIVITY_META[kind].label;
}
