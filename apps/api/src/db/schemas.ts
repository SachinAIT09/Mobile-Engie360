import { Schema, Types } from 'mongoose';
import type {
  AuditAction,
  AuditEntry,
  CustomerActivityCategory,
  CustomerActivityKind,
  AssistantChannel,
  Contract,
  InvoiceKind,
  InvoiceStatus,
  Lang,
  Preferences,
  Text,
  CampaignAudience,
  CampaignChannels,
  CampaignExclusions,
  CampaignStats,
  CampaignStatus,
  CampaignType,
  CampaignVariantCopy,
  ChargerType,
  FlexEventStatus,
  FlexResponse,
  EnrollmentSource,
  LiveEventKind,
  MessageAction,
  MessageCategory,
  MessageKind,
  PaymentMethodKind,
  RatePlanId,
  Role,
  VariantId,
} from '@engie/shared';

/** Model names (also the Mongo collection names, lower-cased + "s" by mongoose). */
export const M = {
  Config: 'Config',
  GridArea: 'GridArea',
  District: 'District',
  Premise: 'Premise',
  Customer: 'Customer',
  User: 'User',
  EvDetection: 'EvDetection',
  Enrollment: 'Enrollment',
  Program: 'Program',
  Message: 'Message',
  Campaign: 'Campaign',
  FlexEvent: 'FlexEvent',
  EventResponse: 'EventResponse',
  Invoice: 'Invoice',
  Payment: 'Payment',
  AssistantLog: 'AssistantLog',
  LiveEvent: 'LiveEvent',
  AuditEntry: 'AuditEntry',
  CustomerActivity: 'CustomerActivity',
} as const;

type Id = Types.ObjectId;
const ObjectId = Schema.Types.ObjectId;

// ---------------------------------------------------------------- config

export interface ConfigDoc {
  key: 'main';
  matchedPremises: number;
  noSignalPremises: number;
  noLocationPremises: number;
  partiallyDeadGridAreas: number;
  deadDistricts: number;
  deadDistrictPremises: number;
  dataSourceNote: string;
  lastReset: Date;
}
export const ConfigSchema = new Schema<ConfigDoc>({
  key: { type: String, required: true, unique: true },
  matchedPremises: Number,
  noSignalPremises: Number,
  noLocationPremises: Number,
  partiallyDeadGridAreas: Number,
  deadDistricts: Number,
  deadDistrictPremises: Number,
  dataSourceNote: String,
  lastReset: Date,
});

// ---------------------------------------------------------------- grid

export interface GridAreaDoc {
  code: string;
  name: string;
  operator: string;
  congestion: 'NONE' | 'WATCH' | 'CONGESTED';
  order: number;
  region: string;
  /** Seed-time totals from the Net2Grid source; live districts add deltas on top. */
  seedEvs: number;
  seedKnown: number;
  penetrationPct: number;
  districtCount: number;
  dead: boolean;
  deadPremises: number;
  /** True when every district has per-customer data (SUB-01). */
  interactive: boolean;
}
export const GridAreaSchema = new Schema<GridAreaDoc>({
  code: { type: String, required: true, unique: true },
  name: String,
  operator: String,
  congestion: String,
  order: Number,
  region: String,
  seedEvs: Number,
  seedKnown: Number,
  penetrationPct: Number,
  districtCount: Number,
  dead: Boolean,
  deadPremises: Number,
  interactive: Boolean,
});

export interface DistrictDoc {
  code: string;
  name: string;
  gridAreaCode: string;
  order: number;
  /** Live districts compute their counts from customers/detections/enrollments. */
  live: boolean;
  premisesCount: number | null;
  capacityKw: number;
  forecastLoadPct: number | null;
  /** Static EV count for non-live districts. */
  staticEvs: number;
  /** Counts at seed time for live districts (used to compute deltas against static totals). */
  seedKnown: number;
  seedUnenrolled: number;
}
export const DistrictSchema = new Schema<DistrictDoc>({
  code: { type: String, required: true, unique: true },
  name: String,
  gridAreaCode: { type: String, index: true },
  order: Number,
  live: Boolean,
  premisesCount: { type: Number, default: null },
  capacityKw: Number,
  forecastLoadPct: { type: Number, default: null },
  staticEvs: Number,
  seedKnown: Number,
  seedUnenrolled: Number,
});

