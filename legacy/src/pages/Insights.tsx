import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, PiggyBank, Plus, Sparkles, Target } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { insights, type Insight, type InsightKind } from '../data/insights';
import { benchmark } from '../data/energy';
import { contract } from '../data/customer';
import { Card, DemoFlag, InsightIc, N2GBadge, PageHead, Seg } from '../components/ui';
import { useToast } from '../components/toast';
import { usePortalAssistant } from '../assistant/portalContext';
import { brand } from '../brand';

type Filter = 'all' | InsightKind;

function InsightCard({ i, planned, onToggle }: { i: Insight; planned: boolean; onToggle: () => void }) {
  const { t, tx, eur } = useI18n();
  const [open, setOpen] = useState(false);
  const kindLabel: Record<InsightKind, string> = {
    alert: t('Alert', 'Melding'),
    saving: t('Saving', 'Besparing'),
    tip: t('Tip', 'Tip'),
    billing: t('Billing', 'Betalen'),
  };
  const kindTone: Record<InsightKind, string> = { alert: 'warn', saving: 'ok', tip: 'info', billing: 'neutral' };

  return (
    <div className="card" id={i.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, outline: planned ? '2px solid var(--green)' : undefined }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <InsightIc icon={i.icon} kind={i.kind} size={42} />
        <span className="row" style={{ gap: 6 }}>
          {i.source === 'net2grid' && <N2GBadge />}
          <span className={`badge ${kindTone[i.kind]}`}>{kindLabel[i.kind]}</span>
        </span>
      </div>
      <div>
        <h3 style={{ fontSize: 16 }}>{tx(i.title)}</h3>
        <p className="small muted" style={{ marginTop: 4 }}>
          {tx(i.body)}
        </p>
        {i.detail && (
          <>
            {open && (
              <p className="small" style={{ marginTop: 8, background: 'var(--bg)', padding: 10, borderRadius: 10 }}>
                {tx(i.detail)}
              </p>
            )}
            <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }} onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? t('Less detail', 'Minder details') : t('How we know this', 'Hoe we dit weten')}
            </button>
          </>
        )}
      </div>
      <div className="row between wrap" style={{ marginTop: 'auto', borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
        {i.saving ? (
          <span>
            <span className="xs muted strong" style={{ display: 'block' }}>
              {t('Estimated saving', 'Geschatte besparing')}
            </span>
            <span className="save num" style={{ fontSize: 18 }}>
              {eur(i.saving, 0)}
              <span className="small muted"> {t('/ year', '/ jaar')}</span>
            </span>
          </span>
        ) : (
          <span />
        )}
        <span className="row" style={{ gap: 6 }}>
          {i.to && i.cta && (
            <Link to={i.to} className="btn btn-outline btn-sm">
              {tx(i.cta)}
            </Link>
          )}
          {i.saving && (
            <button className={`btn btn-sm ${planned ? 'btn-dark' : 'btn-primary'}`} onClick={onToggle} aria-pressed={planned}>
              {planned ? <Check size={15} /> : <Plus size={15} />} {planned ? t('In my plan', 'In mijn plan') : t('Add to plan', 'Toevoegen')}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export default function Insights() {
  const { t, eur, num } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { ask } = usePortalAssistant();
  const [filter, setFilter] = useState<Filter>('all');
  const [plan, setPlan] = useState<string[]>(['ev-peak']);

  const list = insights.filter((i) => filter === 'all' || i.kind === filter);
  const planned = insights.filter((i) => plan.includes(i.id));
  const planTotal = planned.reduce((s, i) => s + (i.saving ?? 0), 0);
  const potential = insights.reduce((s, i) => s + (i.saving ?? 0), 0);

  const toggle = (id: string) => {
    const has = plan.includes(id);
    toast(has ? t('Removed from your savings plan', 'Verwijderd uit je bespaarplan') : t('Added to your savings plan', 'Toegevoegd aan je bespaarplan'));
    setPlan((p) => (has ? p.filter((x) => x !== id) : [...p, id]));
  };

  return (
    <>
      <PageHead
        eyebrow={t('Energy insights', 'Energie-inzichten')}
        title={t('Personal advice for your home', 'Persoonlijk advies voor jouw woning')}
        sub={t('Based on 15-minute smart-meter data and appliance recognition.', 'Op basis van kwartierdata van je slimme meter en apparaatherkenning.')}
      >
        <Seg
          label={t('Filter', 'Filter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('All', 'Alle') },
            { value: 'saving', label: t('Savings', 'Besparen') },
            { value: 'alert', label: t('Alerts', 'Meldingen') },
            { value: 'tip', label: t('Tips', 'Tips') },
          ]}
        />
      </PageHead>

      <div className="grid g-main">
        <section className="card hero">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="kpi-ic" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                <PiggyBank size={20} />
              </span>
              <span className="small muted strong">{t('Your savings potential', 'Je besparingspotentieel')}</span>
            </div>
            <div className="num" style={{ fontSize: 44, fontWeight: 900, marginTop: 10, letterSpacing: '-0.02em' }}>
              {eur(potential, 0)}
              <span style={{ fontSize: 16, opacity: 0.7 }}> {t('/ year', '/ jaar')}</span>
            </div>
            <p className="muted" style={{ maxWidth: 520 }}>
              {t('That’s', 'Dat is')} {Math.round((potential / contract.estimatedAnnualCost) * 100)}% {t('of your estimated yearly energy costs, including solar panels.', 'van je geschatte jaarlijkse energiekosten, inclusief zonnepanelen.')}
            </p>
            <button className="btn btn-primary mt" onClick={() => ask(t('How can I reduce my electricity costs?', 'Hoe kan ik mijn stroomkosten verlagen?'))}>
              <Sparkles size={16} /> {t(`Talk it through with ${brand.assistant.name}`, `Bespreek het met ${brand.assistant.name}`)}
            </button>
          </div>
        </section>
        <Card title={t('My savings plan', 'Mijn bespaarplan')} action={<Target size={20} color="#23d2b5" />}>
          {planned.length === 0 ? (
            <p className="small muted">{t('Add insights to build your plan.', 'Voeg inzichten toe om je plan te maken.')}</p>
          ) : (
            <div className="list">
              {planned.map((i) => (
                <div key={i.id} className="list-row small">
                  <Check size={16} color="#13855f" />
                  <span className="grow">{t(i.title.en, i.title.nl)}</span>
                  <span className="num strong">{eur(i.saving ?? 0, 0)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 6 }}>
            <span className="strong">{t('Planned saving', 'Geplande besparing')}</span>
            <span className="save num" style={{ fontSize: 20 }}>
              {eur(planTotal, 0)}
              {t('/yr', '/jr')}
            </span>
          </div>
        </Card>
      </div>

      <div className="grid g-3 mt">
        {list.map((i) => (
          <InsightCard key={i.id} i={i} planned={plan.includes(i.id)} onToggle={() => toggle(i.id)} />
        ))}
      </div>

      <Card className="mt" title={t('How you compare', 'Hoe je je verhoudt')} sub={t('Terraced homes in Utrecht with 3 residents', 'Tussenwoningen in Utrecht met 3 bewoners')}>
        <div className="grid g-3">
          {[
            { l: t('Electricity / year', 'Stroom / jaar'), you: contract.annualUsage.electricityKwh, them: benchmark.similarHomesKwh, u: 'kWh' },
            { l: t('Gas / year', 'Gas / jaar'), you: contract.annualUsage.gasM3, them: benchmark.similarHomesM3, u: 'm³' },
            { l: t('Always-on load', 'Sluipverbruik'), you: benchmark.baseloadW, them: benchmark.similarBaseloadW, u: 'W' },
          ].map((b) => {
            const max = Math.max(b.you, b.them);
            const diff = Math.round(((b.you - b.them) / b.them) * 100);
            return (
              <div key={b.l}>
                <div className="row between small">
                  <span className="strong">{b.l}</span>
                  <span className={`strong ${diff > 0 ? 'up' : 'down'}`}>
                    {diff > 0 ? '+' : ''}
                    {diff}%
                  </span>
                </div>
                <div className="xs muted mt-s">{t('You', 'Jij')}</div>
                <div className="bar">
                  <span style={{ width: `${(b.you / max) * 100}%` }} />
                </div>
                <div className="xs muted mt-s">{t('Similar homes', 'Vergelijkbare woningen')}</div>
                <div className="bar">
                  <span style={{ width: `${(b.them / max) * 100}%`, background: '#b6c2cf' }} />
                </div>
                <div className="xs muted mt-s num">
                  {num(b.you)} vs {num(b.them)} {b.u}
                </div>
              </div>
            );
          })}
        </div>
        <button className="btn btn-ghost btn-sm mt" style={{ paddingLeft: 0 }} onClick={() => navigate('/energy')}>
          {t('See detailed consumption', 'Bekijk gedetailleerd verbruik')} <ArrowRight size={15} />
        </button>
      </Card>
      <div className="row mt" style={{ justifyContent: 'center' }}>
        <DemoFlag />
      </div>
    </>
  );
}
