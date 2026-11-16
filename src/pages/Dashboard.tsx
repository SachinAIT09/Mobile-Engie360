import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BatteryCharging,
  CalendarClock,
  Euro,
  FileText,
  Flame,
  Gauge,
  PiggyBank,
  Sparkles,
  SlidersHorizontal,
  Zap,
  Activity,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { contract, customer } from '../data/customer';
import { DEMO_NOW, greetingKey } from '../lib/time';
import { daily, monthly, thisMonth, weekly, type Period } from '../data/energy';
import { insights, totalSavings } from '../data/insights';
import { invoices } from '../data/billing';
import { Card, Delta, InsightIc, Kpi, N2GBadge, DemoFlag, Seg } from '../components/ui';
import { ChartLegend, UsageChart, type Metric } from '../components/UsageChart';
import { usePortalAssistant } from '../assistant/portalContext';
import { useLivePower } from '../lib/live';
import { brand } from '../brand';

function greeting(t: (en: string, nl: string) => string) {
  const k = greetingKey();
  return k === 'morning' ? t('Good morning', 'Goedemorgen') : k === 'afternoon' ? t('Good afternoon', 'Goedemiddag') : t('Good evening', 'Goedenavond');
}

function LivePowerCard() {
  const { t, num } = useI18n();
  const { now, history } = useLivePower(24);
  const max = Math.max(...history.map((h) => h.watts), 1);
  return (
    <Card
      title={
        <span className="row">
          {t('Right now', 'Op dit moment')} <span className="live">{t('Live', 'Live')}</span>
        </span>
      }
      sub={t('Real-time use from your smart meter', 'Realtime verbruik van je slimme meter')}
      action={<N2GBadge />}
    >
      <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
        <span className="num" style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.02em' }}>
          {num(now.watts)}
        </span>
        <span className="muted strong">W</span>
      </div>
      <div className="mini-bars" style={{ height: 64, marginTop: 10 }} aria-hidden>
        {history.map((h, i) => (
          <div className="mini-bar" key={h.ts}>
            <span style={{ height: `${(h.watts / max) * 100}%`, background: i === history.length - 1 ? 'var(--blue)' : '#bfe6fb', transition: 'height .4s' }} />
          </div>
        ))}
      </div>
      <div className="row between small mt-s">
        <span className="muted">{t('Always-on', 'Sluipverbruik')}</span>
        <span className="strong num">205 W</span>
      </div>
      <Link to="/smart-energy" className="btn btn-outline btn-sm mt" style={{ width: '100%' }}>
        {t('Open Smart Energy', 'Open Slimme Energie')} <ArrowRight size={15} />
      </Link>
    </Card>
  );
}