export interface PremiseDoc {
  _id: Id;
  address: string;
  districtCode: string;
  gridAreaCode: string;
  hasSolar: boolean;
}
export const PremiseSchema = new Schema<PremiseDoc>({
  address: String,
  districtCode: { type: String, index: true },
  gridAreaCode: { type: String, index: true },
  hasSolar: Boolean,
});

// ---------------------------------------------------------------- people

export type DemoRole = 'UNENROLLED_DEMO' | 'ENROLLED_DEMO' | null;
/** Stored smart-charging settings; null until the customer first saves them. */
export interface SmartChargingDoc {
  enabled: boolean;
  readyBy: string;
  targetKwh: number;
  ratePlan: RatePlanId;
  boostUntil: Date | null;
}
export interface CustomerDoc {
  _id: Id;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  customerNo: string;
  premiseId: Id;
  /** "Lindelaan 24, 3581 AB Utrecht" */
  address: string;
  street: string;
  postcode: string;
  city: string;
  districtCode: string;
  gridAreaCode: string;
  gridOperator: string;
  household: { residents: number; homeType: Text; sizeM2: number };
  ibanMasked: string;
  memberSince: Date;
  hasSolar: boolean;
  hasHeatPump: boolean;
  heatPumpDetectedAt: Date | null;
  lang: Lang;
  preferences: Preferences;
  contract: Contract;
  /** Seeded usage model inputs (shared/usage.ts). */
  usage: { seed: number; elecScale: number; gasScale: number };
  /** When EV charging started at home (drives the usage history); null until Net2Grid sees an EV. */
  evSince: Date | null;
  savingsPlan: string[];
  optedOutOfMessages: boolean;
  lifeSupport: boolean;
  groundTruthValidated: boolean;
  channels: { push: boolean; sms: boolean; email: boolean };
  /** AutoPay preference; seed resets it to off. */
  autoPay: { enabled: boolean; method: PaymentMethodKind | null; since: Date | null };
  evChargingActive: boolean;
  smartCharging: SmartChargingDoc | null;
  demoRole: DemoRole;
  synthetic: boolean;
}
export const CustomerSchema = new Schema<CustomerDoc>({
  firstName: String,
  lastName: String,
  email: { type: String, index: true },
  phone: String,
  customerNo: String,
  premiseId: { type: ObjectId },
  address: String,
  street: String,
  postcode: String,
  city: String,
  districtCode: { type: String, index: true },
  gridAreaCode: { type: String, index: true },
  gridOperator: String,
  household: Schema.Types.Mixed,
  ibanMasked: String,
  memberSince: Date,
  hasSolar: Boolean,
  hasHeatPump: Boolean,
  heatPumpDetectedAt: { type: Date, default: null },
  lang: { type: String, default: 'nl' },
  preferences: Schema.Types.Mixed,
  contract: Schema.Types.Mixed,
  usage: Schema.Types.Mixed,
  evSince: { type: Date, default: null },
  savingsPlan: { type: [String], default: [] },
  optedOutOfMessages: Boolean,
  lifeSupport: Boolean,
  groundTruthValidated: Boolean,
  channels: { push: Boolean, sms: Boolean, email: Boolean },
  autoPay: {
    enabled: { type: Boolean, default: false },
    method: { type: String, default: null },
    since: { type: Date, default: null },
  },
  evChargingActive: Boolean,
  smartCharging: { type: Schema.Types.Mixed, default: null },
  demoRole: { type: String, default: null },
  synthetic: Boolean,
});

