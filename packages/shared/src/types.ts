/**
 * API contract shared by apps/api, apps/web and apps/mobile.
 * All ids are strings (Mongo ObjectId hex). All timestamps are ISO-8601 strings.
 * Customer-facing copy that depends on the language is sent as `Text` ({ en, nl }).
 */
import type { Lang, Text } from './i18n';
import type { ApplianceKey, BreakdownItem, MonthSummary, ThisMonth, UsagePeriod, UsagePoint } from './usage';

export type Role = 'CUSTOMER' | 'STAFF';

export interface AuthUser {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  /** Present when role === 'CUSTOMER'. */
  customerId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ---------------------------------------------------------------- customer

export type EvStatus = 'NONE' | 'DETECTED_NOT_ENROLLED' | 'ENROLLED';

export interface Channels {
  push: boolean;
  sms: boolean;
  email: boolean;
}

/** Which notifications the customer wants (Account → Notifications). */
export interface Preferences {
  usageAlerts: boolean;
  priceAlerts: boolean;
  invoiceReady: boolean;
  tips: boolean;
}

export type ProductId = 'DYNAMIC' | 'DYNAMIC_FIXED_GAS' | 'FIXED' | 'VARIABLE';

export interface Contract {
  product: ProductId;
  productName: Text;
  startDate: string;
  /** End of the fixed gas (or fixed electricity) price, null when not fixed. */
  fixedUntil: string | null;
  electricity: { type: Text; origin: Text; avgPrice: number; ean: string };
  gas: { type: Text; price: number; ean: string };
  /** Fixed costs per month: delivery + network − energy tax reduction. */
  fixedPerMonth: number;
  installment: number;
  advisedInstallment: number;
  installmentRange: { min: number; max: number };
  /** Change of the installment that takes effect from `pendingFrom` (null when none). */
  pendingInstallment: number | null;
  pendingFrom: string | null;
  estimatedAnnualCost: number;
  annualUsage: { electricityKwh: number; gasM3: number };
  meter: { type: Text; lastReading: string; electricityT1: number; electricityT2: number; gas: number };
}

export interface CustomerProfile {
  id: string;
  customerNo: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  phone: string;
  street: string;
  postcode: string;
  city: string;
  /** Postcode area (PC4) the home is in, e.g. "3581". */
  districtCode: string;
  /** Grid congestion area, e.g. "UT-OOST". */
  gridAreaCode: string;
  gridOperator: string;
  household: { residents: number; homeType: Text; sizeM2: number };
  ibanMasked: string;
  memberSince: string;
  hasSolar: boolean;
  hasHeatPump: boolean;
  lang: Lang;
  channels: Channels;
  preferences: Preferences;
  /** Automatic collection of the monthly installment (direct debit). */
  autoPay: AutoPay;
  contract: Contract;
}

export interface AutoPay {
  enabled: boolean;
  /** Payment method charged when enabled, null when off. */
  method: PaymentMethodKind | null;
  /** ISO timestamp it was switched on, null when off. */
  since: string | null;
}
export interface AutoPayUpdateRequest {
  enabled: boolean;
  /** Required when enabled. */
  method?: PaymentMethodKind;
}

export interface ContactUpdateRequest {
  email: string;
  phone: string;
}

// ---------------------------------------------------------------- invoices

export type InvoiceKind = 'INSTALLMENT' | 'ANNUAL';
export type InvoiceStatus = 'PAID' | 'OPEN' | 'SCHEDULED';

export interface InvoiceLine {
  label: Text;
  amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  kind: InvoiceKind;
  period: Text;
  issued: string;
  due: string;
  amount: number;
  status: InvoiceStatus;
  paidOn: string | null;
  lines: InvoiceLine[];
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethodKind;
  invoiceId: string;
  invoiceNumber: string;
}

/** Contract-year overview: what was paid in advance vs the expected total. */
export interface AnnualOverview {
  year: Text;
  paidSoFar: number;
  monthsPaid: number;
  estimatedTotal: number;
  installmentsTotal: number;
  /** Expected settlement at the annual statement if the installment stays the same (+ = to pay). */
  expectedSettlement: number;
  /** Same, with the advised installment. */
  settlementWithAdvised: number;
}

export interface BillingOverview {
  installment: number;
  advisedInstallment: number;
  installmentRange: { min: number; max: number };
  pendingInstallment: number | null;
  pendingFrom: string | null;
  nextCollection: { date: string; amount: number };
  outstanding: { count: number; amount: number };
  annual: AnnualOverview;
  invoices: Invoice[];
  payments: PaymentRecord[];
}

export interface InstallmentUpdateRequest {
  amount: number;
}

// ---------------------------------------------------------------- summary

export interface ActiveFlexEventRef {
  id: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  status: FlexEventStatus;
  myResponse: FlexResponse | null;
}

export interface PriceNow {
  price: number;
  level: 'low' | 'normal' | 'high';
  cheapestHour: number;
  cheapestPrice: number;
}

export interface MeSummary {
  customer: CustomerProfile;
  billing: {
    installment: number;
    advisedInstallment: number;
    nextCollection: { date: string; amount: number };
    outstanding: { count: number; amount: number };
    expectedSettlement: number;
  };
  evStatus: EvStatus;
  evDetectedAt: string | null;
  heatPumpDetectedAt: string | null;
  program: Program;
  activeFlexEvent: ActiveFlexEventRef | null;
  unreadCount: number;
  unreadAlerts: number;
  unreadOffers: number;
  thisMonth: ThisMonth;
  lastMonth: MonthSummary;
  live: EnergyReading;
  priceNow: PriceNow;
  /** Top insights for Home. */
  insights: Insight[];
  /** Smart-charging snapshot for the Home screen; null when the customer has never turned it on. */
  smartCharging: {
    enabled: boolean;
    chargingNow: boolean;
    nextStart: string | null;
    savingsPerNight: number;
  } | null;
}

// ---------------------------------------------------------------- energy

export interface EnergyReading {
  ts: string;
  solarKw: number;
  gridImportKw: number;
  gridExportKw: number;
  homeKw: number; // total home load INCLUDING EV
  evKw: number;
  /** Net2Grid live split of the home load. */
  appliances: { key: ApplianceKey; kw: number }[];
  /** Dynamic price this hour, € / kWh. */
  price: number;
}

export type { UsagePeriod, UsagePoint, BreakdownItem, MonthSummary, ThisMonth };

export interface UsageSeriesResponse {
  period: UsagePeriod;
  points: UsagePoint[];
}

export interface UsageOverview {
  thisMonth: ThisMonth;
  lastMonth: MonthSummary;
  breakdown: BreakdownItem[];
  peakSplit: { peakPct: number; offPeakPct: number; peakKwh: number; offPeakKwh: number; peakEvPct: number };
  benchmark: { similarHomesKwh: number; similarHomesM3: number; similarBaseloadW: number };
  baseloadW: number;
  annual: { electricityKwh: number; gasM3: number };
  tomorrowPrices: { hour: number; price: number }[];
}

// ---------------------------------------------------------------- insights

export type InsightKind = 'alert' | 'saving' | 'tip' | 'billing';

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Icon name the apps map to their icon set. */
  icon: 'moon' | 'car' | 'clock' | 'plug' | 'wallet' | 'flame' | 'sun' | 'thermo' | 'zap' | 'leaf';
  title: Text;
  body: Text;
  /** € per year. */
  saving: number | null;
  /** Mobile route the CTA opens. */
  route: string | null;
  cta: Text | null;
  source: 'net2grid' | 'engie';
  /** Longer explanation for the savings plan. */
  detail: Text | null;
}

