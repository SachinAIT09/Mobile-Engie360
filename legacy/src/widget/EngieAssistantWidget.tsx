/**
 * Self-contained assistant widget for embedding on a public website (e.g. engie.nl).
 * It owns its launcher, panel and session, and depends only on an AssistantProvider,
 * so it can be bundled separately and mounted into any page:
 *
 *   mountEngieAssistant(document.getElementById('engie-assistant'), { lang: 'nl' })
 */
import { useImperativeHandle, useState, forwardRef } from 'react';
import { Sparkles, X, LogIn, CheckCircle2 } from 'lucide-react';
import { ChatPanel } from '../assistant/ChatPanel';
import { MockAssistantProvider } from '../assistant/mockProvider';
import { useChatSession } from '../assistant/useChatSession';
import type { AssistantProvider, Audience, ChatAction } from '../assistant/types';
import { useI18n } from '../lib/i18n';
import { customer } from '../data/customer';
import { brand } from '../brand';

export interface EngieAssistantHandle {
  open: (question?: string) => void;
}

interface Props {
  provider?: AssistantProvider;
  /** Called for in-portal links (e.g. "Open bills"). Defaults to window.location. */
  onNavigate?: (to: string) => void;
  /** Controlled audience (the host page knows whether the visitor is signed in). */
  audience?: Audience;
  /** Starting audience when uncontrolled. */
  defaultAudience?: Audience;
  onAudienceChange?: (a: Audience) => void;
}

const defaultProvider = new MockAssistantProvider();

export const EngieAssistantWidget = forwardRef<EngieAssistantHandle, Props>(function EngieAssistantWidget(
  { provider = defaultProvider, onNavigate, audience: controlled, defaultAudience = 'visitor', onAudienceChange },
  ref,
) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [own, setOwn] = useState<Audience>(defaultAudience);
  const audience = controlled ?? own;
  const session = useChatSession(provider, { lang, route: '/website', audience });


  useImperativeHandle(ref, () => ({
    open: (q?: string) => {
      setOpen(true);
      if (q) session.send(q);
    },
  }));

  const signIn = () => {
    setOwn('customer');
    onAudienceChange?.('customer');
  };

  const onAction = (a: ChatAction) => {
    if (a.signIn) {
      signIn();
      return;
    }
    if (a.prompt) session.send(a.prompt);
    if (a.to) (onNavigate ?? ((to) => (window.location.href = to)))(a.to);
  };

  const welcome =
    audience === 'customer'
      ? t(`Welcome back ${customer.firstName}! You’re signed in, so I can answer questions about your own usage, bills and contract.`, `Welkom terug ${customer.firstName}! Je bent ingelogd, dus ik kan vragen over je eigen verbruik, nota’s en contract beantwoorden.`)
      : t(`Hi! I’m the ${brand.name} assistant. Ask me about our energy contracts, switching, or your bill. Sign in to ${brand.portal} for answers about your own account.`, `Hoi! Ik ben de ${brand.name}-assistent. Vraag me naar onze energiecontracten, overstappen of je nota. Log in bij ${brand.portal} voor antwoorden over je eigen account.`);

  return (
    <>
      {open && (
        <ChatPanel
          session={session}
          variant="widget"
          welcome={welcome}
          subtitle={audience === 'customer' ? t('Signed in as Sanne de Vries (demo)', 'Ingelogd als Sanne de Vries (demo)') : undefined}
          onAction={onAction}
          onClose={() => setOpen(false)}
          intro={
            audience === 'visitor' ? (
              <button className="chat-action" style={{ alignSelf: 'flex-start' }} onClick={signIn}>
                <LogIn size={14} /> {t(`Sign in to ${brand.portal} (demo)`, `Inloggen ${brand.portal} (demo)`)}
              </button>
            ) : (
              <span className="badge ok" style={{ alignSelf: 'flex-start' }}>
                <CheckCircle2 size={13} /> {t('Account linked', 'Account gekoppeld')}
              </span>
            )
          }
        />
      )}
      <button
        className={`chat-fab${open ? ' open' : ''}`}
        style={{ background: open ? 'var(--navy)' : 'var(--blue)' }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? t('Close assistant', 'Sluit assistent') : t(`Ask ${brand.name}`, `Vraag het ${brand.name}`)}
      >
        <span className="orb" style={{ background: open ? 'transparent' : 'rgba(255,255,255,0.18)' }}>
          {open ? <X size={22} /> : <Sparkles size={20} />}
        </span>
        {!open && <span className="lbl">{t(`Questions? Ask ${brand.name}`, `Vragen? Vraag het ${brand.name}`)}</span>}
      </button>
    </>
  );
});