export default function Dashboard() {
  const { t, tx, num, eur, date } = useI18n();
  const navigate = useNavigate();
  const { ask } = usePortalAssistant();
  const [period, setPeriod] = useState<Exclude<Period, 'hour'>>('month');
  const [metric, setMetric] = useState<Metric>('electricity');
  const nextInvoice = invoices.find((i) => i.status !== 'paid');
  const data = period === 'day' ? daily : period === 'week' ? weekly : monthly;
  const elecYoY = Math.round(((thisMonth.electricity - thisMonth.prevElectricity) / thisMonth.prevElectricity) * 100);
  const gasYoY = Math.round(((thisMonth.gas - thisMonth.prevGas) / thisMonth.prevGas) * 100);

  const quick = [
    { icon: SlidersHorizontal, tone: 'el', label: t('Adjust installment', 'Termijnbedrag aanpassen'), go: () => navigate('/billing?adjust=1') },
    { icon: FileText, tone: 'ink', label: t('Latest invoice', 'Laatste nota'), go: () => navigate('/billing#invoices') },
    { icon: Gauge, tone: 'eur', label: t('Meter readings', 'Meterstanden'), go: () => navigate('/account#meter') },
    { icon: Sparkles, tone: 'pur', label: t(`Ask ${brand.assistant.name}`, `Vraag het ${brand.assistant.name}`), go: () => ask(t('Why is my energy bill higher this month?', 'Waarom is mijn energierekening hoger deze maand?')) },
  ] as const;

  return (
    <>
      {/* Hero */}
      <section className="card hero" style={{ marginTop: 10 }}>
        <div className="grid g-main" style={{ position: 'relative', zIndex: 1, alignItems: 'center' }}>
          <div>
            <div className="small muted strong" style={{ marginBottom: 6 }}>
              {date(DEMO_NOW.toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 style={{ fontSize: 30 }}>
              {greeting(t)}, {customer.firstName}
            </h1>
            <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
              {t(
                `Your home used ${num(thisMonth.electricity)} kWh and ${num(thisMonth.gas)} m³ so far this month. We found ${eur(totalSavings, 0)} a year in possible savings for you.`,
                `Je woning verbruikte deze maand tot nu toe ${num(thisMonth.electricity)} kWh en ${num(thisMonth.gas)} m³. We vonden ${eur(totalSavings, 0)} per jaar aan mogelijke besparingen voor je.`,
              )}
            </p>
            <div className="row wrap" style={{ marginTop: 18 }}>
              <Link to="/insights" className="btn btn-primary">
                <PiggyBank size={17} /> {t('View my savings', 'Bekijk mijn besparingen')}
              </Link>
              <button className="btn btn-white" onClick={() => ask(t('How much energy did I consume this month?', 'Hoeveel energie heb ik deze maand verbruikt?'))}>
                <Sparkles size={17} /> {t('Ask about my usage', 'Vraag naar mijn verbruik')}
              </button>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 16, padding: 18 }}>
            <div className="row between">
              <span className="small muted strong">{t('Next payment', 'Volgende betaling')}</span>
              <CalendarClock size={18} style={{ opacity: 0.7 }} />
            </div>
            <div className="num" style={{ fontSize: 30, fontWeight: 900, marginTop: 4 }}>
              {eur(nextInvoice?.amount ?? contract.installment)}
            </div>
            <div className="small muted">
              {t('Direct debit on', 'Incasso op')} {nextInvoice ? date(nextInvoice.due, { day: 'numeric', month: 'long' }) : ''}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.14)', margin: '14px 0 10px' }} />
            <div className="small">{tx(contract.product)}</div>
            <div className="xs muted">{t('Gas fixed until', 'Gas vast tot')} {date(contract.gasFixedUntil)}</div>
          </div>
        </div>
      </section>

      {/* KPIs */}
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
        <Kpi
          icon={Euro}
          tone="eur"
          label={t('Energy costs this month', 'Energiekosten deze maand')}
          value={eur(thisMonth.costSoFar, 0)}
          foot={<span>{t('Forecast', 'Verwacht')} {eur(thisMonth.forecastCost, 0)}</span>}
        />
        <Kpi
          icon={Activity}
          tone="ink"
          label={t('Estimated annual costs', 'Geschatte jaarkosten')}
          value={eur(contract.estimatedAnnualCost, 0)}
          foot={
            <span>
              {t('Installment', 'Termijn')} {eur(contract.installment, 0)} {t('/ month', '/ maand')}
            </span>
          }
        />
      </div>

      {/* Chart + contract */}
      <div className="grid g-main mt">
        <Card
          title={t('Energy overview', 'Energieoverzicht')}
          sub={t('Compared with the same period last year', 'Vergeleken met dezelfde periode vorig jaar')}
          action={
            <div className="row wrap">
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
          }
        >
          <UsageChart data={data} metric={metric} showEv compareLabel={t('Last year', 'Vorig jaar')} />
          <div className="row between wrap mt-s">
            <ChartLegend metric={metric} compare compareLabel={t('Last year', 'Vorig jaar')} ev forecast={period !== 'month'} />
            <Link to="/energy" className="btn btn-ghost btn-sm">
              {t('Full analysis', 'Volledige analyse')} <ArrowRight size={15} />
            </Link>
          </div>
        </Card>

        <div className="stack">
          <Card title={t('My contract', 'Mijn contract')} action={<span className="badge ok">{t('Active', 'Actief')}</span>}>
            <div className="strong" style={{ fontSize: 16 }}>
              {tx(contract.product)}
            </div>
            <div className="small muted">{tx(contract.electricity.origin)}</div>
            <dl className="kv mt">
              <dt>{t('Monthly installment', 'Termijnbedrag')}</dt>
              <dd className="num">{eur(contract.installment)}</dd>
              <dt>{t('Electricity', 'Stroom')}</dt>
              <dd>{tx(contract.electricity.type)}</dd>
              <dt>Gas</dt>
              <dd>
                {eur(contract.gas.price)}/m³ · {t('fixed', 'vast')}
              </dd>
              <dt>{t('Customer since', 'Klant sinds')}</dt>
              <dd>{date(customer.memberSince, { month: 'long', year: 'numeric' })}</dd>
            </dl>
            <div className="insight mt" style={{ background: 'var(--warn-bg)', borderColor: 'transparent', padding: 12 }}>
              <div className="small">
                <b>{t('Advice:', 'Advies:')}</b> {t(`raise your installment to ${eur(contract.advisedInstallment, 0)} to avoid paying extra at your annual statement.`, `verhoog je termijnbedrag naar ${eur(contract.advisedInstallment, 0)} om bijbetalen bij je jaarnota te voorkomen.`)}{' '}
                <Link to="/billing?adjust=1" className="strong">
                  {t('Adjust', 'Aanpassen')}
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Quick actions */}
      <Card title={t('Quick actions', 'Snel regelen')} className="mt">
        <div className="qa-grid">
          {quick.map((q) => (
            <button key={q.label} className="qa" onClick={q.go}>
              <span className={`kpi-ic ${q.tone}`}>
                <q.icon size={18} />
              </span>
              {q.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Insights + live */}
      <div className="grid g-main mt">
        <Card
          title={t('Smart insights', 'Slimme inzichten')}
          sub={t('Personalised from your smart-meter data', 'Persoonlijk, op basis van je slimme-meterdata')}
          action={
            <Link to="/insights" className="btn btn-ghost btn-sm">
              {t('All insights', 'Alle inzichten')} <ArrowRight size={15} />
            </Link>
          }
        >
          <div className="stack" style={{ gap: 10 }}>
            {insights.slice(0, 3).map((i) => (
              <div key={i.id} className="insight">
                <InsightIc icon={i.icon} kind={i.kind} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ alignItems: 'flex-start' }}>
                    <h3>{tx(i.title)}</h3>
                    {i.saving ? (
                      <span className="save small">
                        {eur(i.saving, 0)}
                        {t('/yr', '/jr')}
                      </span>
                    ) : (
                      <span className="badge warn">{t('Alert', 'Melding')}</span>
                    )}
                  </div>
                  <p className="small muted">{tx(i.body)}</p>
                  <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
                    {i.source === 'net2grid' && <N2GBadge />}
                    {i.to && i.cta && (
                      <Link to={i.to} className="btn btn-ghost btn-sm" style={{ paddingLeft: 0 }}>
                        {tx(i.cta)} <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="stack">
          <LivePowerCard />
          <Card>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="kpi-ic pur">
                <BatteryCharging size={19} />
              </span>
              <div>
                <h3>{t('Electric car detected', 'Elektrische auto herkend')}</h3>
                <p className="small muted" style={{ marginTop: 3 }}>
                  {t('Tonight’s cheapest charging window is 02:00–05:00 at €0.17/kWh.', 'Het goedkoopste laadmoment vannacht is 02:00–05:00 voor €0,17/kWh.')}
                </p>
                <Link to="/smart-energy" className="btn btn-primary btn-sm mt-s">
                  {t('Plan charging', 'Laden plannen')}
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="row mt" style={{ justifyContent: 'center' }}>
        <DemoFlag />
      </div>
    </>
  );
}