export interface UserDoc {
  _id: Id;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  customerId: Id | null;
}
export const UserSchema = new Schema<UserDoc>({
  email: { type: String, unique: true },
  role: String,
  firstName: String,
  lastName: String,
  customerId: { type: ObjectId, default: null },
});

// ---------------------------------------------------------------- EV / program

export interface EvDetectionDoc {
  _id: Id;
  premiseId: Id;
  customerId: Id;
  districtCode: string;
  gridAreaCode: string;
  firstDetectedAt: Date;
  source: 'NET2GRID';
  status: 'DETECTED' | 'CONFIRMED_NOT_EV';
}
export const EvDetectionSchema = new Schema<EvDetectionDoc>({
  premiseId: ObjectId,
  customerId: { type: ObjectId, index: true },
  districtCode: { type: String, index: true },
  gridAreaCode: { type: String, index: true },
  firstDetectedAt: Date,
  source: String,
  status: String,
});

export interface EnrollmentDoc {
  _id: Id;
  customerId: Id;
  programId: Id;
  districtCode: string;
  gridAreaCode: string;
  enrolledAt: Date;
  source: EnrollmentSource;
  evMake: string | null;
  chargerType: ChargerType | null;
  status: 'ACTIVE' | 'LEFT';
}
export const EnrollmentSchema = new Schema<EnrollmentDoc>({
  customerId: { type: ObjectId, index: true },
  programId: ObjectId,
  districtCode: { type: String, index: true },
  gridAreaCode: { type: String, index: true },
  enrolledAt: Date,
  source: String,
  evMake: { type: String, default: null },
  chargerType: { type: String, default: null },
  status: String,
});

export interface ProgramDoc {
  _id: Id;
  name: Text;
  signupIncentive: Text;
  perEventIncentive: Text;
  maxEventsPerSeason: Text;
  typicalEventHours: Text;
  termsUrl: string;
  termsSummary: Text[];
}

export const ProgramSchema = new Schema<ProgramDoc>({
  name: Schema.Types.Mixed,
  signupIncentive: Schema.Types.Mixed,
  perEventIncentive: Schema.Types.Mixed,
  maxEventsPerSeason: Schema.Types.Mixed,
  typicalEventHours: Schema.Types.Mixed,
  termsUrl: String,
  termsSummary: Schema.Types.Mixed,
});

// ---------------------------------------------------------------- messages / campaigns

export interface MessageDoc {
  _id: Id;
  customerId: Id;
  kind: MessageKind;
  category: MessageCategory;
  tag: string;
  title: string;
  body: string;
  cta: string | null;
  campaignId: Id | null;
  flexEventId: Id | null;
  route: string;
  createdAt: Date;
  deliveredAt: Date | null;
  openedAt: Date | null;
  actedAt: Date | null;
  action: MessageAction | null;
  /** A/B variant of the campaign copy (null when not an A/B campaign). */
  variant: VariantId | null;
  synthetic: boolean;
}
export const MessageSchema = new Schema<MessageDoc>({
  customerId: { type: ObjectId, index: true },
  kind: String,
  category: String,
  tag: String,
  title: String,
  body: String,
  cta: { type: String, default: null },
  campaignId: { type: ObjectId, default: null, index: true },
  flexEventId: { type: ObjectId, default: null },
  route: String,
  createdAt: Date,
  deliveredAt: { type: Date, default: null },
  openedAt: { type: Date, default: null },
  actedAt: { type: Date, default: null },
  action: { type: String, default: null },
  variant: { type: String, default: null },
  synthetic: Boolean,
});

