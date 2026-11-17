/**
 * The contract between the ENGIE360 frontend (src/) and server (server/).
 * REST paths, request/response shapes and live (SSE) events. Both sides import only from here;
 * changes are agreed between the two owners first (see PLAN.md).
 *
 * Domain types are re-exported from the mock-up's data modules so there is one source of truth.
 * This file must stay type-only apart from the constants below (no runtime imports).
 */
import type { Text } from '../src/lib/i18n';
import type { Customer, Contract } from '../src/data/customer';
import type { BreakdownItem, UsagePoint } from '../src/data/energy';
import type { Invoice, Payment } from '../src/data/billing';
import type { Insight, Notification as SeedNotification } from '../src/data/insights';
import type { AssistantContext, AssistantReply } from '../src/assistant/types';

export type { Text, Customer, Contract, UsagePoint, BreakdownItem, Invoice, Payment, Insight, AssistantContext, AssistantReply };

// ---------------------------------------------------------------- REST paths

export const API = {
  health: '/api/health',

  // customer
  customer: '/api/customer',
  energy: '/api/energy',
  billing: '/api/billing',
  installment: '/api/installment',
  pay: '/api/billing/pay',
  autopay: '/api/billing/autopay',
  insights: '/api/insights',
  insightsPlan: '/api/insights/plan',
  messages: '/api/messages',
  messageRead: (id: string) => `/api/messages/${encodeURIComponent(id)}/read`,
  messagesReadAll: '/api/messages/read-all',
  assistant: '/api/assistant',
  activity: '/api/activity',
  charging: '/api/charging',
  contact: '/api/contact',

  // staff (ENGIE customer service)
  staffOverview: '/api/staff/overview',
  staffActivity: '/api/staff/activity',
  staffConversations: '/api/staff/conversations',
  staffMessages: '/api/staff/messages',
  staffTemplates: '/api/staff/templates',
  staffAttention: '/api/staff/attention',
  staffOutbox: '/api/staff/outbox',
  staffOutboxCancel: (id: string) => `/api/staff/outbox/${encodeURIComponent(id)}/cancel`,
  staffAssistant: '/api/staff/assistant',
  staffAudit: '/api/staff/audit',
  staffReports: '/api/staff/reports',
  staffPortfolio: '/api/staff/portfolio',
  staffFeed: '/api/staff/feed',
  staffCustomers: '/api/staff/customers',
  staffCustomer: (id: string) => `/api/staff/customers/${encodeURIComponent(id)}`,

  // push
  pushKey: '/api/push/key',
  pushSubscribe: '/api/push/subscribe',
  pushUnsubscribe: '/api/push/unsubscribe',

  // demo
  demoInfo: '/api/demo/info',
  demoReset: '/api/demo/reset',

  /** Server-Sent Events stream; `?role=customer|staff`. */
  events: '/api/events',
} as const;

/** Error body for any non-2xx response. Success bodies are the plain response types below. */
export interface ApiError {
  error: { message: string; code?: string };
}

// ---------------------------------------------------------------- customer

export interface InstallmentState {
  current: number;
  advised: number;
  /** A change the customer confirmed; takes effect from `from` (YYYY-MM). */
  pending: { amount: number; from: string; changedAt: string } | null;
}

/** GET /api/customer */
export interface CustomerResponse {
  customer: Customer;
  contract: Contract;
  installment: InstallmentState;
  /** The demo clock ("now") as an ISO instant. */
  demoNow: string;
}

