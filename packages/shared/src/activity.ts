import type { CustomerActivityCategory, CustomerActivityKind } from './types';

/** Category and short label for each customer-activity kind. Both apps read this. */
export const ACTIVITY_META: Record<CustomerActivityKind, { category: CustomerActivityCategory; label: string }> = {
  SIGNED_IN: { category: 'account', label: 'Signed in' },
  SIGNED_OUT: { category: 'account', label: 'Signed out' },
  CHANNELS_UPDATED: { category: 'account', label: 'Updated alert channels' },
  PAYMENT_MADE: { category: 'billing', label: 'Paid bill' },
  AUTOPAY_ON: { category: 'billing', label: 'Turned on AutoPay' },
  AUTOPAY_OFF: { category: 'billing', label: 'Turned off AutoPay' },
  ENROLLED: { category: 'program', label: 'Enrolled in program' },
  NOT_EV: { category: 'program', label: 'Said "not my EV"' },
  REMIND_LATER: { category: 'program', label: 'Asked to be reminded later' },
  MESSAGE_OPENED: { category: 'program', label: 'Opened message' },
  MESSAGE_DECLINED: { category: 'program', label: 'Declined offer' },
  FLEX_OPENED: { category: 'flex', label: 'Opened DR event' },
  FLEX_OPTED_IN: { category: 'flex', label: 'Opted in to DR event' },
  FLEX_OPTED_OUT: { category: 'flex', label: 'Opted out of DR event' },
  SMART_CHARGING_UPDATED: { category: 'charging', label: 'Changed smart charging' },
  CHARGING_BOOST: { category: 'charging', label: 'Boosted charging' },
  OUTAGE_REPORTED: { category: 'outage', label: 'Reported outage' },
  ASSISTANT_ASKED: { category: 'assistant', label: 'Asked the assistant' },
  VIEWED_BILL: { category: 'view', label: 'Viewed bill' },
  VIEWED_BILL_HISTORY: { category: 'view', label: 'Viewed bill history' },
  VIEWED_USAGE: { category: 'view', label: 'Viewed usage' },
  VIEWED_ENERGY: { category: 'view', label: 'Viewed energy' },
  VIEWED_FLEX_RESULT: { category: 'view', label: 'Viewed DR result' },
  VIEWED_PROGRAM: { category: 'view', label: 'Viewed program' },
};

export const ACTIVITY_CATEGORIES: { id: CustomerActivityCategory; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'program', label: 'EV program' },
  { id: 'flex', label: 'DR events' },
  { id: 'charging', label: 'Charging' },
  { id: 'outage', label: 'Outages' },
  { id: 'assistant', label: 'Assistant' },
  { id: 'view', label: 'Views' },
];

export function activityCategory(kind: CustomerActivityKind): CustomerActivityCategory {
  return ACTIVITY_META[kind].category;
}

export function activityLabel(kind: CustomerActivityKind): string {
  return ACTIVITY_META[kind].label;
}