export interface InsightsResponse {
  insights: Insight[];
  totalSavings: number;
  plan: string[];
}

export interface SavingsPlanUpdateRequest {
  plan: string[];
}

// ---------------------------------------------------------------- smart charging

export type RatePlanId = 'DYNAMIC' | 'DUAL' | 'FIXED';

export interface SmartChargingSettings {
  enabled: boolean;
  /** Local time the car must be ready by, "HH:MM" on a 15-minute boundary. */
  readyBy: string;
  targetKwh: number;
  ratePlan: RatePlanId;
}

export interface ChargeSlot {
  start: string;
  end: string;
  kw: number;
  ratePerKwh: number;
  /** Rate period name, e.g. "goedkoop" | "dal". */
  period: string;
}

export interface SmartChargingPlan {
  settings: SmartChargingSettings;
  hasEv: boolean;
  /** Plug-in (18:00) → readyBy, the window the planner works in. */
  session: { start: string; end: string };
  slots: ChargeSlot[];
  plannedKwh: number;
  /** kWh the window cannot fit (target not reachable). */
  shortfallKwh: number;
  cost: number;
  /** Cost of charging immediately at plug-in. */
  baselineCost: number;
  savings: number;
  co2Kg: number;
  baselineCo2Kg: number;
  co2SavedKg: number;
  /** Flex windows the plan charges around. */
  avoidedFlexWindows: { start: string; end: string; title: string }[];
  chargingNow: boolean;
  nextStart: string | null;
  /** Set while a "Charge now" boost is running. */
  boostUntil: string | null;
  /** 24 hourly points for the plan chart. */
  hourly: { hour: string; kw: number; rate: number; period: string }[];
}

