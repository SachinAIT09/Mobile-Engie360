import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ExternalLink, LayoutDashboard, LayoutGrid, MessageSquareText, Send, Settings, Smartphone, TabletSmartphone } from 'lucide-react';
import { Brand } from '../components/Layout';
import { PresenterBar } from '../components/PresenterBar';
import { RailShell, type RailItem } from '../components/RailShell';
import { useToast } from '../components/toast';
import { useI18n } from '../lib/i18n';
import { brand } from '../brand';
import type { StaffCtx } from './context';
import { TopActions } from './parts';
import { useStaffData } from './useStaffData';
import StaffDashboard from './pages/Dashboard';
import './staff.css';

const StaffActivity = lazy(() => import('./pages/Activity'));
const StaffConversations = lazy(() => import('./pages/Conversations'));
const StaffMessages = lazy(() => import('./pages/Messages'));
const DemoPanel = lazy(() => import('./pages/DemoPanel'));
const StaffPreview = lazy(() => import('./pages/Preview'));

/** Rail, top bar and presenter bar around every staff page; loads the live data once for all of them. */
function StaffLayout() {
  const { t } = useI18n();
  const toast = useToast();
  const data = useStaffData();
  const [navOpen, setNavOpen] = useState(false);

  // Ticks so "last seen" and "2 min ago" stay current between events.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
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

  const ctx = useMemo<StaffCtx>(() => ({ ...data, confirmReset, now }), [data, confirmReset, now]);

  const sections: RailItem[] = [
    { key: 'dash', icon: LayoutDashboard, label: t('Dashboard', 'Dashboard'), to: '/staff', end: true },
    { key: 'activity', icon: Smartphone, label: t('Customer activity', 'Klantactiviteit'), to: '/staff/activity' },
    { key: 'conv', icon: MessageSquareText, label: t(`${brand.assistant.name} conversations`, `Gesprekken met ${brand.assistant.name}`), to: '/staff/conversations' },
    { key: 'messages', icon: Send, label: t('Messages', 'Berichten'), to: '/staff/messages' },
  ];
  const demo: RailItem[] = [
    { key: 'demo', icon: Settings, label: t('Demo control panel', 'Demo-bedieningspaneel'), to: '/staff/demo' },
    { key: 'preview', icon: TabletSmartphone, label: t('Phone preview', 'Telefoonweergave'), to: '/staff/preview' },
    { key: 'portal', icon: ExternalLink, label: t(`Open ${brand.portal}`, `Open ${brand.portal}`), href: '/app', newTab: true },
    { key: 'start', icon: LayoutGrid, label: t('Start page', 'Startpagina'), href: '/' },
  ];

  return (
    <RailShell
      logo={<Brand sub={t('Customer Service', 'Klantenservice')} />}
      logoTo="/staff"
      logoLabel={`${brand.name} ${t('Customer Service', 'Klantenservice')}`}
      sections={sections}
      demo={demo}
      navOpen={navOpen}
      setNavOpen={setNavOpen}
      actions={<TopActions connection={data.connection} />}
      after={<PresenterBar onReset={doReset} />}
    >
      <div className="staff">
        <main className="staff-main">
          {data.connection === 'down' && !data.overview && (
            <div className="card staff-offline" role="alert">
              <h2>{t('The demo server is not running', 'De demoserver draait niet')}</h2>
              <p className="small">
                {t('This app needs the server for live data. Start everything with start-demo.cmd (or npm start) and open it on port 3000.', 'Deze app heeft de server nodig voor live data. Start alles met start-demo.cmd (of npm start) en open hem op poort 3000.')}
              </p>
            </div>
          )}
          <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
            <Outlet context={ctx} />
          </Suspense>
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
        <Route path="activity" element={<StaffActivity />} />
        <Route path="conversations" element={<StaffConversations />} />
        <Route path="messages" element={<StaffMessages />} />
        <Route path="demo" element={<DemoPanel />} />
        <Route path="preview" element={<StaffPreview />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/staff" replace />} />
    </Routes>
  );
}
