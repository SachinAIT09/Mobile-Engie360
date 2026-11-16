import type { AssistantLogEntry, AuditEntry, Campaign, CustomerActivity, FlexEvent, EnergyReading, LiveEvent, Message } from './types';

/**
 * Socket.IO contract. Clients connect to the API origin with
 *   io(API_URL, { auth: { token } })
 * The server puts STAFF sockets in room "staff" and CUSTOMER sockets in room "customer:<customerId>".
 */
export const SocketEvents = {
  liveEventNew: 'liveEvent:new',
  districtStatsChanged: 'district:statsChanged',
  messageNew: 'message:new',
  messagePopup: 'message:popup',
  campaignStatsChanged: 'campaign:statsChanged',
  campaignStatusChanged: 'campaign:statusChanged',
  auditNew: 'audit:new',
  activityNew: 'activity:new',
  assistantLogged: 'assistant:logged',
  flexEventStatusChanged: 'flexEvent:statusChanged',
  energyReading: 'energy:reading',
  meChanged: 'me:changed',
  demoReset: 'demo:reset',
} as const;

export interface ServerToClientEvents {
  /** staff */
  'liveEvent:new': (e: LiveEvent) => void;
  /** staff — refetch overview / grid areas / districts / segments */
  'district:statsChanged': (p: { gridAreaCode: string; districtCode: string | null }) => void;
  /** customer */
  'message:new': (m: Message) => void;
  /** customer — open the EV-detected (Slim Laden) sheet */
  'message:popup': (m: Message) => void;
  /** staff */
  'campaign:statsChanged': (c: Campaign) => void;
  /** staff — a campaign was scheduled, dispatched, sent or cancelled */
  'campaign:statusChanged': (c: Campaign) => void;
  /** staff — a new audit-log entry */
  'audit:new': (e: AuditEntry) => void;
  /** staff — a customer did something in the mobile app */
  'activity:new': (a: CustomerActivity) => void;
  /** staff — a customer or website visitor asked the assistant something */
  'assistant:logged': (e: AssistantLogEntry) => void;
  /** staff + affected customers */
  'flexEvent:statusChanged': (e: FlexEvent) => void;
  /** customer — every 5 s */
  'energy:reading': (r: EnergyReading) => void;
  /** customer — refetch /me/summary (enrollment, installment, invoice paid, etc.) */
  'me:changed': () => void;
  /**
   * everyone — demo data was reset; clients should refetch. Payload is optional for older servers:
   * keepSessions=false (or an older server) means customers should be signed out; true means stay signed in.
   */
  'demo:reset': (p?: { keepSessions: boolean }) => void;
}

export type ClientToServerEvents = Record<string, never>;