export interface SmartChargingUpdateRequest {
  enabled: boolean;
  readyBy: string;
  targetKwh: number;
  ratePlan: RatePlanId;
}

export interface RatePlanComparison {
  basisKwhPerMonth: number;
  plans: {
    id: RatePlanId;
    label: Text;
    monthlyCost: number;
    withSmartCharging: number;
    current: boolean;
    best: boolean;
  }[];
}

// ---------------------------------------------------------------- program / enrollment

export interface Program {
  id: string;
  name: Text;
  signupIncentive: Text;
  perEventIncentive: Text;
  maxEventsPerSeason: Text;
  typicalEventHours: Text;
  termsUrl: string;
  termsSummary: Text[];
}

export type EnrollmentSource = 'APP_POPUP' | 'CAMPAIGN' | 'LEGACY';
export type ChargerType = 'LEVEL_1' | 'LEVEL_2';

export interface EnrollRequest {
  source: EnrollmentSource;
  evMake?: string;
  chargerType?: ChargerType;
  /** Message that led to the enrollment (popup or campaign offer), for attribution. */
  messageId?: string;
  consent: boolean;
}

export interface Enrollment {
  id: string;
  customerId: string;
  programId: string;
  enrolledAt: string;
  source: EnrollmentSource;
  status: 'ACTIVE' | 'LEFT';
}

// ---------------------------------------------------------------- payments

export type PaymentMethodKind = 'DIRECT_DEBIT' | 'IDEAL' | 'TRANSFER';
export interface PaymentRequest {
  invoiceId: string;
  amount: number;
  method: PaymentMethodKind;
}
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethodKind;
  status: 'CONFIRMED';
  confirmationNo: string;
  provider: 'IDEAL_MOCK';
  createdAt: string;
}

// ---------------------------------------------------------------- messages

export type MessageKind =
  | 'EV_DETECTED'
  | 'HEAT_PUMP_DETECTED'
  | 'ENROLL_OFFER'
  | 'FLEX_REQUEST'
  | 'INSTALLMENT_ADVICE'
  | 'BILL'
  | 'USAGE'
  | 'PRICE'
  | 'METER'
  | 'CHARGING';
export type MessageAction = 'ENROLLED' | 'DECLINED' | 'DISMISSED' | 'REMIND_LATER' | 'NOT_EV' | 'RESPONDED' | 'INSTALLMENT_CHANGED';
/** Inbox filter chip a message belongs to. */
export type MessageCategory = 'Alerts' | 'Offers' | 'Billing';

export interface Message {
  id: string;
  customerId: string;
  kind: MessageKind;
  category: MessageCategory;
  /** Short pill text in the customer's language: "Netdrukte" | "Aanbod" | "Nota" | … */
  tag: string;
  title: string;
  body: string;
  cta: string | null;
  campaignId: string | null;
  flexEventId: string | null;
  /** Mobile route to open, e.g. "/messages/abc", "/flex-events/xyz", "/billing", "/program". */
  route: string;
  createdAt: string;
  openedAt: string | null;
  actedAt: string | null;
  action: MessageAction | null;
  /** A/B variant of the campaign copy this message carries (null/absent when not an A/B campaign). */
  variant?: VariantId | null;
}

export interface MessageActionRequest {
  action: Exclude<MessageAction, 'RESPONDED'>;
}

export interface LangUpdateRequest {
  lang: Lang;
}

// ---------------------------------------------------------------- flex events (grid congestion)

export type FlexEventStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED';
/** PAUSE = shift charging out of the window. */
export type FlexResponse = 'PAUSE' | 'REMIND' | 'OPT_OUT';

export interface FlexEvent {
  id: string;
  districtCode: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  status: FlexEventStatus;
  campaignId: string;
  /** Every district of a multi-district campaign (districtCode is the first). */
  districtCodes?: string[];
}