export interface CampaignDoc {
  _id: Id;
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
  sentAt: Date;
  expiresAt: Date;
  flexEventId: Id | null;
  stats: CampaignStats;
  demoMessageId: Id | null;
  targetIds: Id[];
  scheduledFor: Date | null;
  createdAt: Date;
  createdBy: { name: string; email: string } | null;
  variants: CampaignVariantCopy[] | null;
  variantStats: Record<VariantId, CampaignStats> | null;
  winner: VariantId | null;
}
export const CampaignSchema = new Schema<CampaignDoc>({
  type: String,
  audience: Schema.Types.Mixed,
  audienceLabel: String,
  exclusions: Schema.Types.Mixed,
  title: String,
  body: String,
  cta: String,
  channels: Schema.Types.Mixed,
  status: { type: String, enum: ['SCHEDULED', 'SENDING', 'SENT', 'CANCELLED'] },
  isTest: Boolean,
  sentAt: Date,
  expiresAt: Date,
  flexEventId: { type: ObjectId, default: null },
  stats: Schema.Types.Mixed,
  demoMessageId: { type: ObjectId, default: null },
  targetIds: [ObjectId],
  scheduledFor: { type: Date, default: null },
  createdAt: Date,
  createdBy: { type: Schema.Types.Mixed, default: null },
  variants: { type: Schema.Types.Mixed, default: null },
  variantStats: { type: Schema.Types.Mixed, default: null },
  winner: { type: String, default: null },
});
CampaignSchema.index({ status: 1, scheduledFor: 1 });

export interface FlexEventDoc {
  _id: Id;
  districtCode: string;
  title: string;
  windowStart: Date;
  windowEnd: Date;
  plannedHours: number;
  status: FlexEventStatus;
  campaignId: Id;
  targetCustomerIds: Id[];
  /** All districts of a multi-district campaign; districtCode is the first. */
  districtCodes: string[];
}
export const FlexEventSchema = new Schema<FlexEventDoc>({
  districtCode: String,
  title: String,
  windowStart: Date,
  windowEnd: Date,
  plannedHours: Number,
  status: String,
  campaignId: ObjectId,
  targetCustomerIds: [ObjectId],
  districtCodes: { type: [String], default: [] },
});

export interface EventResponseDoc {
  _id: Id;
  flexEventId: Id;
  customerId: Id;
  response: FlexResponse;
  respondedAt: Date;
  kwhShifted: number | null;
  peakReducedKw: number | null;
  earned: Text | null;
  synthetic: boolean;
}
export const EventResponseSchema = new Schema<EventResponseDoc>({
  flexEventId: { type: ObjectId, index: true },
  customerId: { type: ObjectId, index: true },
  response: String,
  respondedAt: Date,
  kwhShifted: { type: Number, default: null },
  peakReducedKw: { type: Number, default: null },
  earned: { type: Schema.Types.Mixed, default: null },
  synthetic: Boolean,
});

// ---------------------------------------------------------------- invoices / payments

export interface InvoiceDoc {
  _id: Id;
  customerId: Id;
  number: string;
  kind: InvoiceKind;
  period: Text;
  /** Sort key, e.g. "2026-11". */
  periodKey: string;
  issued: Date;
  due: Date;
  amount: number;
  status: InvoiceStatus;
  paidOn: Date | null;
  lines: { label: Text; amount: number }[];
}

export const InvoiceSchema = new Schema<InvoiceDoc>({
  customerId: { type: ObjectId, index: true },
  number: String,
  kind: String,
  period: Schema.Types.Mixed,
  periodKey: String,
  issued: Date,
  due: Date,
  amount: Number,
  status: String,
  paidOn: { type: Date, default: null },
  lines: Schema.Types.Mixed,
});

export interface PaymentDoc {
  _id: Id;
  customerId: Id;
  invoiceId: Id;
  amount: number;
  method: PaymentMethodKind;
  status: 'CONFIRMED';
  confirmationNo: string;
  provider: 'IDEAL_MOCK';
  createdAt: Date;
}

export const PaymentSchema = new Schema<PaymentDoc>({
  customerId: ObjectId,
  invoiceId: ObjectId,
  amount: Number,
  method: String,
  status: String,
  confirmationNo: String,
  provider: String,
  createdAt: Date,
});

// ---------------------------------------------------------------- assistant log