/** GET /api/energy: everything the usage screens need (static demo data). */
export interface EnergyResponse {
  monthly: UsagePoint[];
  daily: UsagePoint[];
  weekly: UsagePoint[];
  hourly: UsagePoint[];
  tomorrowPrices: { hour: number; price: number }[];
  thisMonth: { label: Text; daysElapsed: number; daysInMonth: number; electricity: number; gas: number; forecastElectricity: number; forecastGas: number; prevElectricity: number; prevGas: number; costSoFar: number; forecastCost: number };
  lastMonth: { label: Text; electricity: number; gas: number; ev: number; elecVsPrevMonthPct: number; elecVsLastYearPct: number; gasVsLastYearPct: number; cost: number; prevCost: number };
  peakSplit: { peakPct: number; offPeakPct: number; peakKwh: number; offPeakKwh: number; peakEvPct: number };
  breakdown: BreakdownItem[];
  benchmark: { similarHomesKwh: number; similarHomesM3: number; baseloadW: number; similarBaseloadW: number };
}

/** How the customer pays: automatic collection on or off, and the invoices they paid themselves in the app. */
export interface PayState {
  autopay: boolean;
  /** Payments made in the app, newest first. */
  paid: Payment[];
}

export type PayMethod = 'ideal' | 'account' | 'card';

/** POST /api/billing/pay → PayState. Simulated: no money moves. */
export interface PayRequest {
  invoiceId: string;
  method: PayMethod;
  /** Bank chosen for iDEAL. */
  bank?: string;
}

/** POST /api/billing/autopay → PayState */
export interface AutopayRequest {
  on: boolean;
}

/** GET /api/billing. `invoices` and `payments` already reflect `pay` (see `withPayments` in src/data/billing.ts). */
export interface BillingResponse {
  invoices: Invoice[];
  payments: Payment[];
  annualOverview: { year: Text; paidSoFar: number; estimatedTotal: number; installmentsTotal: number; expectedSettlement: number };
  installment: InstallmentState;
  pay: PayState;
}

/** POST /api/installment → InstallmentState */
export interface InstallmentRequest {
  amount: number;
}

/** GET /api/insights */
export interface InsightsResponse {
  insights: Insight[];
  /** Insight ids in the customer's savings plan. */
  plan: string[];
}

/** POST /api/insights/plan → InsightsResponse['plan'] */
export interface PlanRequest {
  id: string;
  on: boolean;
}

/** POST /api/charging → 204. Smart-charging schedule switched on/off (shown to staff). */
export interface ChargingRequest {
  active: boolean;
  kwh: number;
  readyBy: number;
}

/** POST /api/contact → 204 */
export interface ContactRequest {
  email: string;
  phone: string;
}

// ---------------------------------------------------------------- messages (inbox + staff → customer)

export type MessageSource = 'system' | 'staff';
export type MessageIcon = SeedNotification['icon'];

export interface InboxMessage {
  id: string;
  source: MessageSource;
  icon: MessageIcon;
  title: Text;
  body: Text;
  /** In-app route to open, e.g. "/smart-energy". */
  to: string;
  createdAt: string;
  read: boolean;
  /** Staff messages: who sent it ("Lotte · ENGIE Klantenservice"). */
  sender?: string;
}

/** GET /api/messages → InboxMessage[] (newest first). POST read / read-all → 204. */

// ---------------------------------------------------------------- assistant (Eva, scripted, server-side)

/** POST /api/assistant → AssistantReply */
export interface AssistantRequest {
  question: string;
  context: AssistantContext;
  /** Stable per browser tab session; groups a conversation for the staff view. */
  conversationId: string;
}

export interface ChatLogEntry {
  role: 'user' | 'assistant';
  text: string;
  /** Matched intent on assistant entries ("BILL_WHY_HIGH", "FALLBACK"…). */
  intent?: string;
  ts: string;
}

export interface Conversation {
  id: string;
  lang: 'en' | 'nl';
  startedAt: string;
  updatedAt: string;
  entries: ChatLogEntry[];
}

/** GET /api/staff/conversations → Conversation[] (most recent first). */

// ---------------------------------------------------------------- activity (customer → staff)

export type ActivityKind =
  | 'session'
  | 'page'
  | 'installment'
  | 'payment'
  | 'autopay'
  | 'invoice_download'
  | 'chat'
  | 'plan'
  | 'charging'
  | 'contact'
  | 'message_read'
  | 'push_subscribed'
  | 'staff_message';