export interface FlexEventForCustomer {
  event: FlexEvent;
  myResponse: FlexResponse | null;
  currentEvKw: number;
  earnText: Text; // program.perEventIncentive
}

export interface FlexRespondRequest {
  response: FlexResponse;
}

export interface FlexEventResultMe {
  event: FlexEvent;
  myResponse: FlexResponse | null;
  earnedText: Text | null; // per-event credit when PAUSE, else null
  kwhShifted: number;
  peakReducedKw: number;
  /** 15-minute home-load series from 2h before to 2h after the window. */
  series: { t: string; kw: number }[];
  districtHouseholdsPaused: number;
  districtPeakReducedMw: number;
}

// ---------------------------------------------------------------- grid / district visibility

export interface StatsOverview {
  /** ENGIE portfolio in the demo areas. */
  customers: number;
  onDynamic: number;
  installmentGapCustomers: number;
  avgInstallmentGap: number;
  heatPumps: number;
  slimLadenHomes: number;
  gridAreas: number; // with detected EVs
  districts: number; // with matched EVs
  /** EVs in Slim Laden (flexible). */
  knownEvs: number;
  /** EVs Net2Grid detected that are not in Slim Laden. */
  unenrolledEvs: number;
  invisiblePct: number; // share of detected EVs not flexible, 0–100
  matchedPremises: number;
  noSignalPremises: number;
  noLocationPremises: number;
  deadGridAreas: number;
  partiallyDeadGridAreas: number;
  deadDistricts: number;
  deadDistrictPremises: number;
  dataSourceNote: string;
}

export interface GridAreaStat {
  code: string;
  /** Province, e.g. "Utrecht" | "Noord-Holland". */
  region: string;
  /** Grid operator, e.g. "Stedin". */
  operator: string;
  /** Display name, e.g. "Utrecht-Oost". */
  name: string;
  /** Congestion status from the grid operator. */
  congestion: 'NONE' | 'WATCH' | 'CONGESTED';
  evs: number;
  knownPct: number; // 0–100 integer
  penetrationPct: number; // one decimal
  districtCount: number;
  /** True when per-district data exists (the demo area). */
  interactive: boolean;
}

export interface DistrictStat {
  code: string;
  gridAreaCode: string;
  /** Neighbourhood name, e.g. "Oudwijk". */
  name: string;
  /** ENGIE customers with installment below the advice (null when not live). */
  installmentGap: number | null;
  evs: number;
  /** null when the split is not available for this district. */
  known: number | null;
  unenrolled: number | null;
  confirmedByEnrollment: number | null;
  groundTruthValidated: number | null;
  premises: number | null;
  penetrationPct: number | null;
  invisiblePct: number | null;
  forecastLoadPct: number | null;
}

export interface BlindSpot {
  rank: number;
  districtCode: string;
  gridAreaCode: string;
  /** Region of the gridArea (filled by the API; optional so pure ranking helpers can omit it). */
  region?: string;
  known: number;
  unenrolled: number;
  penetrationText: string; // "35.4% of 48"
  name?: string;
  gapPct: number; // 88.2
}

export interface DeadGridArea {
  code: string;
  districts: number;
  premises: number;
}

/** Staff reports page (GET /stats/reports). */
export interface ReportsSummary {
  generatedAt: string;
  enrollments: {
    active: number;
    bySource: Record<EnrollmentSource, number>;
    /** Daily enrollments, oldest first, one entry per day (zero-filled); date is "YYYY-MM-DD" in the demo timezone. */
    last30Days: { date: string; count: number }[];
    today: number;
  };
  flexProgram: {
    eventsEnded: number;
    householdsPaused: number;
    kwhShifted: number;
    peakReducedMw: number;
  };
  campaigns: {
    total: number;
    offers: number;
    flexRequests: number;
    installmentAdvice: number;
    testSends: number;
  };
  smartCharging: {
    homes: number;
    flexibleKw: number;
    shiftedKwhPerNight: number;
    peakAvoidedMw: number;
  };
}

export type LiveEventKind = 'EV_DETECTED' | 'EV_CLUSTER' | 'CONGESTION_FORECAST' | 'CAMPAIGN_SENT' | 'FLEX_EVENT_ENDED';

