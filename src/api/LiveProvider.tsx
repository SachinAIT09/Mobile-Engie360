import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { BillingResponse, InboxMessage, InsightsResponse, InstallmentState, LiveEvent } from '../../shared/contract';
import { useToast } from '../components/toast';
import { useI18n } from '../lib/i18n';
import { isSignedIn } from '../lib/session';
import { API, get, openEvents, post } from './client';
import { LiveCtx, localDefaults, type LiveData } from './live';

/** Customer app screens whose views are reported to staff (not the sign-in screen). */
const isCustomerRoute = (p: string) => !p.startsWith('/staff') && p !== '/login';

/**
 * Keeps the customer's changeable data (installment, savings plan, inbox) in sync with the server:
 * loads it once, applies live events, and sends the customer's changes. Without a server everything
 * still works on local state, as in the original mock-up.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { tx } = useI18n();
  const toast = useToast();
  const { pathname } = useLocation();
  const customerApp = !pathname.startsWith('/staff');
  // Only a signed-in customer is "in the app" for staff; the sign-in screen stays offline.
  const signedIn = customerApp && isSignedIn();
  const [online, setOnline] = useState(false);
  const [state, setState] = useState(localDefaults);
  const [resetVersion, setResetVersion] = useState(0);
  const onlineRef = useRef(false);
  const txRef = useRef(tx);
  const toastRef = useRef(toast);
  useEffect(() => {
    txRef.current = tx;
    toastRef.current = toast;
  });

  const load = useCallback(async () => {
    try {
      const [billing, insights, messages] = await Promise.all([get<BillingResponse>(API.billing), get<InsightsResponse>(API.insights), get<InboxMessage[]>(API.messages)]);
      setState({ installment: billing.installment, plan: insights.plan, messages });
      onlineRef.current = true;
      setOnline(true);
    } catch {
      onlineRef.current = false;
      setOnline(false);
    }
  }, []);

  // Live stream. Opening it (and every reconnect) loads the current data, so nothing is missed.
  useEffect(() => {
    const onEvent = (e: LiveEvent) => {
      switch (e.type) {
        case 'message:new':
          setState((s) => (s.messages.some((m) => m.id === e.message.id) ? s : { ...s, messages: [e.message, ...s.messages] }));
          if (e.banner) toastRef.current(`${txRef.current(e.message.title)}: ${txRef.current(e.message.body)}`);
          break;
        case 'message:read':
          setState((s) => ({ ...s, messages: s.messages.map((m) => (e.id === 'all' || m.id === e.id ? { ...m, read: true } : m)) }));
          break;
        case 'installment:changed':
          setState((s) => ({ ...s, installment: e.installment }));
          break;
        case 'insights:plan':
          setState((s) => ({ ...s, plan: e.plan }));
          break;
        case 'demo:reset':
          void load().then(() => setResetVersion((v) => v + 1));
          break;
        default:
          break;
      }
    };
    // The Customer Service view has its own stream; opening this one there would count staff as the customer.
    if (!signedIn) return;
    return openEvents('customer', onEvent, () => void load(), () => undefined);
  }, [load, signedIn]);

  const send = useCallback((path: string, body: unknown) => {
    if (!onlineRef.current) return;
    post(path, body).catch(() => undefined);
  }, []);

  // Page views, so staff see where the customer is.
  useEffect(() => {
    if (online && signedIn && isCustomerRoute(pathname)) send(API.activity, { kind: 'page', route: pathname });
  }, [online, signedIn, pathname, send]);

  const setInstallment = useCallback(async (amount: number) => {
    if (onlineRef.current) {
      const installment = await post<InstallmentState>(API.installment, { amount });
      setState((s) => ({ ...s, installment }));
      return;
    }
    setState((s) => ({ ...s, installment: { ...s.installment, pending: { amount, from: '2026-12', changedAt: new Date().toISOString() } } }));
  }, []);

  const value = useMemo<LiveData>(
    () => ({
      online,
      ...state,
      resetVersion,
      setInstallment,
      togglePlan: (id, on) => {
        setState((s) => ({ ...s, plan: on ? [...new Set([...s.plan, id])] : s.plan.filter((x) => x !== id) }));
        send(API.insightsPlan, { id, on });
      },
      markRead: (id) => {
        setState((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, read: true } : m)) }));
        send(API.messageRead(id), {});
      },
      markAllRead: () => {
        setState((s) => ({ ...s, messages: s.messages.map((m) => ({ ...m, read: true })) }));
        send(API.messagesReadAll, {});
      },
      saveContact: (c) => send(API.contact, c),
      saveCharging: (c) => send(API.charging, c),
      track: (kind, route) => send(API.activity, { kind, route }),
      resetDemo: async () => {
        if (onlineRef.current) {
          // The server answers with `demo:reset` on the stream, which reloads and remounts.
          await post(API.demoReset);
          return;
        }
        setState(localDefaults());
        setResetVersion((v) => v + 1);
      },
    }),
    [online, state, resetVersion, setInstallment, send],
  );

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
