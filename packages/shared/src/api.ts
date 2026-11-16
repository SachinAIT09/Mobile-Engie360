import type {
  ActivityQuery,
  AssistantAnswer,
  AssistantInsights,
  AssistantRequest,
  AssistantSuggestions,
  AuditEntry,
  AudiencePreview,
  AudiencePreviewRequest,
  AutoPayUpdateRequest,
  BillingOverview,
  BlindSpot,
  Campaign,
  CampaignCreateRequest,
  CampaignDetail,
  Channels,
  ContactUpdateRequest,
  CustomerActivity,
  CustomerActivityPage,
  CustomerProfile,
  DeadGridArea,
  DemoPhone,
  DemoResetRequest,
  DemoState,
  DistrictStat,
  EnergyReading,
  EnrollRequest,
  Enrollment,
  FlexEvent,
  FlexEventForCustomer,
  FlexEventResultMe,
  FlexRespondRequest,
  GridAreaStat,
  InsightsResponse,
  InstallmentUpdateRequest,
  Invoice,
  LangUpdateRequest,
  LiveEvent,
  LoginRequest,
  LoginResponse,
  MeSummary,
  Message,
  MessageActionRequest,
  Payment,
  PaymentRequest,
  Preferences,
  Program,
  PushKey,
  PushSubscribeRequest,
  PushUnsubscribeRequest,
  RatePlanComparison,
  ReportsSummary,
  SavingsPlanUpdateRequest,
  SimNotifyRequest,
  SimNotifyResult,
  SmartChargingPlan,
  SmartChargingUpdateRequest,
  StatsOverview,
  TrackActivityRequest,
  UsageOverview,
  UsagePeriod,
  UsageSeriesResponse,
} from './types';

/**
 * REST contract. Every path is relative to `${baseUrl}/api`.
 * Success bodies are the plain JSON value (no wrapper).
 * Errors use NestJS's default shape: { statusCode, message, error }.
 */
export const ApiPaths = {
  login: '/auth/login',
  me: '/me/summary',
  meChannels: '/me/channels',
  meAutoPay: '/me/autopay',
  meContact: '/me/contact',
  mePreferences: '/me/preferences',
  meLang: '/me/lang',
  smartCharging: '/me/smart-charging',
  smartChargingBoost: '/me/smart-charging/boost',
  ratePlans: '/me/rate-plans',
  assistantStaff: '/assistant/staff',
  assistantStaffSuggestions: '/assistant/staff/suggestions',
  assistantMe: '/assistant/me',
  assistantMeSuggestions: (lang: string) => `/assistant/me/suggestions?lang=${lang}`,
  assistantPublic: '/assistant/public',
  assistantPublicSuggestions: (lang: string) => `/assistant/public/suggestions?lang=${lang}`,
  assistantInsights: '/assistant/insights',
  energyLive: '/energy/live',
  usage: (period: UsagePeriod) => `/usage?period=${period}`,
  usageOverview: '/usage/overview',
  billing: '/billing',
  invoice: (id: string) => `/billing/invoices/${id}`,
  installment: '/billing/installment',
  insights: '/insights',
  savingsPlan: '/insights/plan',
  payments: '/payments',
  programCurrent: '/programs/current',
  enrollments: '/enrollments',
  messages: '/messages',
  message: (id: string) => `/messages/${id}`,
  messageAction: (id: string) => `/messages/${id}/action`,
  notEv: '/ev-detections/mine/not-ev',
  flexEvents: '/flex-events',
  flexEvent: (id: string) => `/flex-events/${id}`,
  flexRespond: (id: string) => `/flex-events/${id}/responses`,
  flexResultMe: (id: string) => `/flex-events/${id}/result/me`,
  flexStart: (id: string) => `/flex-events/${id}/start`,
  flexEnd: (id: string) => `/flex-events/${id}/end`,
  statsOverview: '/stats/overview',
  blindSpots: '/stats/blind-spots',
  deadGridAreas: '/stats/dead-grid-areas',
  statsReports: '/stats/reports',
  gridAreas: '/grid-areas',
  gridAreaDistricts: (code: string) => `/grid-areas/${code}/districts`,
  district: (code: string) => `/districts/${code}`,
  liveEvents: '/live-events',
  campaigns: '/campaigns',
  campaign: (id: string) => `/campaigns/${id}`,
  campaignDetail: (id: string) => `/campaigns/${id}/detail`,
  campaignCancel: (id: string) => `/campaigns/${id}/cancel`,
  audit: (limit?: number) => (limit === undefined ? '/audit' : `/audit?limit=${limit}`),
  audiencePreview: '/campaigns/preview-audience',
  demoState: '/demo/state',
  demoReset: '/demo/reset',
  demoPhone: '/demo/phone',
  simEvDetected: '/sim/ev-detected',
  simCluster: '/sim/ev-cluster',
  simForecast: '/sim/congestion-forecast',
  simNotify: '/sim/notify',
  activity: (q: ActivityQuery = {}) => {
    const p = new URLSearchParams();
    if (q.customerId) p.set('customerId', q.customerId);
    if (q.category) p.set('category', q.category);
    if (q.limit !== undefined) p.set('limit', String(q.limit));
    const qs = p.toString();
    return qs ? `/activity?${qs}` : '/activity';
  },
  customerActivity: (id: string) => `/customers/${id}/activity`,
  meActivity: '/me/activity',
  pushKey: '/push/key',
  mePush: '/me/push',
} as const;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface ApiOptions {
  baseUrl: string; // e.g. http://localhost:3000
  getToken: () => string | null | undefined;
  onUnauthorized?: () => void;
}