export interface AssistantLogDoc {
  _id: Id;
  at: Date;
  channel: AssistantChannel;
  customerId: Id | null;
  customerName: string | null;
  question: string;
  intent: string;
  matched: boolean;
  signInPrompt: boolean;
  handoff: boolean;
  lang: Lang;
  synthetic: boolean;
}

export const AssistantLogSchema = new Schema<AssistantLogDoc>({
  at: { type: Date, index: true },
  channel: String,
  customerId: { type: ObjectId, default: null },
  customerName: { type: String, default: null },
  question: String,
  intent: String,
  matched: Boolean,
  signInPrompt: Boolean,
  handoff: Boolean,
  lang: String,
  synthetic: Boolean,
});

// ---------------------------------------------------------------- live events

export interface LiveEventDoc {
  _id: Id;
  ts: Date;
  kind: LiveEventKind;
  gridAreaCode: string;
  districtCode: string | null;
  headline: string;
  summary: string;
  count: number | null;
  unenrolledCount: number | null;
  enrolledCount: number | null;
  actionTaken: string | null;
  suggested: null | { label: string; campaignType: CampaignType; audience: CampaignAudience };
  /** Hidden from the API: customers referenced by the event (cluster audience). */
  customerIds: Id[];
}
export const LiveEventSchema = new Schema<LiveEventDoc>({
  ts: { type: Date, index: true },
  kind: String,
  gridAreaCode: String,
  districtCode: { type: String, default: null },
  headline: String,
  summary: String,
  count: { type: Number, default: null },
  unenrolledCount: { type: Number, default: null },
  enrolledCount: { type: Number, default: null },
  actionTaken: { type: String, default: null },
  suggested: { type: Schema.Types.Mixed, default: null },
  customerIds: [ObjectId],
});

// ---------------------------------------------------------------- audit log

export interface AuditEntryDoc {
  _id: Id;
  at: Date;
  actor: AuditEntry['actor'];
  action: AuditAction;
  target: AuditEntry['target'];
  summary: string;
}
export const AuditEntrySchema = new Schema<AuditEntryDoc>({
  at: { type: Date, index: true },
  actor: Schema.Types.Mixed,
  action: String,
  target: Schema.Types.Mixed,
  summary: String,
});
AuditEntrySchema.index({ 'target.id': 1 });

// ---------------------------------------------------------------- customer activity

export interface CustomerActivityDoc {
  _id: Id;
  at: Date;
  customerId: Id;
  customerName: string;
  districtCode: string | null;
  kind: CustomerActivityKind;
  category: CustomerActivityCategory;
  summary: string;
}
export const CustomerActivitySchema = new Schema<CustomerActivityDoc>({
  at: { type: Date, index: true },
  customerId: { type: ObjectId, index: true },
  customerName: String,
  districtCode: { type: String, default: null },
  kind: String,
  category: String,
  summary: String,
});

export const ALL_SCHEMAS = [
  { name: M.Config, schema: ConfigSchema },
  { name: M.GridArea, schema: GridAreaSchema },
  { name: M.District, schema: DistrictSchema },
  { name: M.Premise, schema: PremiseSchema },
  { name: M.Customer, schema: CustomerSchema },
  { name: M.User, schema: UserSchema },
  { name: M.EvDetection, schema: EvDetectionSchema },
  { name: M.Enrollment, schema: EnrollmentSchema },
  { name: M.Program, schema: ProgramSchema },
  { name: M.Message, schema: MessageSchema },
  { name: M.Campaign, schema: CampaignSchema },
  { name: M.FlexEvent, schema: FlexEventSchema },
  { name: M.EventResponse, schema: EventResponseSchema },
  { name: M.Invoice, schema: InvoiceSchema },
  { name: M.Payment, schema: PaymentSchema },
  { name: M.AssistantLog, schema: AssistantLogSchema },
  { name: M.LiveEvent, schema: LiveEventSchema },
  { name: M.AuditEntry, schema: AuditEntrySchema },
  { name: M.CustomerActivity, schema: CustomerActivitySchema },
];
