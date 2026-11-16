import { createContext, useContext } from 'react';
import type { ChatSession } from './useChatSession';

export interface PortalAssistant {
  session: ChatSession;
  open: boolean;
  setOpen: (v: boolean) => void;
  /** Open the floating assistant and ask a question. */
  ask: (text: string) => void;
}

export const PortalAssistantCtx = createContext<PortalAssistant | null>(null);

export function usePortalAssistant(): PortalAssistant {
  const v = useContext(PortalAssistantCtx);
  if (!v) throw new Error('usePortalAssistant must be used inside PortalAssistantProvider');
  return v;
}
