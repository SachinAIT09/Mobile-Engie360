import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, BatteryCharging, CalendarClock, ChevronRight, FileText, Flame, Gauge, PiggyBank, Sparkles, SlidersHorizontal, Zap } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { contract, customer } from '../data/customer';
import { DEMO_NOW, greetingKey } from '../lib/time';
import { daily, monthly, thisMonth, weekly, type Period } from '../data/energy';
import { insights, totalSavings } from '../data/insights';
import { withPayments } from '../data/billing';
import { effectiveInstallment, useLive } from '../api/live';
import { Card, Delta, InsightIc, Kpi, Seg } from '../components/ui';
import { ChartLegend, UsageChart, type Metric } from '../components/UsageChart';
import { usePortalAssistant } from '../assistant/portalContext';
import { useLivePower } from '../lib/live';
import { brand } from '../brand';

function greeting(t: (en: string, nl: string) => string) {
  const k = greetingKey();
  return k === 'morning' ? t('Good morning', 'Goedemorgen') : k === 'afternoon' ? t('Good afternoon', 'Goedemiddag') : t('Good evening', 'Goedenavond');
}

/** Live power as one row; the full chart lives on Smart Energy. */
function LivePowerRow() {
  const { t, num } = useI18n();
  const { now } = useLivePower(2);
  return (
    <Link to="/smart-energy" className="link-card compact">
      <span className="kpi-ic el">
        <Activity size={19} />
      </span>
      <span className="grow">
        <b>
          {t('Right now', 'Op dit moment')} <span className="live" style={{ marginLeft: 6 }}>{t('Live', 'Live')}</span>
        </b>
        <span className="small muted">{t('From your smart meter', 'Van je slimme meter')}</span>
      </span>
      <span className="num strong" style={{ fontSize: 18, whiteSpace: 'nowrap' }}>
        {num(now.watts)} W
      </span>
      <ChevronRight size={18} className="muted" />
    </Link>
  );
}

/**
 * Home is a summary: next payment, shortcuts, this month's use and the one thing worth acting on.
 * The detail lives on Energy, Billing and Profile; keep this screen to about two phone screens.
 */
