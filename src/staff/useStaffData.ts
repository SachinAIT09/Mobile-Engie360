import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity, Conversation, LiveEvent, MessageTemplate, StaffMessageRequest, StaffMessageResult, StaffOverview } from '../../shared/contract';
import { API, get, openEvents, post } from '../api/client';

export type Connection = 'connecting' | 'live' | 'down';

export interface StaffData {
  connection: Connection;
  overview: StaffOverview | null;
  activity: Activity[];
  conversations: Conversation[];
  templates: MessageTemplate[];
  /** Ids of activity rows that arrived live, so the feed can highlight them briefly. */
  fresh: Set<string>;
  send: (m: StaffMessageRequest) => Promise<StaffMessageResult>;
  reset: () => Promise<void>;
}

const MAX_ACTIVITY = 100;

/** Everything the customer-service view shows, loaded once and kept current from the live stream. */
export function useStaffData(): StaffData {
  const [connection, setConnection] = useState<Connection>('connecting');
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const overviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(() => get<StaffOverview>(API.staffOverview).then(setOverview), []);

  const loadAll = useCallback(async () => {
    try {
      const [o, a, c, t] = await Promise.all([
        get<StaffOverview>(API.staffOverview),
        get<Activity[]>(API.staffActivity),
        get<Conversation[]>(API.staffConversations),
        get<MessageTemplate[]>(API.staffTemplates),
      ]);
      setOverview(o);
      setActivity(a);
      setConversations(c);
      setTemplates(t);
      setConnection('live');
    } catch {
      setConnection('down');
    }
  }, []);

  useEffect(() => {
    // Several events can arrive together (a chat turn is two); refresh the KPIs once, shortly after.
    const refreshOverviewSoon = () => {
      if (overviewTimer.current) clearTimeout(overviewTimer.current);
      overviewTimer.current = setTimeout(() => void loadOverview().catch(() => undefined), 250);
    };
    const onEvent = (e: LiveEvent) => {
      switch (e.type) {
        case 'activity':
          setActivity((list) => (list.some((x) => x.id === e.activity.id) ? list : [e.activity, ...list].slice(0, MAX_ACTIVITY)));
          setFresh((s) => new Set(s).add(e.activity.id));
          setTimeout(() => setFresh((s) => {
            const next = new Set(s);
            next.delete(e.activity.id);
            return next;
          }), 4000);
          refreshOverviewSoon();
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
          break;
        case 'presence':
          setOverview((o) => (o ? { ...o, online: e.online } : o));
          break;
        case 'installment:changed':
        case 'insights:plan':
        case 'message:new':
        case 'message:read':
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

  return { connection, overview, activity, conversations, templates, fresh, send, reset };
}
