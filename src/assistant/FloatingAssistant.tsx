import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { customer } from '../data/customer';
import { ChatPanel } from './ChatPanel';
import { usePortalAssistant } from './portalContext';
import type { ChatAction } from './types';
import { brand } from '../brand';

/** Eva's chat panel, opened from the Eva button in the middle of the tab bar (or by "Ask Eva" actions). */
export function FloatingAssistant() {
  const { t } = useI18n();
  const { session, open, setOpen } = usePortalAssistant();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open || pathname === '/assistant') return null;

  const onAction = (a: ChatAction) => {
    if (a.prompt) session.send(a.prompt);
    if (a.to) {
      navigate(a.to);
      if (window.matchMedia('(max-width: 960px)').matches) setOpen(false);
    }
  };

  return (
    <ChatPanel
      session={session}
      variant="widget"
      welcome={t(
        `Hi ${customer.firstName}! I’m ${brand.assistant.name}, your ${brand.name} assistant. I can see your usage, bills and contract, so ask me anything.`,
        `Hoi ${customer.firstName}! Ik ben ${brand.assistant.name}, je ${brand.name}-assistent. Ik kan je verbruik, nota’s en contract inzien, dus stel gerust je vraag.`,
      )}
      onAction={onAction}
      onClose={() => setOpen(false)}
      onExpand={() => {
        setOpen(false);
        navigate('/assistant');
      }}
    />
  );
}