export function createApi(opts: ApiOptions) {
  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = opts.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, '')}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      if (res.status === 401) opts.onUnauthorized?.();
      const msg = data && (Array.isArray(data.message) ? data.message.join(', ') : data.message);
      throw new ApiError(res.status, msg || res.statusText);
    }
    return data as T;
  }
  const get = <T>(p: string) => req<T>('GET', p);
  const post = <T>(p: string, b?: unknown) => req<T>('POST', p, b ?? {});
  const patch = <T>(p: string, b: unknown) => req<T>('PATCH', p, b);
  const put = <T>(p: string, b: unknown) => req<T>('PUT', p, b);

  return {
    // auth
    login: (b: LoginRequest) => post<LoginResponse>(ApiPaths.login, b),
    // customer
    me: () => get<MeSummary>(ApiPaths.me),
    updateChannels: (b: Channels) => patch<Channels>(ApiPaths.meChannels, b),
    updateAutoPay: (b: AutoPayUpdateRequest) => patch<CustomerProfile>(ApiPaths.meAutoPay, b),
    updateContact: (b: ContactUpdateRequest) => patch<CustomerProfile>(ApiPaths.meContact, b),
    updatePreferences: (b: Preferences) => patch<Preferences>(ApiPaths.mePreferences, b),
    updateLang: (b: LangUpdateRequest) => patch<{ ok: true }>(ApiPaths.meLang, b),
    energyLive: () => get<EnergyReading>(ApiPaths.energyLive),
    usage: (p: UsagePeriod) => get<UsageSeriesResponse>(ApiPaths.usage(p)),
    usageOverview: () => get<UsageOverview>(ApiPaths.usageOverview),
    billing: () => get<BillingOverview>(ApiPaths.billing),
    invoice: (id: string) => get<Invoice>(ApiPaths.invoice(id)),
    updateInstallment: (b: InstallmentUpdateRequest) => put<BillingOverview>(ApiPaths.installment, b),
    insights: () => get<InsightsResponse>(ApiPaths.insights),
    updateSavingsPlan: (b: SavingsPlanUpdateRequest) => put<InsightsResponse>(ApiPaths.savingsPlan, b),
    pay: (b: PaymentRequest) => post<Payment>(ApiPaths.payments, b),
    program: () => get<Program>(ApiPaths.programCurrent),
    enroll: (b: EnrollRequest) => post<Enrollment>(ApiPaths.enrollments, b),
    messages: () => get<Message[]>(ApiPaths.messages),
    message: (id: string) => get<Message>(ApiPaths.message(id)),
    messageAction: (id: string, b: MessageActionRequest) => post<Message>(ApiPaths.messageAction(id), b),
    notEv: () => post<{ ok: true }>(ApiPaths.notEv),
    flexEvent: (id: string) => get<FlexEventForCustomer>(ApiPaths.flexEvent(id)),
    flexRespond: (id: string, b: FlexRespondRequest) => post<FlexEventForCustomer>(ApiPaths.flexRespond(id), b),
    flexResultMe: (id: string) => get<FlexEventResultMe>(ApiPaths.flexResultMe(id)),
    smartCharging: () => get<SmartChargingPlan>(ApiPaths.smartCharging),
    updateSmartCharging: (b: SmartChargingUpdateRequest) => put<SmartChargingPlan>(ApiPaths.smartCharging, b),
    boostCharging: () => post<SmartChargingPlan>(ApiPaths.smartChargingBoost),
    ratePlans: () => get<RatePlanComparison>(ApiPaths.ratePlans),
    askMe: (b: AssistantRequest) => post<AssistantAnswer>(ApiPaths.assistantMe, b),
    mySuggestions: (lang: string) => get<AssistantSuggestions>(ApiPaths.assistantMeSuggestions(lang)),
    trackActivity: (b: TrackActivityRequest) => post<{ ok: true }>(ApiPaths.meActivity, b),
    // website (no sign-in needed)
    askPublic: (b: AssistantRequest) => post<AssistantAnswer>(ApiPaths.assistantPublic, b),
    publicSuggestions: (lang: string) => get<AssistantSuggestions>(ApiPaths.assistantPublicSuggestions(lang)),
    // staff
    statsOverview: () => get<StatsOverview>(ApiPaths.statsOverview),
    blindSpots: () => get<BlindSpot[]>(ApiPaths.blindSpots),
    deadGridAreas: () => get<DeadGridArea[]>(ApiPaths.deadGridAreas),
    reports: () => get<ReportsSummary>(ApiPaths.statsReports),
    gridAreas: () => get<GridAreaStat[]>(ApiPaths.gridAreas),
    gridAreaDistricts: (code: string) => get<DistrictStat[]>(ApiPaths.gridAreaDistricts(code)),
    district: (code: string) => get<DistrictStat>(ApiPaths.district(code)),
    liveEvents: () => get<LiveEvent[]>(ApiPaths.liveEvents),
    flexEvents: () => get<FlexEvent[]>(ApiPaths.flexEvents),
    campaigns: () => get<Campaign[]>(ApiPaths.campaigns),
    campaign: (id: string) => get<Campaign>(ApiPaths.campaign(id)),
    previewAudience: (b: AudiencePreviewRequest) => post<AudiencePreview>(ApiPaths.audiencePreview, b),
    createCampaign: (b: CampaignCreateRequest) => post<Campaign>(ApiPaths.campaigns, b),
    campaignDetail: (id: string) => get<CampaignDetail>(ApiPaths.campaignDetail(id)),
    cancelCampaign: (id: string) => post<Campaign>(ApiPaths.campaignCancel(id)),
    audit: (limit?: number) => get<AuditEntry[]>(ApiPaths.audit(limit)),
    activity: (q?: ActivityQuery) => get<CustomerActivity[]>(ApiPaths.activity(q)),
    customerActivity: (id: string) => get<CustomerActivityPage>(ApiPaths.customerActivity(id)),
    askStaff: (b: AssistantRequest) => post<AssistantAnswer>(ApiPaths.assistantStaff, b),
    staffSuggestions: () => get<AssistantSuggestions>(ApiPaths.assistantStaffSuggestions),
    assistantInsights: () => get<AssistantInsights>(ApiPaths.assistantInsights),
    flexStart: (id: string) => post<FlexEvent>(ApiPaths.flexStart(id)),
    flexEnd: (id: string) => post<FlexEvent>(ApiPaths.flexEnd(id)),
    // demo
    demoState: () => get<DemoState>(ApiPaths.demoState),
    demoReset: (b?: DemoResetRequest) => post<{ ok: true }>(ApiPaths.demoReset, b ?? {}),
    demoPhone: () => get<DemoPhone>(ApiPaths.demoPhone),
    simEvDetected: (customerId: string) => post<LiveEvent>(ApiPaths.simEvDetected, { customerId }),
    simCluster: (districtCode: string) => post<LiveEvent>(ApiPaths.simCluster, { districtCode }),
    simForecast: (gridAreaCode: string) => post<LiveEvent>(ApiPaths.simForecast, { gridAreaCode }),
    simNotify: (b: SimNotifyRequest) => post<SimNotifyResult>(ApiPaths.simNotify, b),
    // web push
    pushKey: () => get<PushKey>(ApiPaths.pushKey),
    pushSubscribe: (b: PushSubscribeRequest) => post<{ ok: true }>(ApiPaths.mePush, b),
    pushUnsubscribe: (b: PushUnsubscribeRequest) => post<{ ok: true }>(`${ApiPaths.mePush}/remove`, b),
  };
}

export type Api = ReturnType<typeof createApi>;
