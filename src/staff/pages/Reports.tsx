import { useEffect, useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, MailCheck, Smartphone, TriangleAlert, Users, Wallet } from 'lucide-react';
import type { ReportGroup, ReportsResponse } from '../../../shared/contract';
import { API, get, post } from '../../api/client';
import { Card, Kpi, Seg } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { useStaff } from '../context';
import { usePaged } from '../paging';
import { Pager, StaffHead } from '../parts';

type Row = (string | number)[];

/** Exports a card's data as CSV and records the export in the audit log. */
function ExportButton({ name, title, rows }: { name: string; title: string; rows: () => Row[] }) {
  const { t } = useI18n();
  return (
    <button
      className="btn btn-outline btn-sm"
      onClick={() => {
        downloadCsv(name, rows());
        post(API.staffAudit, { action: 'REPORT_EXPORTED', target: title }).catch(() => undefined);
      }}
    >
      <Download size={14} /> {t('Export CSV', 'Exporteer CSV')}
    </button>
  );
}

/** A bar + line chart over the report's months. */
function MonthChart({ data, bar, line, unit }: { data: Record<string, string | number>[]; bar: { key: string; color: string; name: string }; line?: { key: string; name: string }; unit: string }) {
  const { num } = useI18n();
  const { chart: c } = useTheme();
  return (
    <div style={{ width: '100%', height: 230 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} interval="preserveStartEnd" minTickGap={10} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={52} tickFormatter={(v: number) => num(v)} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="chart-tip">
                  <b>{label}</b>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)}>
                      {p.name}: {num(Number(p.value), Number(p.value) % 1 ? 1 : 0)} {unit}
                    </div>
                  ))}
                </div>
              ) : null
            }
          />
          <Bar dataKey={bar.key} name={bar.name} fill={bar.color} radius={[5, 5, 3, 3]} animationDuration={500} />
          {line && <Line dataKey={line.key} name={line.name} type="monotone" stroke={c.ink} strokeOpacity={0.6} strokeDasharray="4 4" strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A horizontal bar list: label, bar, value. */
function Bars({ items }: { items: { label: string; value: number; color?: string; note?: string }[] }) {
  const { num } = useI18n();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="appl-list">
      {items.map((i) => (
        <li key={i.label}>
          <span className="small strong">{i.label}</span>
          <span className="appl-track" aria-hidden>
            <span style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? 'var(--blue)' }} />
          </span>
          <span className="small num">
            {num(i.value)}
            {i.note ? ` · ${i.note}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/**
 * Reports for the whole customer base. One filter bar (period, city, contract, customer group)
 * drives every chart and table on the page; each card exports its data as CSV.
 */
export default function StaffReports() {
  const { t, tx, eur, num, date } = useI18n();
  const { portfolio, outbox } = useStaff();
  const [months, setMonths] = useState<'week' | '3' | '6' | '12'>('12');
  const [city, setCity] = useState('');
  const [product, setProduct] = useState('');
  const [group, setGroup] = useState<ReportGroup>('all');
  const [metric, setMetric] = useState<'electricity' | 'gas'>('electricity');
  const [r, setR] = useState<ReportsResponse | null>(null);

  // Reloads when a filter changes, when customers act and when a message is sent.
  const version = `${portfolio?.needAttention ?? 0}-${outbox.length}`;
  useEffect(() => {
    let stale = false;
    get<ReportsResponse>(`${API.staffReports}?months=${months}&city=${encodeURIComponent(city)}&product=${encodeURIComponent(product)}&group=${group}`).then(
      (data) => !stale && setR(data),
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }, [months, city, product, group, version]);

  const cityPages = usePaged(r?.cities ?? []);
  const campaignPages = usePaged(r?.campaigns ?? []);
  const filtered = city !== '' || product !== '' || group !== 'all';
  const head = <StaffHead icon={BarChart3} title={t('Reports', 'Rapporten')} sub={t('The whole customer base: energy, cost against installments, attention points, app use and message results. The filters apply to every chart and table.', 'Het hele klantenbestand: energie, kosten tegenover termijnen, aandachtspunten, app-gebruik en resultaten van berichten. De filters gelden voor elke grafiek en tabel.')} />;
  if (!r) {
    return (
      <>
        {head}
        <span className="skel" style={{ height: 360 }} aria-busy="true" />
      </>
    );
  }

  const monthRows = r.months.map((m) => ({ name: tx(m.label), electricityMwh: m.electricityMwh, gasKm3: m.gasKm3, costK: m.costK, installmentsK: m.installmentsK, activeUsers: m.activeUsers }));
  const usageKey = metric === 'electricity' ? 'electricityMwh' : 'gasKm3';
  const usageUnit = metric === 'electricity' ? 'MWh' : t('thousand m³', 'duizend m³');
  const shortMonths = r.months.filter((m) => m.costK > m.installmentsK).length;
  // The charts are per month, or per day for the last 7 days.
  const byDay = r.per === 'day';
  const per = byDay ? t('day', 'dag') : t('month', 'maand');
  const pers = byDay ? t('days', 'dagen') : t('months', 'maanden');
  const perHead = byDay ? t('Day', 'Dag') : t('Month', 'Maand');
  const foot = (text: string): ReactNode => <span className="xs muted">{text}</span>;

  return (
    <>
      {head}

      <section className="card report-filters" aria-label={t('Filters', 'Filters')}>
        <label className="field">
          {t('Period', 'Periode')}
          <select className="input" aria-label={t('Filter by period', 'Filter op periode')} value={months} onChange={(e) => setMonths(e.target.value as typeof months)}>
            <option value="week">{t('Last 7 days', 'Laatste 7 dagen')}</option>
            <option value="3">{t('Last 3 months', 'Laatste 3 maanden')}</option>
            <option value="6">{t('Last 6 months', 'Laatste 6 maanden')}</option>
            <option value="12">{t('Last 12 months', 'Laatste 12 maanden')}</option>
          </select>
        </label>
        <label className="field">
          {t('City', 'Plaats')}
          <select className="input" aria-label={t('Filter by city', 'Filter op plaats')} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{t('All cities', 'Alle plaatsen')}</option>
            {r.scope.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('Contract', 'Contract')}
          <select className="input" aria-label={t('Filter by contract', 'Filter op contract')} value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="">{t('All contracts', 'Alle contracten')}</option>
            {r.scope.products.map((p) => (
              <option key={p.en} value={p.en}>
                {tx(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {t('Customers', 'Klanten')}
          <select className="input" aria-label={t('Filter by customer group', 'Filter op klantgroep')} value={group} onChange={(e) => setGroup(e.target.value as ReportGroup)}>
            <option value="all">{t('All customers', 'Alle klanten')}</option>
            <option value="app">{t('App users', 'App-gebruikers')}</option>
            <option value="ev">{t('With an electric car', 'Met een elektrische auto')}</option>
            <option value="attention">{t('Needing attention', 'Vragen aandacht')}</option>
          </select>
        </label>
        <div className="report-scope">
          <span className="small strong">{t(`${num(r.scope.customers)} of ${num(r.scope.total)} customers`, `${num(r.scope.customers)} van ${num(r.scope.total)} klanten`)}</span>
          {filtered && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCity('');
                setProduct('');
                setGroup('all');
              }}
            >
              {t('Clear filters', 'Filters wissen')}
            </button>
          )}
        </div>
      </section>

      {r.scope.customers === 0 ? (
        <Card>
          <p className="small muted staff-empty">
            <Users size={18} aria-hidden /> {t('No customers match these filters. Change or clear them.', 'Geen klanten bij deze filters. Pas ze aan of wis ze.')}
          </p>
        </Card>
      ) : (
        <>
          <div className="grid g-4 staff-kpis">
            <Kpi icon={Users} tone="el" label={t('Customers', 'Klanten')} value={num(r.kpis.customers)} foot={foot(t(`${pct(r.kpis.customers, r.scope.total)}% of the base`, `${pct(r.kpis.customers, r.scope.total)}% van het bestand`))} />
            <Kpi icon={Smartphone} tone="eur" label={t('App users', 'App-gebruikers')} value={num(r.kpis.appUsers)} foot={foot(t(`${r.kpis.activePct}% active in the last 30 days`, `${r.kpis.activePct}% actief in de laatste 30 dagen`))} />
            <Kpi icon={TriangleAlert} tone="gas" label={t('Need attention', 'Vragen aandacht')} value={num(r.kpis.needAttention)} foot={foot(t(`${pct(r.kpis.needAttention, r.kpis.customers)}% of this selection`, `${pct(r.kpis.needAttention, r.kpis.customers)}% van deze selectie`))} />
            <Kpi icon={Wallet} tone="ink" label={t('Average installment', 'Gemiddeld termijnbedrag')} value={eur(r.kpis.avgInstallment, 0)} foot={foot(t(`${eur(r.kpis.shortfallPerYear, 0)} a year short in total`, `${eur(r.kpis.shortfallPerYear, 0)} per jaar tekort in totaal`))} />
            <Kpi icon={MailCheck} tone="pur" label={t('Messages opened', 'Berichten geopend')} value={`${r.kpis.readPct}%`} foot={foot(t(`${num(r.funnel.opened)} of ${num(r.funnel.delivered)} delivered`, `${num(r.funnel.opened)} van ${num(r.funnel.delivered)} afgeleverd`))} />
          </div>

          <div className="staff-grid even">
            <Card
              title={t(`Energy delivered by ${per}`, `Geleverde energie per ${per}`)}
              sub={t(`Total for this selection, in ${usageUnit}`, `Totaal voor deze selectie, in ${usageUnit}`)}
              className="report-card"
              action={
                <span className="row" style={{ gap: 10 }}>
                  <Seg
                    label={t('Energy type', 'Energiesoort')}
                    value={metric}
                    onChange={setMetric}
                    options={[
                      { value: 'electricity', label: t('Electricity', 'Stroom') },
                      { value: 'gas', label: t('Gas', 'Gas') },
                    ]}
                  />
                  <ExportButton name={`energy-by-${byDay ? 'day' : 'month'}`} title={t(`Energy delivered by ${per}`, `Geleverde energie per ${per}`)} rows={() => [[perHead, t('Electricity MWh', 'Stroom MWh'), t('Gas thousand m3', 'Gas duizend m3')], ...r.months.map((m) => [tx(m.label), m.electricityMwh, m.gasKm3])]} />
                </span>
              }
            >
              <MonthChart data={monthRows} bar={{ key: usageKey, color: metric === 'electricity' ? '#00aaff' : '#ff8a3d', name: metric === 'electricity' ? t('Electricity', 'Stroom') : t('Gas', 'Gas') }} unit={usageUnit} />
            </Card>

            <Card
              title={t('Cost against installments', 'Kosten tegenover termijnen')}
              sub={t(`Thousand €. Cost was above installments in ${shortMonths} of ${r.months.length} ${pers}`, `Duizend €. Kosten lagen boven de termijnen in ${shortMonths} van de ${r.months.length} ${pers}`)}
              className="report-card"
              action={<ExportButton name="cost-against-installments" title={t('Cost against installments', 'Kosten tegenover termijnen')} rows={() => [[perHead, t('Cost thousand EUR', 'Kosten duizend EUR'), t('Installments thousand EUR', 'Termijnen duizend EUR')], ...r.months.map((m) => [tx(m.label), m.costK, m.installmentsK])]} />}
            >
              <MonthChart data={monthRows} bar={{ key: 'costK', color: '#23d2b5', name: t('Cost', 'Kosten') }} line={{ key: 'installmentsK', name: t('Installments', 'Termijnen') }} unit={t('thousand €', 'duizend €')} />
              <div className="chart-legend">
                <span>
                  <i style={{ background: '#23d2b5' }} />
                  {t('Cost of energy delivered', 'Kosten van geleverde energie')}
                </span>
                <span>
                  <i style={{ background: 'transparent', border: '2px dashed var(--ink)', opacity: 0.6, height: 0, width: 14, borderRadius: 0, verticalAlign: 3 }} />
                  {t('Installments collected', 'Geïnde termijnen')}
                </span>
              </div>
            </Card>
          </div>

          <div className="staff-grid even">
            <Card
              title={t('Attention points', 'Aandachtspunten')}
              sub={t('Customers in this selection each point applies to', 'Klanten in deze selectie voor wie elk punt geldt')}
              className="report-card"
              action={<ExportButton name="attention-points" title={t('Attention points', 'Aandachtspunten')} rows={() => [[t('Attention point', 'Aandachtspunt'), t('Customers', 'Klanten')], ...r.attention.map((a) => [tx(a.label), a.count])]} />}
            >
              <Bars items={r.attention.map((a) => ({ label: tx(a.label), value: a.count, color: a.id === 'installment' ? 'var(--gas)' : a.id === 'ev-peak' ? 'var(--purple)' : 'var(--danger)', note: `${pct(a.count, r.kpis.customers)}%` }))} />
            </Card>

            <Card
              title={t('Customers using the app', 'Klanten die de app gebruiken')}
              sub={t(`Active app users per ${per}`, `Actieve app-gebruikers per ${per}`)}
              className="report-card"
              action={<ExportButton name={`app-users-by-${byDay ? 'day' : 'month'}`} title={t('Customers using the app', 'Klanten die de app gebruiken')} rows={() => [[perHead, t('Active app users', 'Actieve app-gebruikers')], ...r.months.map((m) => [tx(m.label), m.activeUsers])]} />}
            >
              <MonthChart data={monthRows} bar={{ key: 'activeUsers', color: '#7b61ff', name: t('Active', 'Actief') }} unit={t('customers', 'klanten')} />
            </Card>
          </div>

          <div className="staff-grid even">
            <Card
              title={t('Message delivery', 'Aflevering van berichten')}
              sub={t(`${r.campaigns.length} messages to groups in this period`, `${r.campaigns.length} berichten aan groepen in deze periode`)}
              className="report-card"
              action={
                <ExportButton
                  name="message-results"
                  title={t('Message delivery', 'Aflevering van berichten')}
                  rows={() => [[t('Message', 'Bericht'), t('Group', 'Groep'), t('Date', 'Datum'), t('Sent', 'Verstuurd'), t('Delivered', 'Afgeleverd'), t('Opened', 'Geopend'), t('Acted', 'Actie genomen')], ...r.campaigns.map((c) => [tx(c.title), tx(c.audience), c.sentAt.slice(0, 10), c.sent, c.delivered, c.opened, c.acted])]}
                />
              }
            >
              {r.funnel.sent === 0 ? (
                <p className="small muted staff-empty">
                  <MailCheck size={18} aria-hidden /> {t('No messages were sent to this selection in this period.', 'Er zijn in deze periode geen berichten naar deze selectie gestuurd.')}
                </p>
              ) : (
                <>
                  <Bars
                    items={[
                      { label: t('Sent', 'Verstuurd'), value: r.funnel.sent, color: 'var(--blue)' },
                      { label: t('Delivered', 'Afgeleverd'), value: r.funnel.delivered, color: 'var(--purple)', note: `${pct(r.funnel.delivered, r.funnel.sent)}%` },
                      { label: t('Opened', 'Geopend'), value: r.funnel.opened, color: 'var(--green)', note: `${pct(r.funnel.opened, r.funnel.delivered)}%` },
                      { label: t('Acted on it', 'Actie genomen'), value: r.funnel.acted, color: 'var(--gas)', note: `${pct(r.funnel.acted, r.funnel.delivered)}%` },
                    ]}
                  />
                  <div className="table-wrap mt">
                    <table className="table staff-table">
                      <thead>
                        <tr>
                          <th>{t('Message', 'Bericht')}</th>
                          <th>{t('Date', 'Datum')}</th>
                          <th className="num">{t('Sent', 'Verstuurd')}</th>
                          <th className="num">{t('Opened', 'Geopend')}</th>
                          <th className="num">{t('Acted', 'Actie')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignPages.rows.map((c) => (
                          <tr key={c.id}>
                            <td className="small">
                              <span className="strong">{tx(c.title)}</span>
                              <span className="xs muted" style={{ display: 'block' }}>
                                {tx(c.audience)}
                              </span>
                            </td>
                            <td className="small">{date(c.sentAt, { day: 'numeric', month: 'short' })}</td>
                            <td className="small num">{num(c.sent)}</td>
                            <td className="small num">{pct(c.opened, c.delivered)}%</td>
                            <td className="small num">{pct(c.acted, c.delivered)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager paged={campaignPages} />
                </>
              )}
            </Card>

            <Card
              title={t('Customers by city', 'Klanten per plaats')}
              sub={t('With how many need attention', 'Met hoeveel er aandacht vragen')}
              className="report-card"
              action={<ExportButton name="customers-by-city" title={t('Customers by city', 'Klanten per plaats')} rows={() => [[t('City', 'Plaats'), t('Customers', 'Klanten'), t('Need attention', 'Vragen aandacht'), t('Installment too low', 'Termijn te laag'), t('EV at peak hours', 'Laden in piekuren')], ...r.cities.map((c) => [c.city, c.customers, c.attention, c.tooLow, c.evPeak])]} />}
            >
              <div className="table-wrap">
                <table className="table staff-table">
                  <thead>
                    <tr>
                      <th>{t('City', 'Plaats')}</th>
                      <th className="num">{t('Customers', 'Klanten')}</th>
                      <th className="num">{t('Attention', 'Aandacht')}</th>
                      <th className="num">{t('Too low', 'Te laag')}</th>
                      <th className="num hide-m">{t('EV peak', 'Piek')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityPages.rows.map((c) => (
                      <tr key={c.city}>
                        <td className="small strong">{c.city}</td>
                        <td className="small num">{num(c.customers)}</td>
                        <td className="small num">
                          {num(c.attention)} <span className="xs muted">({pct(c.attention, c.customers)}%)</span>
                        </td>
                        <td className="small num">{num(c.tooLow)}</td>
                        <td className="small num hide-m">{num(c.evPeak)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager paged={cityPages} />
            </Card>
          </div>
        </>
      )}
    </>
  );
}
