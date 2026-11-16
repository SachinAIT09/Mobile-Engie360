import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../lib/I18nProvider';
import { EngieAssistantWidget } from './EngieAssistantWidget';

/** Mount the widget into any DOM node, independent of the portal app. */
export function mountEngieAssistant(el: HTMLElement, opts: { lang?: 'nl' | 'en' } = {}) {
  try {
    if (opts.lang) localStorage.setItem('engie-demo-lang', opts.lang);
  } catch {
    /* ignore */
  }
  const root = createRoot(el);
  root.render(
    <I18nProvider>
      <EngieAssistantWidget />
    </I18nProvider>,
  );
  return () => root.unmount();
}