export interface Activity {
  id: string;
  ts: string;
  kind: ActivityKind;
  /** Human-readable, bilingual ("Changed installment to €198 from December"). */
  text: Text;
  /** Optional route the staff view can link to. */
  to?: string;
  /** Whose activity it is (set on the staff feed, which covers every customer). */
  customerId?: string;
  customerName?: string;
}

/** POST /api/activity → 204. The server writes the text for known kinds; `page` sends the route. */
export interface ActivityRequest {
  kind: ActivityKind;
  route?: string;
  text?: Text;
}

/** GET /api/staff/activity → Activity[] (newest first, max 100). */

// ---------------------------------------------------------------- staff

/** GET /api/staff/overview */
export interface StaffOverview {
  customer: Customer;
  contract: Contract;
  installment: InstallmentState;
  kpis: { electricityThisMonth: number; gasThisMonth: number; costSoFar: number; expectedSettlement: number; savingsPlanPerYear: number };
  plan: string[];
  /** Phones/browsers with push enabled for this customer. */
  pushDevices: number;
  unreadMessages: number;
  /** Last activity from the customer, or null. */
  lastSeen: string | null;
  /** Customer app tabs connected to the live stream right now. */
  online: number;
}

export interface MessageTemplate {
  id: string;
  icon: MessageIcon;
  title: Text;
  body: Text;
  to: string;
}

/** GET /api/staff/templates → MessageTemplate[] */

/** POST /api/staff/messages → StaffMessageResult */
export interface StaffMessageRequest {
  title: Text;
  body: Text;
  icon?: MessageIcon;
  to?: string;
  /** Also send a web-push notification to the customer's subscribed devices. */
  push: boolean;
  sender?: string;
  /** The template this message started from, so the dashboard knows the customer was contacted about it. */
  templateId?: string;
  /** Send later: an ISO instant up to 48 hours ahead. Omitted → sent at once. */
  sendAt?: string;
  /** Send to everyone with this attention point instead of one customer. */
  segment?: AttentionFlag;
  /** Send to this customer (default: the live demo customer). */
  customerId?: string;
}

export interface StaffMessageResult {
  /** The inbox message, or null when it was scheduled for later. */
  message: InboxMessage | null;
  /** Devices the push was delivered to (0 when push was off or none subscribed). */
  pushed: number;
  outbox: OutboxItem;
}

export type OutboxStatus = 'scheduled' | 'sent' | 'cancelled';

/** What can need attention for a customer; also the segments a message can go to. */
export type AttentionFlag = 'installment' | 'ev-peak' | 'night-use';

/** One message staff sent or scheduled, with its delivery status. */
export interface OutboxItem {
  id: string;
  templateId?: string;
  title: Text;
  body: Text;
  icon: MessageIcon;
  to: string;
  push: boolean;
  sender?: string;
  status: OutboxStatus;
  createdAt: string;
  /** When it is (or was) due. */
  sendAt: string;
  sentAt?: string;
  /** Phones the notification reached. */
  pushed?: number;
  /** When the customer opened it in the app. */
  readAt?: string;
  /** The inbox message it became. */
  messageId?: string;
  /** A message to a whole segment: who it went to and how many opened it so far. */
  audience?: {
    segment: AttentionFlag;
    label: Text;
    count: number;
    /** Reached the app inbox. */
    delivered: number;
    /** Opened it. */
    read: number;
    /** Did what the message asked (raised the installment, switched on smart charging…). */
    acted: number;
    includesLive: boolean;
    /** Final numbers from an earlier campaign (not updated any more). */
    final?: boolean;
  };
  /** A message to one customer other than the live demo customer. */
  customer?: { id: string; name: string };
}

/** GET /api/staff/outbox → OutboxItem[] (newest first). POST …/cancel → OutboxItem. */

