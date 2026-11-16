import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './lib/I18nProvider';
import { ThemeProvider } from './lib/ThemeProvider';
import { ToastProvider } from './components/ui';
import { LiveProvider } from './api/LiveProvider';
import Root from './Root';
import { isPortalPath, isStaffPath, portalUrl } from './lib/routes';
// Lato is bundled with the app (no Google Fonts request), so the demo looks right offline and behind firewalls.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './styles/global.css';

// Two apps, one bundle: /staff is the staff app; everything else is the customer portal under /app.
// Old portal links (/energy, /billing?adjust=1…) are moved under /app before the router starts.
const { pathname, search, hash } = window.location;
const staff = isStaffPath(pathname);
if (!staff && !isPortalPath(pathname)) window.history.replaceState(null, '', `${portalUrl(pathname)}${search}${hash}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={staff ? undefined : '/app'}>
      <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <LiveProvider>
            <Root staff={staff} />
          </LiveProvider>
        </ToastProvider>
      </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
