import { useState, type ReactNode } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, Flame, MailCheck, MessageSquareText, Wallet, Zap } from 'lucide-react';
import { PHRASES } from '../../assistant/intents';
import { ChartLegend, UsageChart, type Metric } from '../../components/UsageChart';
import { Card, Delta, Kpi, Seg } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import { brand } from '../../brand';
import { useStaff } from '../context';
import { CATEGORIES } from '../kinds';
import { StaffHead } from '../parts';

type Row = (string | number)[];

function ExportButton({ name, rows }: { name: string; rows: () => Row[] }) {
  const { t } = useI18n();
  return (
    <button className="btn btn-outline btn-sm" onClick={() => downloadCsv(name, rows())}>
      <Download size={14} /> {t('Export CSV', 'Exporteer CSV')}
    </button>
  );
}

/** A horizontal bar list: label, bar, value. */
function Bars({ items, unit }: { items: { label: string; value: number; color?: string; note?: string }[]; unit?: string }) {
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
            {unit ? ` ${unit}` : ''}
            {i.note ? ` · ${i.note}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Reports on this customer: usage, cost, appliances, app activity, messages and Eva, each with a CSV export. */
export default function StaffReports() {
  const { t, tx, eur, num, lang } = useI18n();
  const { chart: c } = useTheme();
  const { overview: o, energy, billing, activity, outbox, conversations } = useStaff();
  const [metric, setMetric] = useState<Metric>('electricity');
  if (!o || !energy || !billing) return <StaffHead icon={BarChart3} title={t('Reports', 'Rapporten')} sub={t('Loading the reports…', 'Rapporten worden geladen…')} />;

  const monthly = energy.monthly;
  const sum = (f: (m: (typeof monthly)[number]) => number | undefined) => monthly.reduce((s, m) => s + (f(m) ?? 0), 0);
  const elec = sum((m) => m.electricity);
  const elecPrev = sum((m) => m.prevElectricity);
  const gas = sum((m) => m.gas);
  const gasPrev = sum((m) => m.prevGas);
  const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : 0);
  const vsYear = (now: number, prev: number): ReactNode => (
    <span className="xs muted">
      <Delta pct={pct(now, prev)} /> {t('vs the year before', 't.o.v. het jaar ervoor')}
    </span>
  );

  // Cost per month from the contract's prices, against the installment paid each month.
  const price = o.contract;
  const installment = o.installment.current;
  const costRows = monthly.map((m) => {
    const cost = Math.round(m.electricity * price.electricity.avgPrice + m.gas * price.gas.price + price.fixedPerMonth);
    return { name: tx(m.label), cost, diff: cost - installment };
  });
  const over = costRows.filter((r) => r.diff > 0).length;

  const total = energy.breakdown.reduce((s, b) => s + b.kwh, 0);

  const sent = outbox.filter((m) => m.status === 'sent');
  const onPhone = sent.filter((m) => (m.pushed ?? 0) > 0).length;
  const read = sent.filter((m) => m.readAt).length;
  const scheduled = outbox.filter((m) => m.status === 'scheduled').length;

  const answers = conversations.flatMap((cv) => cv.entries.filter((e) => e.role === 'assistant'));
  const notUnderstood = answers.filter((e) => e.intent === 'FALLBACK').length;
  const forAgent = answers.filter((e) => e.intent === 'HUMAN').length;
  const answered = answers.length - notUnderstood;
  const topics = new Map<string, number>();
  for (const e of answers) topics.set(e.intent ?? 'FALLBACK', (topics.get(e.intent ?? 'FALLBACK') ?? 0) + 1);
  const topicLabel = (intent: string) =>
    intent === 'FALLBACK' ? t('Not understood', 'Niet begrepen') : intent === 'GREETING' ? t('Greeting', 'Begroeting') : intent === 'THANKS' ? t('Thanks', 'Bedankje') : (PHRASES[intent as keyof typeof PHRASES]?.[lang] ?? intent);
  const topicRows = [...topics.entries()].sort((a, b) => b[1] - a[1]);

  const byCategory = CATEGORIES.map((cat) => ({ label: tx(cat.label), value: activity.filter((a) => cat.kinds.includes(a.kind)).length }));

  return (
    <>
      <StaffHead icon={BarChart3} title={t('Reports', 'Rapporten')} sub={t('Usage, cost, appliances, app activity, messages and assistant conversations for this customer. Every table exports to CSV.', 'Verbruik, kosten, apparaten, app-activiteit, berichten en assistentgesprekken van deze klant. Elke tabel is te exporteren naar CSV.')} />

      <div className="grid g-4 staff-kpis">
        <Kpi icon={Zap} tone="el" label={t('Electricity, 12 months', 'Stroom, 12 maanden')} value={num(elec)} unit="kWh" foot={vsYear(elec, elecPrev)} />
        <Kpi icon={Flame} tone="gas" label={t('Gas, 12 months', 'Gas, 12 maanden')} value={num(gas)} unit="m³" foot={vsYear(gas, gasPrev)} />
        <Kpi icon={Wallet} tone="eur" label={t('Estimated cost per year', 'Geschatte kosten per jaar')} value={eur(billing.annualOverview.estimatedTotal, 0)} foot={<span className="xs muted">{t(`Installments cover ${eur(billing.annualOverview.installmentsTotal, 0)}`, `Termijnen dekken ${eur(billing.annualOverview.installmentsTotal, 0)}`)}</span>} />
        <Kpi icon={MailCheck} tone="pur" label={t('Messages read', 'Berichten gelezen')} value={`${read}/${sent.length}`} foot={<span className="xs muted">{t(`${scheduled} scheduled`, `${scheduled} ingepland`)}</span>} />
        <Kpi icon={MessageSquareText} tone="ink" label={t(`${brand.assistant.name} answered`, `${brand.assistant.name} beantwoord`)} value={`${answered}/${answers.length}`} foot={<span className="xs muted">{t(`${forAgent} asked for an agent`, `${forAgent} vroegen om een medewerker`)}</span>} />
      </div>

      <div className="staff-grid">
        <Card
          title={t('Usage by month', 'Verbruik per maand')}
          sub={t('Last 12 months against the year before', 'Laatste 12 maanden tegenover het jaar ervoor')}
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
              <ExportButton
                name="usage-by-month"
                rows={() => [
                  [t('Month', 'Maand'), t('Electricity kWh', 'Stroom kWh'), t('of which EV kWh', 'waarvan auto kWh'), t('Electricity year before', 'Stroom jaar ervoor'), t('Gas m3', 'Gas m3'), t('Gas year before', 'Gas jaar ervoor')],
                  ...monthly.map((m) => [tx(m.label), m.electricity, m.ev ?? 0, m.prevElectricity ?? '', m.gas, m.prevGas ?? '']),
                ]}
              />
            </span>
          }
        >
          <UsageChart data={monthly} metric={metric} compare showEv height={240} />
          <ChartLegend metric={metric} compare ev />
        </Card>

        <Card
          title={t('Cost per month against the installment', 'Kosten per maand tegenover het termijnbedrag')}
          sub={t(`${over} of 12 months cost more than the ${eur(installment, 0)} installment`, `${over} van de 12 maanden kostten meer dan het termijnbedrag van ${eur(installment, 0)}`)}
          className="report-card"
          action={<ExportButton name="cost-by-month" rows={() => [[t('Month', 'Maand'), t('Cost EUR', 'Kosten EUR'), t('Installment EUR', 'Termijnbedrag EUR'), t('Difference EUR', 'Verschil EUR')], ...costRows.map((r) => [r.name, r.cost, installment, r.diff])]} />}
        >
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <ComposedChart data={costRows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} interval="preserveStartEnd" minTickGap={10} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={48} tickFormatter={(v: number) => `€${v}`} />
                <Tooltip
                  cursor={{ fill: c.cursor }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0]?.payload as (typeof costRows)[number];
                    return (
                      <div className="chart-tip">
                        <b>{label}</b>
                        <div>{eur(r.cost, 0)}</div>
                        <div style={{ opacity: 0.75 }}>{r.diff > 0 ? t(`${eur(r.diff, 0)} above the installment`, `${eur(r.diff, 0)} boven het termijnbedrag`) : t(`${eur(-r.diff, 0)} below the installment`, `${eur(-r.diff, 0)} onder het termijnbedrag`)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="cost" radius={[5, 5, 3, 3]} animationDuration={600}>
                  {costRows.map((r) => (
                    <Cell key={r.name} fill={r.diff > 0 ? '#ff8a3d' : '#23d2b5'} />
                  ))}
                </Bar>
                <ReferenceLine y={installment} stroke={c.ink} strokeDasharray="4 4" strokeWidth={2} strokeOpacity={0.6} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: '#ff8a3d' }} />
              {t('Above the installment', 'Boven het termijnbedrag')}
            </span>
            <span>
              <i style={{ background: '#23d2b5' }} />
              {t('Below the installment', 'Onder het termijnbedrag')}
            </span>
            <span>
              <i style={{ background: 'transparent', border: '2px dashed var(--ink)', opacity: 0.6, height: 0, width: 14, borderRadius: 0, verticalAlign: 3 }} />
              {t(`Installment ${eur(installment, 0)}`, `Termijnbedrag ${eur(installment, 0)}`)}
            </span>
          </div>
        </Card>
      </div>

      <div className="staff-grid">
        <Card
          title={t('Electricity by appliance', 'Stroom per apparaat')}
          sub={t('October 2026', 'Oktober 2026')}
          className="report-card"
          action={<ExportButton name="electricity-by-appliance" rows={() => [[t('Appliance', 'Apparaat'), 'kWh', t('Share %', 'Aandeel %')], ...energy.breakdown.map((b) => [tx(b.label), b.kwh, Math.round((b.kwh / total) * 100)])]} />}
        >
          <Bars unit="kWh" items={energy.breakdown.map((b) => ({ label: tx(b.label), value: b.kwh, color: b.color, note: `${Math.round((b.kwh / total) * 100)}%` }))} />
        </Card>

        <Card
          title={t('App activity by type', 'App-activiteit per soort')}
          sub={t(`${activity.length} actions in ${brand.portal} this session`, `${activity.length} acties in ${brand.portal} in deze sessie`)}
          className="report-card"
          action={<ExportButton name="app-activity" rows={() => [[t('Type', 'Soort'), t('Actions', 'Acties')], ...byCategory.map((r) => [r.label, r.value])]} />}
        >
          <Bars items={byCategory} />
        </Card>
      </div>

      <div className="staff-grid">
        <Card
          title={t('Message delivery', 'Aflevering van berichten')}
          sub={t('From sent to read', 'Van verstuurd tot gelezen')}
          className="report-card"
          action={
            <ExportButton
              name="messages"
              rows={() => [
                [t('Title', 'Titel'), t('Status', 'Status'), t('Sent', 'Verstuurd'), t('Phones reached', 'Telefoons bereikt'), t('Read', 'Gelezen')],
                ...outbox.map((m) => [tx(m.title), m.status, m.sentAt ?? '', m.pushed ?? 0, m.readAt ?? '']),
              ]}
            />
          }
        >
          <Bars
            items={[
              { label: t('Sent', 'Verstuurd'), value: sent.length, color: 'var(--blue)' },
              { label: t('Reached a phone', 'Op een telefoon'), value: onPhone, color: 'var(--purple)' },
              { label: t('Read in the app', 'Gelezen in de app'), value: read, color: 'var(--green)' },
            ]}
          />
          <p className="small muted mt">
            {sent.length === 0 ? t('No messages sent yet. Send one from Messages to see it here.', 'Nog geen berichten verstuurd. Verstuur er een via Berichten om het hier te zien.') : t(`${Math.round((read / sent.length) * 100)}% of sent messages were read.`, `${Math.round((read / sent.length) * 100)}% van de verstuurde berichten is gelezen.`)}
          </p>
        </Card>

        <Card
          title={t(`${brand.assistant.name} conversations`, `Gesprekken met ${brand.assistant.name}`)}
          sub={t(`${conversations.length} conversation${conversations.length === 1 ? '' : 's'}, ${answers.length} question${answers.length === 1 ? '' : 's'}`, `${conversations.length} ${conversations.length === 1 ? 'gesprek' : 'gesprekken'}, ${answers.length} ${answers.length === 1 ? 'vraag' : 'vragen'}`)}
          className="report-card"
          action={<ExportButton name="eva-topics" rows={() => [[t('Topic', 'Onderwerp'), t('Questions', 'Vragen')], ...topicRows.map(([intent, n]) => [topicLabel(intent), n])]} />}
        >
          {topicRows.length === 0 ? (
            <p className="small muted staff-empty">
              <MessageSquareText size={18} aria-hidden /> {t(`No questions yet. Ask ${brand.assistant.name} something in the customer app.`, `Nog geen vragen. Stel ${brand.assistant.name} een vraag in de klant-app.`)}
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table staff-table">
                <thead>
                  <tr>
                    <th>{t('Topic', 'Onderwerp')}</th>
                    <th>{t('Questions', 'Vragen')}</th>
                  </tr>
                </thead>
                <tbody>
                  {topicRows.map(([intent, n]) => (
                    <tr key={intent}>
                      <td className="small">
                        {topicLabel(intent)}
                        {intent === 'FALLBACK' && <span className="badge warn" style={{ marginLeft: 8 }}>{t('Needs an answer', 'Antwoord nodig')}</span>}
                      </td>
                      <td className="num small strong">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
