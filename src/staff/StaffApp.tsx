import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { BarChart3, History, LayoutDashboard, RotateCw, Send, Settings, Smartphone, Sparkles, Users } from 'lucide-react';
import type { Activity, ActivityKind } from '../../shared/contract';
import { Brand } from '../components/Layout';
import { PresenterBar } from '../components/PresenterBar';
import { RailShell, type RailItem } from '../components/RailShell';
import { useToast } from '../components/toast';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';
import type { StaffCtx } from './context';
import { KIND_ICON, KIND_LABEL, LIVE_CUSTOMER_ID } from './kinds';
import { TopActions } from './parts';
import { useStaffAssistant } from './useStaffAssistant';
import { useStaffData } from './useStaffData';
import StaffDashboard from './pages/Dashboard';
import './staff.css';

// Each page is its own chunk; all of them are fetched right after the first screen, so moving
// between pages never waits on the network (as the customer app does for its screens).
const loaders = {
  customers: () => import('./pages/Customers'),
  customer: () => import('./pages/Customer'),
  activity: () => import('./pages/Activity'),
  messages: () => import('./pages/Messages'),
  assistant: () => import('./pages/Assistant'),
  reports: () => import('./pages/Reports'),
  audit: () => import('./pages/Audit'),
  demo: () => import('./pages/DemoPanel'),
};
const StaffCustomers = lazy(loaders.customers);
const StaffCustomer = lazy(loaders.customer);
const StaffActivity = lazy(loaders.activity);
const StaffMessages = lazy(loaders.messages);
const StaffAssistant = lazy(loaders.assistant);
const StaffReports = lazy(loaders.reports);
const StaffAudit = lazy(loaders.audit);
const DemoPanel = lazy(loaders.demo);

/** What the customer does that is worth a pop-up for staff (not plain screen views or staff's own messages). */
const NOTIFY: ReadonlySet<ActivityKind> = new Set(['session', 'installment', 'plan', 'charging', 'contact', 'push_subscribed', 'chat', 'message_read', 'invoice_download']);

