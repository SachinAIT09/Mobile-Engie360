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
import type { AssistantContext, AssistantReply, Audience } from '../src/assistant/types';

export type { Text, Customer, Contract, UsagePoint, BreakdownItem, Invoice, Payment, Insight, AssistantContext, AssistantReply, Audience };

// ---------------------------------------------------------------- REST paths

export const API = {
  health: '/api/health',

  // customer
  customer: '/api/customer',
  energy: '/api/energy',
  billing: '/api/billing',
  installment: '/api/installment',
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

/** GET /api/billing */
export interface BillingResponse {
  invoices: Invoice[];
  payments: Payment[];
  annualOverview: { year: Text; paidSoFar: number; estimatedTotal: number; installmentsTotal: number; expectedSettlement: number };
  installment: InstallmentState;
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

export type ChatChannel = 'portal' | 'website';

/** POST /api/assistant → AssistantReply */
export interface AssistantRequest {
  question: string;
  context: AssistantContext;
  /** Stable per browser tab session; groups a conversation for the staff view. */
  conversationId: string;
  channel: ChatChannel;
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
  channel: ChatChannel;
  audience: Audience;
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
}

export interface StaffMessageResult {
  message: InboxMessage;
  /** Devices the push was delivered to (0 when push was off or none subscribed). */
  pushed: number;
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
 * Customer streams receive: message:new, message:read, installment:changed, insights:plan, demo:reset.
 * Staff streams receive everything.
 */
export type LiveEvent =
  | { type: 'hello'; serverTime: string; role: 'customer' | 'staff' }
  | { type: 'activity'; activity: Activity }
  /** `banner: true` → the customer app shows it as an in-app banner/toast immediately. */
  | { type: 'message:new'; message: InboxMessage; banner: boolean }
  | { type: 'message:read'; id: string | 'all' }
  | { type: 'installment:changed'; installment: InstallmentState }
  | { type: 'insights:plan'; plan: string[] }
  | { type: 'chat:message'; conversationId: string; channel: ChatChannel; entry: ChatLogEntry }
  | { type: 'presence'; online: number }
  | { type: 'demo:reset' };

export type LiveEventType = LiveEvent['type'];

export const LIVE_EVENT_TYPES: readonly LiveEventType[] = [
  'hello',
  'activity',
  'message:new',
  'message:read',
  'installment:changed',
  'insights:plan',
  'chat:message',
  'presence',
  'demo:reset',
];
