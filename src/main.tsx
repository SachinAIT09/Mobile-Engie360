import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './lib/I18nProvider';
import { ThemeProvider } from './lib/ThemeProvider';
import { ToastProvider } from './components/ui';
import { LiveProvider } from './api/LiveProvider';
import App from './App';
// Lato is bundled with the app (no Google Fonts request), so the demo looks right offline and behind firewalls.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <LiveProvider>
            <App />
          </LiveProvider>
        </ToastProvider>
      </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
