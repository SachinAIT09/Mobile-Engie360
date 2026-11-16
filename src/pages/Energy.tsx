import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ArrowRight, Clock, Euro, Flame, Sigma, TrendingUp, Zap, Moon, Sun } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { contract } from '../data/customer';
import { benchmark, breakdown, costOf, lastMonthSummary, monthly, peakSplit, series, type Period } from '../data/energy';
import { Card, Delta, DemoFlag, Expander, Kpi, N2GBadge, PageHead, Seg } from '../components/ui';
import { ChartLegend, UsageChart, type Metric } from '../components/UsageChart';
import { usePortalAssistant } from '../assistant/portalContext';
import { brand } from '../brand';

export default function Energy() {
  const { chart: c } = useTheme();
  const { t, tx, num, eur } = useI18n();
  const { ask } = usePortalAssistant();
  const [period, setPeriod] = useState<Period>('month');
  const [metric, setMetric] = useState<Metric>('electricity');
  const [compare, setCompare] = useState(true);

  const data = series(period);
  const stats = useMemo(() => {
    const complete = data.filter((d) => !d.forecast);
    const total = data.reduce((s, d) => s + d[metric], 0);
    const prev = data.reduce((s, d) => s + ((metric === 'electricity' ? d.prevElectricity : d.prevGas) ?? 0), 0);
    const days = period === 'hour' ? 1 : period === 'day' ? 30 : period === 'week' ? 84 : 365;
    const unitPrice = metric === 'electricity' ? contract.electricity.avgPrice : contract.gas.price;
    const peak = complete.reduce((m, d) => (d[metric] > m[metric] ? d : m), complete[0] ?? data[0]!);
    return { total, prev, change: prev ? Math.round(((total - prev) / prev) * 100) : 0, perDay: total / days, cost: total * unitPrice, peak };
  }, [data, metric, period]);

  const unit = metric === 'electricity' ? 'kWh' : 'm³';
  const periodLabel = {
    hour: t('Yesterday, per hour', 'Gisteren, per uur'),
    day: t('Last 30 days', 'Afgelopen 30 dagen'),
    week: t('Last 12 weeks', 'Afgelopen 12 weken'),
    month: t('Last 12 months', 'Afgelopen 12 maanden'),
  }[period];
  const compareLabel = period === 'hour' ? t('Same day last week', 'Zelfde dag vorige week') : t('Last year', 'Vorig jaar');
  const breakdownTotal = breakdown.reduce((s, b) => s + b.kwh, 0);

  const trend = monthly.map((m) => ({ name: tx(m.label), now: m[metric], prev: metric === 'electricity' ? m.prevElectricity : m.prevGas }));

  return (
    <>
      <PageHead
        eyebrow={t('Energy consumption', 'Energieverbruik')}
        title={t('Your usage in detail', 'Je verbruik in detail')}
        sub={t(`Smart-meter data, refreshed every 15 minutes. Appliance insights by ${brand.partners.disaggregation}.`, `Slimme-meterdata, elke 15 minuten bijgewerkt. Apparaatinzichten door ${brand.partners.disaggregation}.`)}
      >
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
            { value: 'hour', label: t('Hour', 'Uur') },
            { value: 'day', label: t('Day', 'Dag') },
            { value: 'week', label: t('Week', 'Week') },
            { value: 'month', label: t('Month', 'Maand') },
          ]}
        />
      </PageHead>

      <div className="grid g-4">
        <Kpi icon={metric === 'electricity' ? Zap : Flame} tone={metric === 'electricity' ? 'el' : 'gas'} label={t('Total', 'Totaal') + ' · ' + periodLabel.toLowerCase()} value={num(stats.total, period === 'hour' ? 1 : 0)} unit={unit} foot={compare ? <><Delta pct={stats.change} /> {compareLabel.toLowerCase()}</> : undefined} />
        <Kpi icon={Sigma} tone="ink" label={t('Average per day', 'Gemiddeld per dag')} value={num(stats.perDay, 1)} unit={unit} />
        <Kpi icon={Euro} tone="eur" label={t('Estimated cost', 'Geschatte kosten')} value={eur(stats.cost, 0)} foot={<span>{t('excl. fixed costs', 'excl. vaste kosten')}</span>} />
        <Kpi icon={TrendingUp} tone="pur" label={t('Highest', 'Hoogste')} value={tx(stats.peak.label)} foot={<span className="num">{num(stats.peak[metric], period === 'hour' ? 2 : 0)} {unit}</span>} />
      </div>

      <Card
        className="mt"
        title={periodLabel}
        sub={period === 'hour' ? t('Sunday 15 November, with your dynamic hourly price', 'Zondag 15 november, met je dynamische uurprijs') : undefined}
        action={
          <label className="row small strong" style={{ cursor: 'pointer' }}>
            <button className={`switch${compare ? ' on' : ''}`} role="switch" aria-checked={compare} onClick={() => setCompare(!compare)} aria-label={t('Compare', 'Vergelijk')} />
            {t('Compare with', 'Vergelijk met')} {compareLabel.toLowerCase()}
          </label>
        }
      >
        <UsageChart data={data} metric={metric} compare={compare} showEv showPrice={period === 'hour' && metric === 'electricity'} height={320} compareLabel={compareLabel} />
        <div className="mt-s">
          <ChartLegend metric={metric} compare={compare} compareLabel={compareLabel} ev price={period === 'hour' && metric === 'electricity'} forecast={period === 'day' || period === 'week'} />
        </div>
      </Card>

      <div className="grid g-2 mt">
        <div className="insight" style={{ background: 'var(--danger-bg)', borderColor: 'transparent' }}>
          <span className="kpi-ic gas">
            <TrendingUp size={19} />
          </span>
          <div>
            <h3>
              {t(`Your electricity consumption increased by ${lastMonthSummary.elecVsPrevMonthPct}% compared to last month.`, `Je stroomverbruik is ${lastMonthSummary.elecVsPrevMonthPct}% gestegen ten opzichte van vorige maand.`)}
            </h3>
            <p className="small muted">{t('Mostly EV charging (78 kWh in October) and colder evenings.', 'Vooral door het laden van je auto (78 kWh in oktober) en koudere avonden.')}</p>
            <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => ask(t('Why is my energy bill higher this month?', 'Waarom is mijn energierekening hoger deze maand?'))}>
              {t('Explain this', 'Leg dit uit')} <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="insight" style={{ background: 'var(--ok-bg)', borderColor: 'transparent' }}>
          <span className="kpi-ic eur">
            <Clock size={19} />
          </span>
          <div>
            <h3>{t('Shifting your energy usage to off-peak hours could help reduce costs.', 'Je verbruik verschuiven naar daluren kan je kosten verlagen.')}</h3>
            <p className="small muted">{t(`${peakSplit.peakPct}% of your electricity is used in peak hours. Moving EV charging saves about €142 a year.`, `${peakSplit.peakPct}% van je stroom gebruik je in piekuren. Je auto later laden bespaart zo’n €142 per jaar.`)}</p>
            <Link to="/smart-energy" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, marginTop: 4 }}>
              {t('Plan smart charging', 'Slim laden plannen')} <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid g-3 mt">
        <Card title={t('Where your electricity goes', 'Waar je stroom heen gaat')} sub={t('October 2026 · appliance-level', 'Oktober 2026 · per apparaat')} action={<N2GBadge />} className="span-2">
          <div className="grid g-2" style={{ alignItems: 'center' }}>
            <div style={{ height: 230, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={breakdown.map((b) => ({ name: tx(b.label), value: b.kwh, color: b.color }))} dataKey="value" innerRadius="62%" outerRadius="92%" paddingAngle={2} stroke="none" animationDuration={700}>
                    {breakdown.map((b) => (
                      <Cell key={b.key} fill={b.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="chart-tip">
                          <b>{payload[0].name}</b>
                          {num(Number(payload[0].value))} kWh · {Math.round((Number(payload[0].value) / breakdownTotal) * 100)}%
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                <div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 900 }}>
                    {num(breakdownTotal)}
                  </div>
                  <div className="xs muted strong">kWh</div>
                </div>
              </div>
            </div>
            <div className="list">
              {breakdown.map((b) => (
                <div key={b.key} className="row between small" style={{ padding: '5px 0' }}>
                  <span className="row" style={{ gap: 8 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: b.color, display: 'inline-block' }} />
                    {tx(b.label)}
                  </span>
                  <span className="num strong">
                    {num(b.kwh)} kWh <span className="muted" style={{ fontWeight: 400 }}>· {Math.round((b.kwh / breakdownTotal) * 100)}%</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title={t('Peak vs off-peak', 'Piek vs dal')} sub={t('Last 30 days', 'Afgelopen 30 dagen')}>
          <div className="row" style={{ height: 14, borderRadius: 999, overflow: 'hidden', gap: 0 }}>
            <span style={{ width: `${peakSplit.peakPct}%`, background: 'var(--gas)', height: '100%' }} />
            <span style={{ width: `${peakSplit.offPeakPct}%`, background: 'var(--blue)', height: '100%' }} />
          </div>
          <div className="grid g-2 mt" style={{ gap: 12 }}>
            <div>
              <div className="row small muted strong" style={{ gap: 6 }}>
                <Sun size={15} color="#ff8a3d" /> {t('Peak', 'Piek')} 07–23
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 900 }}>
                {peakSplit.peakPct}%
              </div>
              <div className="xs muted num">{num(peakSplit.peakKwh)} kWh</div>
            </div>
            <div>
              <div className="row small muted strong" style={{ gap: 6 }}>
                <Moon size={15} color="#00aaff" /> {t('Off-peak', 'Dal')} 23–07
              </div>
              <div className="num" style={{ fontSize: 22, fontWeight: 900 }}>
                {peakSplit.offPeakPct}%
              </div>
              <div className="xs muted num">{num(peakSplit.offPeakKwh)} kWh</div>
            </div>
          </div>
          <p className="small muted mt">{t(`${peakSplit.peakEvPct}% of your EV charging falls in peak hours.`, `${peakSplit.peakEvPct}% van het laden van je auto valt in piekuren.`)}</p>
          <div className="mt" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14 }}>
            <div className="row between small">
              <span className="muted">{t('You vs similar homes', 'Jij vs vergelijkbare woningen')}</span>
              <span className="strong num">
                {num(contract.annualUsage.electricityKwh)} / {num(benchmark.similarHomesKwh)} kWh
              </span>
            </div>
            <div className="bar mt-s">
              <span style={{ width: `${(benchmark.similarHomesKwh / contract.annualUsage.electricityKwh) * 100}%`, background: 'var(--muted)' }} />
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt" title={t('Consumption trend', 'Verbruikstrend')} sub={t('12 months vs the year before', '12 maanden vs het jaar ervoor')}>
        <div style={{ height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={trend} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={48} />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <div className="chart-tip">
                      <b>{label}</b>
                      {t('This year', 'Dit jaar')}: {num(Number(payload[0]?.value))} {unit}
                      <br />
                      {t('Year before', 'Jaar ervoor')}: {num(Number(payload[1]?.value))} {unit}
                    </div>
                  ) : null
                }
              />
              <Line type="monotone" dataKey="now" stroke={metric === 'electricity' ? '#00aaff' : '#ff8a3d'} strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="prev" stroke={c.ink} strokeOpacity={0.4} strokeDasharray="5 5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Expander title={t('Show monthly table', 'Toon tabel per maand')}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Month', 'Maand')}</th>
                  <th className="r">{t('Electricity', 'Stroom')}</th>
                  <th className="r">Gas</th>
                  <th className="r">{t('vs last year', 't.o.v. vorig jaar')}</th>
                  <th className="r">{t('Est. cost', 'Geschatte kosten')}</th>
                </tr>
              </thead>
              <tbody>
                {[...monthly].reverse().map((m) => {
                  const d = Math.round(((m.electricity - (m.prevElectricity ?? 1)) / (m.prevElectricity ?? 1)) * 100);
                  return (
                    <tr key={m.key}>
                      <td className="strong">{tx(m.label)}</td>
                      <td className="r num">{num(m.electricity)} kWh</td>
                      <td className="r num">{num(m.gas)} m³</td>
                      <td className="r">
                        <Delta pct={d} />
                      </td>
                      <td className="r num">{eur(costOf(m.electricity, m.gas))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Expander>
      </Card>
      <div className="row mt" style={{ justifyContent: 'center' }}>
        <DemoFlag />
      </div>
    </>
  );
}