/** Something about the customer that staff should look at, with a suggested action. */
export interface AttentionItem {
  id: string;
  icon: MessageIcon;
  tone: 'warn' | 'alert' | 'info';
  title: Text;
  detail: Text;
  /** open → nothing done yet; contacted → staff sent the suggested message; done → resolved. */
  status: 'open' | 'contacted' | 'done';
  /** What happened, for contacted/done. */
  note?: Text;
  /** Suggested message (a MessageTemplate id) for the composer. */
  templateId?: string;
  /** Or a staff page to open. */
  to?: string;
}

/** GET /api/staff/attention → AttentionItem[] (open first). */

/** One row of the customer list. */
export interface CustomerSummary {
  id: string;
  customerNo: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  city: string;
  product: Text;
  installment: number;
  advised: number;
  hasEv: boolean;
  /** Open attention points. */
  flags: AttentionFlag[];
  appUser: boolean;
  pushOn: boolean;
  lastSeen: string | null;
  online: boolean;
  /** The live demo customer (the phone in the demo). */
  live: boolean;
}

export type CustomerFilter = 'all' | 'attention' | 'online' | AttentionFlag;

/** GET /api/staff/customers?q=&filter=&page=&size= (size: 10, 15, 30 or 50; default 10) */
export interface CustomersResponse {
  total: number;
  matched: number;
  page: number;
  pageSize: number;
  rows: CustomerSummary[];
}

/** GET /api/staff/customers/:id: everything the customer page shows. */
export interface CustomerDetail {
  summary: CustomerSummary;
  overview: StaffOverview;
  attention: AttentionItem[];
  /** Their activity, newest first. */
  activity: Activity[];
  /** Yearly usage relative to the sample usage data (1 = the same); scales the charts. */
  usageScale: number;
}

/** An attention point across the whole customer base. */
export interface QueueItem {
  id: AttentionFlag | 'eva-agent';
  icon: MessageIcon;
  tone: 'warn' | 'alert' | 'info';
  title: Text;
  detail: Text;
  /** Customers it applies to now. */
  count: number;
  /** Of those, how many were already sent the suggested message. */
  contacted: number;
  templateId?: string;
  to?: string;
}

/** GET /api/staff/portfolio: the customer base at a glance. */
export interface Portfolio {
  customers: number;
  appUsers: number;
  onlineNow: number;
  activeToday: number;
  needAttention: number;
  queue: QueueItem[];
  /** Actions in the app today, per hour (Amsterdam time), up to the current hour. */
  byHour: { hour: number; actions: number }[];
  products: { label: Text; count: number }[];
  installments: { onTrack: number; tooLow: number };
  messages: { sent: number; read: number };
}

/** GET /api/staff/reports?months=&city=&product=&group= (months: 3, 6, 12, or "week" for the last 7 days) : reports for the whole customer base or a selection of it. */
export type ReportGroup = 'all' | 'app' | 'ev' | 'attention';
export interface ReportsResponse {
  /** What can be filtered on, and how many customers the current selection has. */
  scope: { customers: number; total: number; cities: string[]; products: Text[] };
  kpis: { customers: number; appUsers: number; activePct: number; needAttention: number; avgInstallment: number; shortfallPerYear: number; readPct: number };
  /** Whether `months` holds one point per month or (for the last 7 days) per day. */
  per: 'month' | 'day';
  /** One point per month or day, oldest first. */
  months: { key: string; label: Text; electricityMwh: number; gasKm3: number; costK: number; installmentsK: number; activeUsers: number }[];
  attention: { id: AttentionFlag; label: Text; count: number }[];
  cities: { city: string; customers: number; attention: number; tooLow: number; evPeak: number }[];
  funnel: { sent: number; delivered: number; opened: number; acted: number };
  campaigns: { id: string; title: Text; audience: Text; sentAt: string; sent: number; delivered: number; opened: number; acted: number }[];
}

/** GET /api/staff/feed → Activity[] across all customers (newest first, things customers did, not screen views). */