/** Rail, top bar and presenter bar around every staff page; loads the live data once for all of them. */
function StaffLayout() {
  const { t, tx, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();

  // A banner when the customer does something, linking to the customer page.
  const onActivity = useCallback(
    (a: Activity) => {
      if (!NOTIFY.has(a.kind)) return;
      const Icon = KIND_ICON[a.kind];
      toast({
        title: tx(KIND_LABEL[a.kind]),
        body: tx(a.text),
        icon: (
          <span className="kpi-ic el" style={{ width: 38, height: 38 }}>
            <Icon size={18} />
          </span>
        ),
        onOpen: () => navigate(`/staff/customers/${LIVE_CUSTOMER_ID}`),
      });
    },
    [toast, tx, navigate],
  );
  const data = useStaffData(onActivity);
  const assistant = useStaffAssistant(lang);
  const [navOpen, setNavOpen] = useState(false);

  // Ticks so "last seen" and "2 min ago" stay current between events.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => Object.values(loaders).forEach((load) => void load()), 800);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = `${brand.name} ${t('Customer Service', 'Klantenservice')}`;
    return () => {
      document.title = prev;
    };
  }, [t]);

  const { reset } = data;
  const doReset = useCallback(() => {
    reset().then(
      () => toast(t('Demo reset', 'Demo gereset')),
      () => toast(t('Could not reset the demo', 'De demo kon niet worden gereset')),
    );
  }, [reset, t, toast]);
  const confirmReset = useCallback(() => {
    if (window.confirm(t('Reset the demo? Messages, conversations and changes go back to the start.', 'Demo resetten? Berichten, gesprekken en wijzigingen gaan terug naar het begin.'))) doReset();
  }, [doReset, t]);

  const ctx = useMemo<StaffCtx>(() => ({ ...data, confirmReset, now, assistant }), [data, confirmReset, now, assistant]);

  const sections: RailItem[] = [
    { key: 'dash', icon: LayoutDashboard, label: t('Dashboard', 'Dashboard'), to: '/staff', end: true },
    { key: 'customers', icon: Users, label: t('Customers', 'Klanten'), to: '/staff/customers' },
    { key: 'activity', icon: Smartphone, label: t('Customer activity', 'Klantactiviteit'), to: '/staff/activity' },
    { key: 'messages', icon: Send, label: t('Messages', 'Berichten'), to: '/staff/messages' },
    { key: 'reports', icon: BarChart3, label: t('Reports', 'Rapporten'), to: '/staff/reports' },
    { key: 'assistant', icon: Sparkles, label: brand.assistant.name, to: '/staff/assistant' },
  ];
  const demo: RailItem[] = [
    { key: 'demo', icon: Settings, label: t('Demo control panel', 'Demo-bedieningspaneel'), to: '/staff/demo' },
    { key: 'audit', icon: History, label: t('Audit log', 'Auditlog'), to: '/staff/audit' },
  ];

  return (
    <RailShell
      logo={<Brand sub={t('Customer Service', 'Klantenservice')} />}
      logoTo="/staff"
      logoLabel={`${brand.name} ${t('Customer Service', 'Klantenservice')}`}
      ask={{ label: t(`Ask ${brand.assistant.name}…`, `Vraag ${brand.assistant.name}…`), to: '/staff/assistant' }}
      sections={sections}
      demo={demo}
      navOpen={navOpen}
      setNavOpen={setNavOpen}
      actions={<TopActions connection={data.connection} activity={data.activity} now={now} />}
      after={<PresenterBar onReset={doReset} />}
    >
      <div className="staff">
        <main className="staff-main">
          {data.connection === 'down' && (
            <div className="card staff-offline" role="alert">
              <div className="grow">
                <h2>{data.overview ? t('Connection lost', 'Verbinding verbroken') : t('The server is not reachable', 'De server is niet bereikbaar')}</h2>
                <p className="small">
                  {data.overview
                    ? t('You are looking at the last data received. Live updates continue as soon as the connection is back.', 'Je ziet de laatst ontvangen gegevens. Live updates gaan verder zodra de verbinding terug is.')
                    : t('This app needs the server for live data. Start everything with start-demo.cmd (or npm start) and open it on port 3000.', 'Deze app heeft de server nodig voor live data. Start alles met start-demo.cmd (of npm start) en open hem op poort 3000.')}
                </p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={data.retry}>
                <RotateCw size={14} /> {t('Try again', 'Opnieuw proberen')}
              </button>
            </div>
          )}
          {data.connection === 'connecting' && !data.overview ? (
            <div className="staff-skel" aria-busy="true" aria-label={t('Loading', 'Laden')}>
              <div className="staff-skel-row">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="skel" style={{ height: 150 }} />
                ))}
              </div>
              <div className="staff-skel-row two">
                <span className="skel" style={{ height: 320 }} />
                <span className="skel" style={{ height: 320 }} />
              </div>
            </div>
          ) : (
            <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
              <Outlet context={ctx} />
            </Suspense>
          )}
        </main>
      </div>
    </RailShell>
  );
}

/** ENGIE Customer Service (the staff app at /staff), a multi-page dashboard like the Hydro Mobile360 staff app. */
export default function StaffApp() {
  return (
    <Routes>
      <Route path="/staff" element={<StaffLayout />}>
        <Route index element={<StaffDashboard />} />
        <Route path="customers" element={<StaffCustomers />} />
        <Route path="customers/:id" element={<StaffCustomer />} />
        <Route path="customer" element={<Navigate to={`/staff/customers/${LIVE_CUSTOMER_ID}`} replace />} />
        <Route path="activity" element={<StaffActivity />} />
        {/* The separate conversations page is gone; a customer's chats are on their own page. */}
        <Route path="conversations" element={<Navigate to={`/staff/customers/${LIVE_CUSTOMER_ID}?tab=eva`} replace />} />
        <Route path="messages" element={<StaffMessages />} />
        <Route path="assistant" element={<StaffAssistant />} />
        <Route path="reports" element={<StaffReports />} />
        <Route path="audit" element={<StaffAudit />} />
        <Route path="demo" element={<DemoPanel />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/staff" replace />} />
    </Routes>
  );
}