export interface LiveEvent {
  id: string;
  ts: string;
  kind: LiveEventKind;
  gridAreaCode: string;
  districtCode: string | null;
  /** Plain-text summary; the UI bolds nothing automatically. */
  summary: string;
  /** Optional emphasised prefix shown in bold before summary. */
  headline: string;
  count: number | null;
  unenrolledCount: number | null;
  enrolledCount: number | null;
  /** Set when the system already acted, e.g. "Onboarding message sent in app automatically". */
  actionTaken: string | null;
  /** Suggested next action for staff, used to build the button + prefill Campaign 360. */
  suggested: null | {
    label: string;
    campaignType: CampaignType;
    audience: CampaignAudience;
  };
}

// ---------------------------------------------------------------- Campaign 360

export type CampaignType = 'ENROLL_OFFER' | 'FLEX_REQUEST' | 'INSTALLMENT_ADVICE';
/** UNENROLLED_EV: detected EV, not in Slim Laden. ENROLLED_EV: in Slim Laden. INSTALLMENT_GAP: installment below the advice. */
export type CampaignSegment = 'UNENROLLED_EV' | 'ENROLLED_EV' | 'INSTALLMENT_GAP';

export type CampaignAudience =
  | { kind: 'DISTRICT'; districtCode: string; segment: CampaignSegment }
  | { kind: 'LIVE_EVENT'; liveEventId: string; segment: CampaignSegment }
  | { kind: 'DISTRICTS'; districtCodes: string[]; segment: CampaignSegment };

export type CampaignStatus = 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
export type VariantId = 'A' | 'B';

export interface CampaignVariantCopy {
  id: VariantId;
  title: string;
  body: string;
  cta: string;
}

export interface CampaignExclusions {
  optedOut: boolean;
  contactedLast7Days: boolean;
  lifeSupport: boolean;
}

export interface CampaignChannels {
  push: boolean;
  inApp: boolean;
  sms: boolean;
  email: boolean;
}

export interface AudiencePreviewRequest {
  audience: CampaignAudience;
  exclusions: CampaignExclusions;
}
export interface AudiencePreview {
  count: number;
  before: number; // before exclusions
  excluded: { optedOut: number; contactedLast7Days: number; lifeSupport: number };
  /** Human label, e.g. "SUB-01-F1 · Detected, unenrolled EVs". */
  label: string;
  includesDemoCustomer: boolean;
}

export interface CampaignCreateRequest {
  type: CampaignType;
  audience: CampaignAudience;
  exclusions: CampaignExclusions;
  title: string;
  body: string;
  cta: string;
  channels: CampaignChannels;
  /** sendAt (ISO) schedules the send when sendNow is false. */
  schedule: { sendNow: boolean; expiresInHours: number; sendAt?: string };
  /** When set, send only to this demo customer (the "Send test to me" button). */
  testCustomerId?: string;
  /** A/B test: variant A and B copy (title/body/cta above mirror variant A). */
  variants?: [CampaignVariantCopy, CampaignVariantCopy];
}

export interface CampaignStats {
  targeted: number;
  sent: number;
  delivered: number;
  opened: number;
  acted: number; // enrolled (offer), responded (flex) or changed installment (advice)
  paused: number; // flex only: shifted charging
  optedOut: number; // flex only
  declined: number; // offer / advice
  peakReducedMw: number; // flex only
}

export interface Campaign {
  id: string;
  type: CampaignType;
  audience: CampaignAudience;
  audienceLabel: string;
  exclusions: CampaignExclusions;
  title: string;
  body: string;
  cta: string;
  channels: CampaignChannels;
  status: CampaignStatus;
  isTest: boolean;
  /** Send time; the planned time while SCHEDULED. */
  sentAt: string;
  expiresAt: string;
  flexEventId: string | null;
  stats: CampaignStats;
  /** Message id received by the demo customer, if they were in the audience. */
  demoMessageId: string | null;
  scheduledFor: string | null;
  createdAt: string;
  createdBy: { name: string; email: string } | null;
  variants: CampaignVariantCopy[] | null;
  variantStats: Record<VariantId, CampaignStats> | null;
  winner: VariantId | null;
}

// ---------------------------------------------------------------- audit log

export type AuditAction =
  | 'CAMPAIGN_SENT'
  | 'CAMPAIGN_SCHEDULED'
  | 'CAMPAIGN_CANCELLED'
  | 'CAMPAIGN_TEST_SENT'
  | 'CAMPAIGN_DISPATCHED'
  | 'FLEX_STARTED'
  | 'FLEX_ENDED'
  | 'DEMO_RESET';

