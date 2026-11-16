import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PortalAssistantCtx } from './portalContext';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { MockAssistantProvider } from './mockProvider';
import { useChatSession } from './useChatSession';

// Swap for a real provider (e.g. an HTTP client to an LLM backend) without touching the UI.
const provider = new MockAssistantProvider();

/** One chat session for the whole portal, shared by the floating widget and the full-page view. */
export function PortalAssistantProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const { pathname } = useLocation();
  const session = useChatSession(provider, { lang, route: pathname, audience: 'customer' });
  const [open, setOpen] = useState(false);

  const ask = useCallback(
    (text: string) => {
      if (pathname !== '/assistant') setOpen(true);
      session.send(text);
    },
    [pathname, session],
  );

  const value = useMemo(() => ({ session, open, setOpen, ask }), [session, open, ask]);
  return <PortalAssistantCtx.Provider value={value}>{children}</PortalAssistantCtx.Provider>;
}