export type AuditAction = 'MESSAGE_SENT' | 'MESSAGE_SCHEDULED' | 'MESSAGE_CANCELLED' | 'MESSAGE_DISPATCHED' | 'ALERT_SENT' | 'CUSTOMER_VIEWED' | 'REPORT_EXPORTED' | 'STAFF_SIGNED_IN' | 'DEMO_RESET';

/** POST /api/staff/audit → 204. Things staff do in the browser that belong in the audit trail. */
export interface AuditRequest {
  action: 'CUSTOMER_VIEWED' | 'REPORT_EXPORTED';
  /** The customer's name, or the report that was exported. */
  target: string;
}

/** One line of the audit log: who did what to the customer's account, and when. */
export interface AuditEntry {
  id: string;
  at: string;
  actor: { kind: 'STAFF' | 'SYSTEM'; name: string; role: Text };
  action: AuditAction;
  /** What it was done to (a message title, "Demo data"). */
  target: Text;
  summary: Text;
}

/** GET /api/staff/audit → AuditEntry[] (newest first, max 100). */

/** POST /api/staff/assistant → AssistantReply. Scripted, like Eva, but answers staff questions about the customer. */
export interface StaffAssistantRequest {
  question: string;
  lang: 'en' | 'nl';
  lastIntent?: string;
}

// ---------------------------------------------------------------- push

/** GET /api/push/key */
export interface PushKeyResponse {
  publicKey: string;
}

/** POST /api/push/subscribe → 204. `subscription` is PushSubscription.toJSON(). */
export interface PushSubscribeRequest {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  device?: string;
}

/** POST /api/push/unsubscribe → 204 */
export interface PushUnsubscribeRequest {
  endpoint: string;
}

/** What the service worker receives (JSON in the push message). */
export interface PushPayload {
  title: string;
  body: string;
  /** Route to open on click. */
  url: string;
  tag?: string;
}

// ---------------------------------------------------------------- demo

/** GET /api/demo/info */
export interface DemoInfo {
  /** URLs a phone on the same network can open (LAN), or the public URL when hosted. */
  phoneUrls: string[];
  startedAt: string;
  version: string;
  pushEnabled: boolean;
}

/** POST /api/demo/reset → 204. Restores seed data, clears conversations/activity/messages; emits `demo:reset`. */

// ---------------------------------------------------------------- live events (SSE)

/**
 * GET /api/events?role=customer|staff. Each SSE message has `event: <type>` and `data: <JSON of LiveEvent>`.
 * Customer streams receive: message:new, message:read, installment:changed, billing:changed, insights:plan, demo:reset.
 * Staff streams receive everything.
 */
export type LiveEvent =
  | { type: 'hello'; serverTime: string; role: 'customer' | 'staff' }
  | { type: 'activity'; activity: Activity }
  /** `banner: true` → the customer app shows it as an in-app banner/toast immediately. */
  | { type: 'message:new'; message: InboxMessage; banner: boolean }
  | { type: 'message:read'; id: string | 'all' }
  | { type: 'installment:changed'; installment: InstallmentState }
  /** The customer paid an invoice or switched automatic payment on or off. */
  | { type: 'billing:changed'; pay: PayState }
  | { type: 'insights:plan'; plan: string[] }
  | { type: 'chat:message'; conversationId: string; entry: ChatLogEntry }
  | { type: 'presence'; online: number }
  /** Staff only: the outbox (sent/scheduled messages) changed. */
  | { type: 'outbox:changed' }
  /** Staff only: a new audit log entry. */
  | { type: 'audit:new'; entry: AuditEntry }
  /** Staff only: another customer did something (the cross-customer feed). */
  | { type: 'feed'; activity: Activity }
  | { type: 'demo:reset' };

export type LiveEventType = LiveEvent['type'];

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = [
  'hello',
  'activity',
  'message:new',
  'message:read',
  'installment:changed',
  'billing:changed',
  'insights:plan',
  'chat:message',
  'presence',
  'outbox:changed',
  'audit:new',
  'feed',
  'demo:reset',
];
