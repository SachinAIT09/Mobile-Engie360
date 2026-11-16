import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from './lib/I18nProvider';
import { ThemeProvider } from './lib/ThemeProvider';
import { ToastProvider } from './components/ui';
import App from './App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
