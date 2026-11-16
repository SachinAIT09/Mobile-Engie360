import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/Layout';
import { PresenterBar } from './components/PresenterBar';
import { PortalAssistantProvider } from './assistant/PortalAssistant';
import { useLive } from './api/live';
import { syncPush } from './api/push';

// Route-level code splitting keeps the first load small; everything is preloaded right after.
const loaders = {
  dashboard: () => import('./pages/Dashboard'),
  energy: () => import('./pages/Energy'),
  billing: () => import('./pages/Billing'),
  insights: () => import('./pages/Insights'),
  smart: () => import('./pages/SmartEnergy'),
  assistant: () => import('./pages/Assistant'),
  account: () => import('./pages/Account'),
  preview: () => import('./pages/MobilePreview'),
  staff: () => import('./staff/StaffApp'),
};
const Dashboard = lazy(loaders.dashboard);
const Energy = lazy(loaders.energy);
const Billing = lazy(loaders.billing);
const Insights = lazy(loaders.insights);
const SmartEnergy = lazy(loaders.smart);
const Assistant = lazy(loaders.assistant);
const Account = lazy(loaders.account);
const MobilePreview = lazy(loaders.preview);
const StaffApp = lazy(loaders.staff);


export default function App() {
  // Preload every screen so navigation during a live demo never shows a blank frame.
  useEffect(() => {
    const id = setTimeout(() => Object.values(loaders).forEach((load) => void load()), 800);
    return () => clearTimeout(id);
  }, []);

  // Bumped by "Reset demo" (presenter bar or staff app): remounts every screen so local state starts fresh.
  const { resetVersion, resetDemo, online } = useLive();

  // Keep this browser registered for phone notifications after a server restart (no prompt).
  useEffect(() => {
    if (online) void syncPush().catch(() => undefined);
  }, [online]);

  return (
    <PortalAssistantProvider>
      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
      <Routes key={resetVersion}>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="energy" element={<Energy />} />
          <Route path="billing" element={<Billing />} />
          <Route path="insights" element={<Insights />} />
          <Route path="smart-energy" element={<SmartEnergy />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route path="mobile-preview" element={<MobilePreview />} />
        <Route path="staff" element={<StaffApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <PresenterBar onReset={() => void resetDemo()} />
    </PortalAssistantProvider>
  );
}
