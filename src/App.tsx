import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { syncFrameUrl } from './lib/frame';
import { AppShell } from './components/Layout';
import { PortalAssistantProvider } from './assistant/PortalAssistant';
import { useLive } from './api/live';
import { syncPush } from './api/push';
import { isSignedIn } from './lib/session';

// Route-level code splitting keeps the first load small; everything is preloaded right after.
const loaders = {
  dashboard: () => import('./pages/Dashboard'),
  energy: () => import('./pages/Energy'),
  billing: () => import('./pages/Billing'),
  insights: () => import('./pages/Insights'),
  smart: () => import('./pages/SmartEnergy'),
  assistant: () => import('./pages/Assistant'),
  account: () => import('./pages/Account'),
  login: () => import('./pages/Login'),
};
const Dashboard = lazy(loaders.dashboard);
const Energy = lazy(loaders.energy);
const Billing = lazy(loaders.billing);
const Insights = lazy(loaders.insights);
const SmartEnergy = lazy(loaders.smart);
const Assistant = lazy(loaders.assistant);
const Account = lazy(loaders.account);
const Login = lazy(loaders.login);

// Both guards are components so the sign-in check runs on every navigation, not once when App rendered.
/** The app needs a signed-in customer; otherwise it opens on the sign-in screen. */
function RequireSignIn() {
  return isSignedIn() ? <AppShell /> : <Navigate to="/login" replace />;
}

/** Already signed in → straight to the app. */
function LoginRoute() {
  return isSignedIn() ? <Navigate to="/" replace /> : <Login />;
}


export default function App() {
  // Preload every screen so navigation during a live demo never shows a blank frame.
  useEffect(() => {
    const id = setTimeout(() => Object.values(loaders).forEach((load) => void load()), 800);
    return () => clearTimeout(id);
  }, []);

  // In the laptop phone column, the address bar follows the screen shown inside it.
  const location = useLocation();
  useEffect(() => syncFrameUrl(), [location]);

  // Bumped by "Reset demo" (from the staff app or start page): remounts every screen so local state starts fresh.
  const { resetVersion, online } = useLive();

  // Keep this browser registered for phone notifications after a server restart (no prompt).
  useEffect(() => {
    if (online) void syncPush().catch(() => undefined);
  }, [online]);

  return (
    <PortalAssistantProvider>
      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
      <Routes key={resetVersion}>
        <Route path="login" element={<LoginRoute />} />
        <Route element={<RequireSignIn />}>
          <Route index element={<Dashboard />} />
          <Route path="energy" element={<Energy />} />
          <Route path="billing" element={<Billing />} />
          <Route path="insights" element={<Insights />} />
          <Route path="smart-energy" element={<SmartEnergy />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="account" element={<Account />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </PortalAssistantProvider>
  );
}