export default function Dashboard() {
  const { t, tx, num, eur, date } = useI18n();
  const navigate = useNavigate();
  const { ask } = usePortalAssistant();
  const [period, setPeriod] = useState<Exclude<Period, 'hour'>>('month');
  const [metric, setMetric] = useState<Metric>('electricity');
  const live = useLive();
  // The next amount due: the open invoice, or December's installment once this month's is paid.
  const openInvoice = withPayments(live.pay).outstanding[0];
  const next = openInvoice ? { amount: openInvoice.amount, due: openInvoice.due } : { amount: effectiveInstallment(live.installment), due: '2026-12-28' };
  const data = period === 'day' ? daily : period === 'week' ? weekly : monthly;
  const elecYoY = Math.round(((thisMonth.electricity - thisMonth.prevElectricity) / thisMonth.prevElectricity) * 100);
  const gasYoY = Math.round(((thisMonth.gas - thisMonth.prevGas) / thisMonth.prevGas) * 100);
  const topInsight = insights[0];

  const quick = [
    { icon: SlidersHorizontal, tone: 'el', label: t('Adjust installment', 'Termijn aanpassen'), go: () => navigate('/billing?adjust=1') },
    { icon: FileText, tone: 'ink', label: t('Latest invoice', 'Laatste nota'), go: () => navigate('/billing#invoices') },
    { icon: Gauge, tone: 'eur', label: t('Meter readings', 'Meterstanden'), go: () => navigate('/account#meter') },
    { icon: Sparkles, tone: 'pur', label: t(`Ask ${brand.assistant.name}`, `Vraag het ${brand.assistant.name}`), go: () => ask(t('Why is my energy bill higher this month?', 'Waarom is mijn energierekening hoger deze maand?')) },
  ] as const;

  return (
    <>
      {/* Hero: greeting and the next payment */}
      <section className="card hero hero-home">
        <div className="small muted strong" style={{ marginBottom: 4 }}>
          {date(DEMO_NOW.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1>
          {greeting(t)}, {customer.firstName}
        </h1>
        <Link to="/billing" className="hero-pay">
          <CalendarClock size={20} style={{ opacity: 0.75 }} />
          <span className="grow">
            <span className="small strong" style={{ display: 'block' }}>
              {t('Next payment', 'Volgende betaling')}
            </span>
            <span className="xs muted">
              {live.pay.autopay ? t('Direct debit on', 'Incasso op') : t('Due on', 'Betalen voor')} {date(next.due, { day: 'numeric', month: 'short' })}
            </span>
          </span>
          <span className="num amount">{eur(next.amount)}</span>
          <ChevronRight size={18} style={{ opacity: 0.7 }} />
        </Link>
        <Link to="/insights" className="hero-save">
          <PiggyBank size={16} />
          {t(`${eur(totalSavings, 0)} a year in possible savings`, `${eur(totalSavings, 0)} per jaar aan mogelijke besparingen`)}
          <ArrowRight size={14} />
        </Link>
      </section>

      {/* Quick actions */}
      <nav className="qa-row" aria-label={t('Quick actions', 'Snel regelen')}>
        {quick.map((q) => (
          <button key={q.label} className="qa" onClick={q.go}>
            <span className={`kpi-ic ${q.tone}`}>
              <q.icon size={20} />
            </span>
            {q.label}
          </button>
        ))}
      </nav>

      {/* This month */}
      <div className="grid g-4 mt">
        <Kpi
          icon={Zap}
          tone="el"
          label={t('Electricity this month', 'Stroom deze maand')}
          value={num(thisMonth.electricity)}
          unit="kWh"
          foot={
            <>
              <Delta pct={elecYoY} /> {t('vs last year', 't.o.v. vorig jaar')}
            </>
          }
        />
        <Kpi
          icon={Flame}
          tone="gas"
          label={t('Gas this month', 'Gas deze maand')}
          value={num(thisMonth.gas)}
          unit="m³"
          foot={
            <>
              <Delta pct={gasYoY} /> {t('vs last year', 't.o.v. vorig jaar')}
            </>
          }
        />
      </div>

      <div className="advice mt">
        <span>
          <b>{t('Advice:', 'Advies:')}</b> {t(`raise your installment to ${eur(contract.advisedInstallment, 0)} to avoid paying extra at your annual statement.`, `verhoog je termijnbedrag naar ${eur(contract.advisedInstallment, 0)} om bijbetalen bij je jaarnota te voorkomen.`)}
        </span>
        <Link to="/billing?adjust=1" className="btn btn-outline btn-sm">
          {t('Adjust', 'Aanpassen')}
        </Link>
      </div>

      {/* Chart */}
      <Card
        className="mt"
        title={t('Energy overview', 'Energieoverzicht')}
        action={
          <Link to="/energy" className="btn btn-ghost btn-sm">
            {t('Full analysis', 'Volledige analyse')} <ArrowRight size={15} />
          </Link>
        }
      >
        <div className="row between" style={{ gap: 6, marginBottom: 10 }}>
          <Seg
            label={t('Energy type', 'Energiesoort')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'electricity', label: t('Electricity', 'Stroom') },
              { value: 'gas', label: 'Gas' },
            ]}
          />
          <Seg
            label={t('Period', 'Periode')}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: t('Day', 'Dag') },
              { value: 'week', label: t('Week', 'Week') },
              { value: 'month', label: t('Month', 'Maand') },
            ]}
          />
        </div>
        <UsageChart data={data} metric={metric} showEv height={200} compareLabel={t('Last year', 'Vorig jaar')} />
        <div className="mt-s">
          <ChartLegend metric={metric} compare compareLabel={t('Last year', 'Vorig jaar')} ev forecast={period !== 'month'} />
        </div>
      </Card>

      {/* The one insight worth acting on; the rest are on Energy insights */}
      {topInsight && (
        <Card
          className="mt"
          title={t('Smart insights', 'Slimme inzichten')}
          action={
            <Link to="/insights" className="btn btn-ghost btn-sm">
              {t(`All ${insights.length} insights`, `Alle ${insights.length} inzichten`)} <ArrowRight size={15} />
            </Link>
          }
        >
          <div className="insight">
            <InsightIc icon={topInsight.icon} kind={topInsight.kind} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <h3>{tx(topInsight.title)}</h3>
                {topInsight.saving ? (
                  <span className="save small">
                    {eur(topInsight.saving, 0)}
                    {t('/yr', '/jr')}
                  </span>
                ) : (
                  <span className="badge warn">{t('Alert', 'Melding')}</span>
                )}
              </div>
              <p className="small muted">{tx(topInsight.body)}</p>
              {topInsight.to && topInsight.cta && (
                <Link to={topInsight.to} className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, marginTop: 4 }}>
                  {tx(topInsight.cta)} <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Live power and tonight's charging window, one row each */}
      <div className="stack mt">
        <LivePowerRow />
        <Link to="/smart-energy" className="link-card compact">
          <span className="kpi-ic pur">
            <BatteryCharging size={19} />
          </span>
          <span className="grow">
            <b>{t('Cheapest charging tonight', 'Goedkoopst laden vannacht')}</b>
            <span className="small muted">{t('02:00–05:00 at €0.17/kWh', '02:00–05:00 voor €0,17/kWh')}</span>
          </span>
          <ChevronRight size={18} className="muted" />
        </Link>
      </div>
    </>
  );
}