export interface AuditEntry {
  id: string;
  at: string;
  actor: { userId: string | null; name: string; email: string | null; kind: 'STAFF' | 'SYSTEM' };
  action: AuditAction;
  target: { kind: 'campaign' | 'flexEvent' | 'demo'; id: string | null; label: string };
  summary: string;
}

// ---------------------------------------------------------------- customer activity

/** Something a customer did in the mobile app. Staff see each one live (`activity:new`). */
export type CustomerActivityKind =
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'CHANNELS_UPDATED'
  | 'PAYMENT_MADE'
  | 'AUTOPAY_ON'
  | 'AUTOPAY_OFF'
  | 'ENROLLED'
  | 'NOT_EV'
  | 'REMIND_LATER'
  | 'MESSAGE_OPENED'
  | 'MESSAGE_DECLINED'
  | 'FLEX_OPENED'
  | 'FLEX_OPTED_IN'
  | 'FLEX_OPTED_OUT'
  | 'SMART_CHARGING_UPDATED'
  | 'CHARGING_BOOST'
  | 'INSTALLMENT_CHANGED'
  | 'CONTACT_UPDATED'
  | 'PREFERENCES_UPDATED'
  | 'LANGUAGE_CHANGED'
  | 'SAVINGS_PLAN_UPDATED'
  | 'INVOICE_DOWNLOADED'
  | 'ASSISTANT_ASKED'
  | 'ASSISTANT_HANDOFF'
  | 'VIEWED_BILLING'
  | 'VIEWED_INVOICE'
  | 'VIEWED_USAGE'
  | 'VIEWED_ENERGY'
  | 'VIEWED_INSIGHTS'
  | 'VIEWED_FLEX_RESULT'
  | 'VIEWED_PROGRAM';

export type CustomerActivityCategory =
  | 'account'
  | 'billing'
  | 'program'
  | 'flex'
  | 'charging'
  | 'assistant'
  | 'view';

export interface CustomerActivity {
  id: string;
  at: string;
  customerId: string;
  customerName: string;
  districtCode: string | null;
  kind: CustomerActivityKind;
  category: CustomerActivityCategory;
  summary: string;
}

/** Kinds the phone reports itself (screen views and sign-out); everything else is recorded by the API. */
export const TRACKABLE_ACTIVITY_KINDS = [
  'SIGNED_OUT',
  'VIEWED_BILLING',
  'VIEWED_INVOICE',
  'VIEWED_USAGE',
  'VIEWED_ENERGY',
  'VIEWED_INSIGHTS',
  'VIEWED_FLEX_RESULT',
  'VIEWED_PROGRAM',
] as const satisfies readonly CustomerActivityKind[];
export type TrackableActivityKind = (typeof TRACKABLE_ACTIVITY_KINDS)[number];

/** POST /me/activity */
export interface TrackActivityRequest {
  kind: TrackableActivityKind;
}

export interface ActivityQuery {
  customerId?: string;
  category?: CustomerActivityCategory;
  limit?: number;
}

/** GET /customers/:id/activity */
export interface CustomerActivityPage {
  customer: {
    customerId: string;
    name: string;
    email: string;
    districtCode: string | null;
    evStatus: EvStatus;
    online: boolean;
  };
  activity: CustomerActivity[];
}

/** GET /campaigns/:id/detail */
export interface CampaignDetail {
  campaign: Campaign;
  flexEvent: FlexEvent | null;
  audit: AuditEntry[];
  timeline: { at: string; label: string }[];
}

// ---------------------------------------------------------------- assistant

export interface AssistantContext {
  districtCode?: string;
  campaignId?: string;
  lastIntent?: string;
  route?: string;
}

export interface AssistantRequest {
  question: string;
  /** Answer language (customer and website assistants); staff answers are English. */
  lang?: Lang;
  /** Echo the previous answer's context for follow-ups. */
  context?: AssistantContext;
}

