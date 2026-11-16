import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, Gauge, Lightbulb, Plug, ShieldCheck, Sun, Zap, Database } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { customer } from '../data/customer';
import { ChatPanel } from '../assistant/ChatPanel';
import { usePortalAssistant } from '../assistant/portalContext';
import type { ChatAction } from '../assistant/types';
import { Card } from '../components/ui';
import { brand } from '../brand';

const PRESETS: Record<string, [string, string]> = {
  solar: ['How much could I save with solar panels?', 'Hoeveel kan ik besparen met zonnepanelen?'],
};

export default function Assistant() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { session } = usePortalAssistant();
  const sent = useRef(false);

  useEffect(() => {
    const q = params.get('q');
    const preset = q ? PRESETS[q] : undefined;
    if (preset && !sent.current) {
      sent.current = true;
      session.send(t(preset[0], preset[1]));
      setParams({}, { replace: true });
    }
  }, [params, session, setParams, t]);

  const onAction = (a: ChatAction) => {
    if (a.prompt) session.send(a.prompt);
    if (a.to) navigate(a.to);
  };

  const topics = [
    { icon: Gauge, label: t('Usage & comparisons', 'Verbruik & vergelijkingen'), q: t('How much energy did I consume this month?', 'Hoeveel energie heb ik deze maand verbruikt?') },
    { icon: CreditCard, label: t('Bills & installment', 'Nota’s & termijnbedrag'), q: t('Can you explain my latest invoice?', 'Kun je mijn laatste nota uitleggen?') },
    { icon: Lightbulb, label: t('Saving advice', 'Bespaaradvies'), q: t('How can I reduce my electricity costs?', 'Hoe kan ik mijn stroomkosten verlagen?') },
    { icon: Plug, label: t('EV charging', 'Auto laden'), q: t('When should I charge my EV?', 'Wanneer kan ik mijn auto het best laden?') },
    { icon: Sun, label: t('Solar panels', 'Zonnepanelen'), q: t('How much could I save with solar panels?', 'Hoeveel kan ik besparen met zonnepanelen?') },
    { icon: Zap, label: t('My contract', 'Mijn contract'), q: t('What contract do I have?', 'Wat voor contract heb ik?') },
  ];

  return (
    <div className="grid g-main" style={{ marginTop: 10 }}>
      <div style={{ height: 'calc(100vh - var(--topbar-h) - 40px)', minHeight: 520 }} className="assistant-page">
        <ChatPanel
          session={session}
          variant="page"
          welcome={t(
            `Hi ${customer.firstName}! I’m your ${brand.name} assistant. I know your usage, bills and contract, so ask me anything or pick a topic.`,
            `Hoi ${customer.firstName}! Ik ben je ${brand.name}-assistent. Ik ken je verbruik, nota’s en contract, dus stel je vraag of kies een onderwerp.`,
          )}
          onAction={onAction}
        />
      </div>
      <div className="stack hide-m">
        <Card title={t('I can help with', 'Ik help je met')}>
          <div className="list">
            {topics.map((tp) => (
              <button key={tp.label} className="menu-item" style={{ padding: '10px 4px', borderRadius: 10 }} onClick={() => session.send(tp.q)}>
                <span className="kpi-ic el" style={{ width: 32, height: 32 }}>
                  <tp.icon size={16} />
                </span>
                {tp.label}
              </button>
            ))}
          </div>
        </Card>
        <Card title={t('What the assistant uses', 'Wat de assistent gebruikt')}>
          <div className="stack small" style={{ gap: 10 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Database size={16} color="#00aaff" style={{ flex: 'none', marginTop: 3 }} />
              <span className="muted">{t(`Your usage, invoices, contract and ${brand.partners.disaggregation} appliance data (sample data in this demo).`, `Je verbruik, nota’s, contract en ${brand.partners.disaggregation}-apparaatdata (voorbeelddata in deze demo).`)}</span>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <ShieldCheck size={16} color="#13855f" style={{ flex: 'none', marginTop: 3 }} />
              <span className="muted">{t('Answers stay inside your account. Hand-over to a human agent is always one question away.', 'Antwoorden blijven binnen je account. Doorverbinden met een medewerker is altijd één vraag verwijderd.')}</span>
            </div>
          </div>
          <p className="xs muted mt" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
            {t('Prototype: replies are scripted. The provider interface is ready for an LLM backend.', 'Prototype: antwoorden zijn vooraf ingesteld. De provider-interface is klaar voor een LLM-backend.')}
          </p>
        </Card>
      </div>
    </div>
  );
}
