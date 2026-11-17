import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity, AttentionItem, AuditEntry, BillingResponse, Conversation, EnergyResponse, InboxMessage, LiveEvent, MessageTemplate, OutboxItem, Portfolio, StaffMessageRequest, StaffMessageResult, StaffOverview } from '../../shared/contract';
import { API, get, openEvents, post } from '../api/client';

export type Connection = 'connecting' | 'live' | 'down';

export interface StaffData {
  connection: Connection;
  overview: StaffOverview | null;
  activity: Activity[];
  conversations: Conversation[];
  templates: MessageTemplate[];
  /** What to look at for this customer, with suggested actions. */
  attention: AttentionItem[];
  /** Messages staff sent or scheduled, with delivery status. */
  outbox: OutboxItem[];
  /** The customer's app inbox (system and staff messages). */
  inbox: InboxMessage[];
  /** Usage and billing data for the charts and the customer page (does not change during a session). */
  energy: EnergyResponse | null;
  billing: BillingResponse | null;
  /** Who did what, newest first. */
  audit: AuditEntry[];
  /** The whole customer base at a glance. */
  portfolio: Portfolio | null;
  /** What customers did, across the base, newest first. */
  feed: Activity[];
  /** Ids of activity rows that arrived live, so the feed can highlight them briefly. */
  fresh: Set<string>;
  send: (m: StaffMessageRequest) => Promise<StaffMessageResult>;
  reset: () => Promise<void>;
  cancelScheduled: (id: string) => Promise<void>;
  /** Load everything again (the Retry button when the server was down). */
  retry: () => void;
}

const MAX_ACTIVITY = 100;

/**
 * Everything the customer-service view shows, loaded once and kept current from the live stream.
 * `onActivity` is called for each activity that arrives live (not for the initial load).
 */
export function useStaffData(onActivity?: (a: Activity) => void): StaffData {
  const [connection, setConnection] = useState<Connection>('connecting');
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [energy, setEnergy] = useState<EnergyResponse | null>(null);
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const overviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  });

  // The KPIs, attention points, outbox and inbox all follow what the customer and staff do.
  const loadOverview = useCallback(
    () =>
      Promise.all([get<StaffOverview>(API.staffOverview), get<AttentionItem[]>(API.staffAttention), get<OutboxItem[]>(API.staffOutbox), get<InboxMessage[]>(API.messages), get<Portfolio>(API.staffPortfolio)]).then(([o, a, out, msgs, p]) => {
        setPortfolio(p);
        setOverview(o);
        setAttention(a);
        setOutbox(out);
        setInbox(msgs);
      }),
    [],
  );

  const loadAll = useCallback(async () => {
    try {
      const [, a, c, t, e, b, log, f] = await Promise.all([
        loadOverview(),
        get<Activity[]>(API.staffActivity),
        get<Conversation[]>(API.staffConversations),
        get<MessageTemplate[]>(API.staffTemplates),
        get<EnergyResponse>(API.energy),
        get<BillingResponse>(API.billing),
        get<AuditEntry[]>(API.staffAudit),
        get<Activity[]>(API.staffFeed),
      ]);
      setActivity(a);
      setConversations(c);
      setTemplates(t);
      setEnergy(e);
      setBilling(b);
      setAudit(log);
      setFeed(f);
      setConnection('live');
    } catch {
      setConnection('down');
    }
  }, [loadOverview]);

  useEffect(() => {
    // Several events can arrive together (a chat turn is two); refresh once, shortly after.
    const refreshOverviewSoon = () => {
      if (overviewTimer.current) clearTimeout(overviewTimer.current);
      overviewTimer.current = setTimeout(() => void loadOverview().catch(() => undefined), 250);
    };
    const highlight = (id: string) => {
      setFresh((s) => new Set(s).add(id));
      setTimeout(() => setFresh((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      }), 4000);
    };
    const addToFeed = (a: Activity) => setFeed((list) => (list.some((x) => x.id === a.id) ? list : [a, ...list].slice(0, MAX_ACTIVITY)));
    const onEvent = (e: LiveEvent) => {
      switch (e.type) {
        case 'feed':
          addToFeed(e.activity);
          highlight(e.activity.id);
          refreshOverviewSoon();
          break;
        case 'activity':
          // The live customer's actions are part of the cross-customer feed too (the server tags them on load).
          if (e.activity.kind !== 'page' && e.activity.kind !== 'staff_message') void get<Activity[]>(API.staffFeed).then(setFeed).catch(() => undefined);
          setActivity((list) => (list.some((x) => x.id === e.activity.id) ? list : [e.activity, ...list].slice(0, MAX_ACTIVITY)));
          setFresh((s) => new Set(s).add(e.activity.id));
          setTimeout(() => setFresh((s) => {
            const next = new Set(s);
            next.delete(e.activity.id);
            return next;
          }), 4000);
          refreshOverviewSoon();
          onActivityRef.current?.(e.activity);
          break;
        case 'chat:message':
          setConversations((list) => {
            const found = list.find((c) => c.id === e.conversationId);
            // A conversation we have not seen yet: fetch the list so its audience and language are right.
            if (!found) {
              void get<Conversation[]>(API.staffConversations).then(setConversations).catch(() => undefined);
              return list;
            }
            const updated: Conversation = { ...found, updatedAt: e.entry.ts, entries: [...found.entries, e.entry] };
            return [updated, ...list.filter((c) => c.id !== e.conversationId)];
          });
          refreshOverviewSoon();
          break;
        case 'audit:new':
          setAudit((list) => (list.some((x) => x.id === e.entry.id) ? list : [e.entry, ...list].slice(0, MAX_ACTIVITY)));
          break;
        case 'presence':
          setOverview((o) => (o ? { ...o, online: e.online } : o));
          break;
        case 'installment:changed':
        case 'insights:plan':
        case 'message:new':
        case 'message:read':
        case 'outbox:changed':
          refreshOverviewSoon();
          break;
        case 'demo:reset':
          void loadAll();
          break;
        default:
          break;
      }
    };
    // Opening the stream (and every reconnect) loads the current data.
    const close = openEvents('staff', onEvent, () => void loadAll(), () => setConnection('down'));
    return () => {
      close();
      if (overviewTimer.current) clearTimeout(overviewTimer.current);
    };
  }, [loadAll, loadOverview]);

  const send = useCallback((m: StaffMessageRequest) => post<StaffMessageResult>(API.staffMessages, m), []);
  const reset = useCallback(() => post(API.demoReset), []);
  const cancelScheduled = useCallback((id: string) => post(API.staffOutboxCancel(id)).then(() => undefined), []);
  const retry = useCallback(() => {
    setConnection('connecting');
    void loadAll();
  }, [loadAll]);

  return { connection, overview, activity, conversations, templates, attention, outbox, inbox, energy, billing, audit, portfolio, feed, fresh, send, reset, cancelScheduled, retry };
}
