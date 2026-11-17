import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BillingResponse, InboxMessage, InsightsResponse, InstallmentState, LiveEvent, PayMethod, PayState } from '../../shared/contract';
import { withPayments, type Payment } from '../data/billing';
import { DEMO_NOW } from '../lib/time';
import { useToast } from '../components/toast';
import { InsightIc } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { isFreshLaunch, isSignedIn } from '../lib/session';
import { API, get, openEvents, post } from './client';
import { LiveCtx, localDefaults, type LiveData } from './live';

/**
 * Closing the customer app and opening it again starts from the original data: the first launch restores it
 * on the server before anything is loaded. Kept at module level so it runs once, whatever React re-runs.
 */
let launchReset: Promise<unknown> | null = null;
function afterLaunchReset(): Promise<unknown> {
  if (!launchReset) launchReset = isFreshLaunch() ? post(API.demoReset).catch(() => undefined) : Promise.resolve();
  return launchReset;
}

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
  const navigate = useNavigate();
  const customerApp = !pathname.startsWith('/staff');
  // Only a signed-in customer is "in the app" for staff; the sign-in screen stays offline.
  const signedIn = customerApp && isSignedIn();
  const [online, setOnline] = useState(false);
  const [state, setState] = useState(localDefaults);
  const [resetVersion, setResetVersion] = useState(0);
  const onlineRef = useRef(false);
  // Whether there is a server is only known once the first load has answered. An action taken before that
  // (a tap right after the app opens) waits for the answer instead of being treated as "no server" and lost.
  const [firstLoad] = useState(() => {
    let done: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => (done = resolve));
    return { promise, done };
  });
  const whenKnown = useCallback(() => Promise.race([firstLoad.promise, new Promise<void>((r) => setTimeout(r, 5000))]), [firstLoad]);
  const send = useCallback(
    (path: string, body: unknown) => {
      void whenKnown().then(() => {
        if (onlineRef.current) post(path, body).catch(() => undefined);
      });
    },
    [whenKnown],
  );

  const txRef = useRef(tx);
  const toastRef = useRef(toast);
  /** Tapping a message banner: mark it read and open the screen it points to. */
  const openMessageRef = useRef<(m: InboxMessage) => void>(() => undefined);
  useEffect(() => {
    txRef.current = tx;
    toastRef.current = toast;
    openMessageRef.current = (m) => {
      setState((s) => ({ ...s, messages: s.messages.map((x) => (x.id === m.id ? { ...x, read: true } : x)) }));
      send(API.messageRead(m.id), {});
      navigate(m.to);
    };
  });

  const load = useCallback(async () => {
    try {
      const [billing, insights, messages] = await Promise.all([get<BillingResponse>(API.billing), get<InsightsResponse>(API.insights), get<InboxMessage[]>(API.messages)]);
      setState({ installment: billing.installment, pay: billing.pay, plan: insights.plan, messages });
      onlineRef.current = true;
      setOnline(true);
    } catch {
      onlineRef.current = false;
      setOnline(false);
    }
    firstLoad.done();
  }, [firstLoad]);

  // Live stream. Opening it (and every reconnect) loads the current data, so nothing is missed.
  useEffect(() => {
    const onEvent = (e: LiveEvent) => {
      switch (e.type) {
        case 'message:new':
          setState((s) => (s.messages.some((m) => m.id === e.message.id) ? s : { ...s, messages: [e.message, ...s.messages] }));
          if (e.banner) {
            const m = e.message;
            toastRef.current({
              title: txRef.current(m.title),
              body: txRef.current(m.body),
              icon: <InsightIc icon={m.icon} kind={m.icon === 'moon' ? 'alert' : m.icon === 'wallet' ? 'billing' : undefined} size={38} />,
              onOpen: () => openMessageRef.current(m),
            });
          }
          break;
        case 'message:read':
          setState((s) => ({ ...s, messages: s.messages.map((m) => (e.id === 'all' || m.id === e.id ? { ...m, read: true } : m)) }));
          break;
        case 'installment:changed':
          setState((s) => ({ ...s, installment: e.installment }));
          break;
        case 'billing:changed':
          setState((s) => ({ ...s, pay: e.pay }));
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
    if (!customerApp) return;
    let close = () => {};
    let cancelled = false;
    // A fresh launch restores the data first; the stream (which loads the data) opens only after that.
    void afterLaunchReset().then(() => {
      if (!cancelled && signedIn) close = openEvents('customer', onEvent, () => void load(), () => undefined);
    });
    return () => {
      cancelled = true;
      close();
    };
  }, [load, signedIn, customerApp]);

  // Page views, so staff see where the customer is.
  useEffect(() => {
    if (online && signedIn && isCustomerRoute(pathname)) send(API.activity, { kind: 'page', route: pathname });
  }, [online, signedIn, pathname, send]);

  const setInstallment = useCallback(async (amount: number) => {
    await whenKnown();
    if (onlineRef.current) {
      const installment = await post<InstallmentState>(API.installment, { amount });
      setState((s) => ({ ...s, installment }));
      return;
    }
    setState((s) => ({ ...s, installment: { ...s.installment, pending: { amount, from: '2026-12', changedAt: new Date().toISOString() } } }));
  }, [whenKnown]);

  const payRef = useRef(state.pay);
  useEffect(() => {
    payRef.current = state.pay;
  });

  const payInvoice = useCallback(async (invoiceId: string, method: PayMethod, bank?: string): Promise<Payment> => {
    let pay: PayState;
    await whenKnown();
    if (onlineRef.current) {
      pay = await post<PayState>(API.pay, { invoiceId, method, bank });
    } else {
      // No server: record it locally, the same way the server would.
      const before = payRef.current;
      const inv = withPayments(before).outstanding.find((i) => i.id === invoiceId);
      if (!inv) throw new Error('This invoice is already paid');
      const label = method === 'ideal' ? `iDEAL${bank ? ` · ${bank}` : ''}` : null;
      const via = label ? { en: label, nl: label } : method === 'account' ? { en: 'Bank account', nl: 'Bankrekening' } : { en: 'Card', nl: 'Kaart' };
      pay = { ...before, paid: [{ id: `PAY-${90400 + before.paid.length}`, date: DEMO_NOW.toISOString().slice(0, 10), amount: inv.amount, method: via, invoiceId, status: 'success' }, ...before.paid] };
    }
    setState((s) => ({ ...s, pay }));
    return pay.paid.find((p) => p.invoiceId === invoiceId)!;
  }, [whenKnown]);

  const value = useMemo<LiveData>(
    () => ({
      online,
      ...state,
      resetVersion,
      setInstallment,
      payInvoice,
      setAutopay: (on) => {
        setState((s) => ({ ...s, pay: { ...s.pay, autopay: on } }));
        send(API.autopay, { on });
      },
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
        await whenKnown();
        if (onlineRef.current) {
          // The server answers with `demo:reset` on the stream, which reloads and remounts.
          await post(API.demoReset);
          return;
        }
        setState(localDefaults());
        setResetVersion((v) => v + 1);
      },
    }),
    [online, state, resetVersion, setInstallment, payInvoice, send, whenKnown],
  );

  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}