export interface AssistantFact {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

export interface AssistantChart {
  kind: 'bar' | 'line';
  unit: string;
  points: { label: string; value: number; highlight?: boolean }[];
}

export interface CampaignDraftCopy {
  title: string;
  body: string;
  cta: string;
}

export interface CampaignDraft {
  type: CampaignType;
  audience: CampaignAudience;
  variants: [CampaignDraftCopy, CampaignDraftCopy];
}

export type AssistantAction =
  | { kind: 'route'; label: string; route: string }
  | { kind: 'prompt'; label: string; prompt: string }
  | { kind: 'signIn'; label: string }
  | { kind: 'campaignDraft'; label: string; draft: CampaignDraft };

export interface AssistantAnswer {
  intent: string;
  matched: boolean;
  /** Paragraphs. */
  text: string[];
  facts: AssistantFact[];
  chart: AssistantChart | null;
  followUps: string[];
  actions: AssistantAction[];
  context: AssistantContext;
  generatedAt: string;
  disclosure: string;
}

export interface AssistantSuggestions {
  greeting: string;
  suggestions: string[];
}

/** Where a question was asked. */
export type AssistantChannel = 'APP' | 'WEBSITE' | 'WEBSITE_SIGNED_IN';

/** One logged customer question (staff: Assistant insights). */
export interface AssistantLogEntry {
  id: string;
  at: string;
  channel: AssistantChannel;
  customerId: string | null;
  customerName: string | null;
  question: string;
  intent: string;
  matched: boolean;
  /** The answer asked the visitor to sign in. */
  signInPrompt: boolean;
  /** The answer handed the customer to customer service. */
  handoff: boolean;
  lang: Lang;
}

export interface AssistantInsights {
  total: number;
  last24h: number;
  /** Share of questions the assistant answered itself (matched, no hand-off), 0–100. */
  selfServicePct: number;
  matchedPct: number;
  handoffs: number;
  signInPrompts: number;
  byChannel: Record<AssistantChannel, number>;
  topIntents: { intent: string; label: string; count: number; matchedPct: number }[];
  /** Questions per hour over the last 24 h, oldest first. */
  hourly: { hour: string; count: number }[];
  recent: AssistantLogEntry[];
  unanswered: AssistantLogEntry[];
}

// ---------------------------------------------------------------- demo control

export interface DemoCustomer {
  customerId: string;
  firstName: string;
  email: string;
  districtCode: string;
  evStatus: EvStatus;
  role: 'UNENROLLED_DEMO' | 'ENROLLED_DEMO';
  online: boolean; // a mobile socket is connected for this customer
  /** Installment below the advice (fits the installment-advice preset). */
  installmentGap: boolean;
}

export interface DemoState {
  customers: DemoCustomer[];
  staffSockets: number;
  activeFlexEvent: FlexEvent | null;
  lastReset: string;
  /** Server clock (ISO) and the demo timezone it reasons in. */
  serverTime: string;
  timezone: string;
  /** EV_ALWAYS_CHARGING: customers with an EV are modelled as charging whenever the clock allows. */
  evAlwaysCharging: boolean;
  /** The flex window the simulators/campaigns would use right now. */
  nextEventWindow: { start: string; end: string };
  /** URL a phone on the same network should open for the customer app. */
  phoneAppUrl: string;
}

export interface DemoPhone {
  url: string;
  /** Inline SVG markup of a QR code for `url`. */
  qrSvg: string;
  /** True when `url` is a local-network address, so the phone must be on the same Wi-Fi as the server. */
  local: boolean;
}

/** Web push (browser notifications on the phone). The VAPID public key the browser subscribes with. */
export interface PushKey {
  publicKey: string;
}
/** A browser PushSubscription as JSON (PushSubscription.toJSON()). */
export interface PushSubscribeRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface PushUnsubscribeRequest {
  endpoint: string;
}

export interface DemoResetRequest {
  /** Default true: clients keep their sign-in (demo ids are stable across resets) and just refetch. */
  keepSessions?: boolean;
}

export interface SimEvDetectedRequest { customerId: string }
export interface SimClusterRequest { gridAreaCode: string }
export interface SimForecastRequest { districtCode: string }

/** One-click phone notifications on the demo control panel ("quick send"). Catalogue in demo-notify.ts. */
export type NotifyPreset =
  | 'EV_DETECTED'
  | 'HEAT_PUMP_DETECTED'
  | 'CHARGING_COMPLETE'
  | 'CHEAP_HOURS'
  | 'FLEX_REQUEST'
  | 'ENROLL_OFFER'
  | 'INSTALLMENT_ADVICE'
  | 'ANNUAL_STATEMENT'
  | 'NIGHT_USAGE'
  | 'METER_READING';
export interface SimNotifyRequest { customerId: string; preset: NotifyPreset }
export interface SimNotifyResult { text: string }
