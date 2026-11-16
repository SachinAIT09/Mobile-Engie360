import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { BRAND, fmtDate, fmtInt, fmtWindow, type DistrictStat } from '@engie/shared';
import { useLoad, useSocketEvent } from '../lib/client';
import {
  blindSpotBars,
  campaignFunnel,
  drPerformance,
  enrollmentByDistrict,
  enrollmentSources,
  gridAreaKnownTop,
  toCsv,
  type CsvCell,
  type FunnelMode,
} from '../lib/reports';
import { districtCampaignLink } from '../lib/links';
import { PageHeader } from '../components/PageHeader';
import { CardHeader } from '../components/CardHeader';
import { StatusPill } from '../components/StatusPill';
import { Icon, type IconName } from '../components/icons';
import { EmptyState, ErrorNotice, LoadingBlock } from '../components/State';
import '../components/addons.css';

const AXIS = { fontSize: 12, fill: 'var(--font-color)' } as const;
const KNOWN = 'var(--solar)';
const UNENROLLED = 'var(--ev)';

/** Client-side CSV download (Blob + object URL). */
function downloadCsv(filename: string, headers: string[], rows: CsvCell[][]) {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn sec sm" onClick={onClick} aria-label={label}>
      <Icon name="file" size={14} />
      &nbsp;Export CSV
    </button>
  );
}

/** Visually hidden data table so the chart's numbers are available to assistive tech. */
function SrTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: CsvCell[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c === null || c === undefined ? '' : String(c)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="chart-tip">
      {label !== undefined && <strong>{String(label)}</strong>}
      {payload.map((p) => (
        <div key={String(p.name)} className="row gap8 between">
          <span>
            <span className="sw" style={{ background: p.color, marginRight: 6 }} />
            {String(p.name)}
          </span>
          <strong>{typeof p.value === 'number' ? fmtInt(p.value) : String(p.value ?? '')}</strong>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, icon, tone, dark }: { label: string; value: string; sub: string; icon: IconName; tone?: string; dark?: boolean }) {
  return (
    <div className={`card kpi ${dark ? 'dark' : ''}`}>
      <div className="kpi-top">
        <span className={`ic-tile sm ${tone ?? ''}`}>
          <Icon name={icon} size={16} />
        </span>
        <span className="kl">{label}</span>
      </div>
      <span className="kv">{value}</span>
      <span className="ks">{sub}</span>
    </div>
  );
}

/** `wide` spans both grid columns, for tables that need the full page width. */
function Card({ children, labelledBy, wide }: { children: ReactNode; labelledBy: string; wide?: boolean }) {
  return (
    <section className={`card pad stack gap14${wide ? ' span-all' : ''}`} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}

export function ReportsPage() {
  const reports = useLoad((api) => api.reports());
  const campaigns = useLoad((api) => api.campaigns());
  const flexEvents = useLoad((api) => api.flexEvents());
  const subs = useLoad((api) => api.gridAreas());
  const blind = useLoad((api) => api.blindSpots());
  const liveSub = subs.data?.find((s) => s.interactive)?.code ?? null;
  const districts = useLoad((api) => (liveSub ? api.gridAreaDistricts(liveSub) : Promise.resolve([] as DistrictStat[])), [liveSub]);

  const reloadCampaigns = () => {
    void campaigns.reload();
    void reports.reload();
  };
  const reloadDistricts = () => {
    void districts.reload();
    void subs.reload();
    void blind.reload();
    void reports.reload();
  };
  useSocketEvent('campaign:statsChanged', reloadCampaigns);
  useSocketEvent('flexEvent:statusChanged', () => {
    void flexEvents.reload();
    void reports.reload();
  });
  useSocketEvent('district:statsChanged', reloadDistricts);
  useSocketEvent('demo:reset', () => {
    reloadCampaigns();
    reloadDistricts();
    void flexEvents.reload();
  });

  const [funnelMode, setFunnelMode] = useState<FunnelMode>('latest');

  const data = reports.data;
  const districtRows = useMemo(() => enrollmentByDistrict(districts.data ?? []), [districts.data]);
  const sources = useMemo(() => enrollmentSources(data?.enrollments.bySource ?? {}), [data]);
  const trend = useMemo(
    () => (data?.enrollments.last30Days ?? []).map((d) => ({ date: d.date, label: fmtDate(`${d.date}T12:00:00`, { month: 'short', day: 'numeric' }), Enrollments: d.count })),
    [data],
  );
  const funnel = useMemo(() => campaignFunnel(campaigns.data ?? [], funnelMode), [campaigns.data, funnelMode]);
  const drRows = useMemo(() => drPerformance(campaigns.data ?? [], flexEvents.data ?? []), [campaigns.data, flexEvents.data]);
  const subRows = useMemo(() => gridAreaKnownTop(subs.data ?? [], 8), [subs.data]);
  const gaps = useMemo(() => blindSpotBars(blind.data ?? [], 8), [blind.data]);

  const districtChart = districtRows.map((r) => ({ name: r.short, Known: r.known, Unenrolled: r.unenrolled }));
  const funnelChart = (funnel?.stages ?? []).map((s) => ({ name: s.stage, Customers: s.count, pct: s.pct }));
  const generated = data ? fmtDate(data.generatedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <main className="page">
      <PageHeader
        title="Reports"
        icon="chart"
        sub={`Program and campaign results, updated live as customers act in the app. Enrollment, ${BRAND.partners.disaggregation} visibility and demand-response performance from the pilot data set.`}
        actions={generated && <span className="small muted">Generated {generated}</span>}
      />

      {reports.error && <ErrorNotice message={`Couldn't load the report figures: ${reports.error}`} onRetry={() => void reports.reload()} />}
      {reports.loading && !data && <LoadingBlock rows={4} rowHeight={48} label="Loading reports" />}

      {data && (
        <section className="kpis" aria-label="Headline results">
          <Kpi label="Active enrollments" value={fmtInt(data.enrollments.active)} sub="in the program today" icon="check" tone="solar" />
          <Kpi label="Enrolled today" value={fmtInt(data.enrollments.today)} sub="new enrollments since midnight" icon="users" tone="accent" />
          <Kpi label="kWh shifted" value={fmtInt(Math.round(data.flexProgram.kwhShifted))} sub={`across ${data.flexProgram.eventsEnded} ended event${data.flexProgram.eventsEnded === 1 ? '' : 's'}`} icon="bolt" />
          <Kpi label="Peak reduced" value={`${data.flexProgram.peakReducedMw.toFixed(2)} MW`} sub={`${fmtInt(data.flexProgram.householdsPaused)} households paused`} icon="chart" dark />
          <Kpi label="Campaigns sent" value={fmtInt(data.campaigns.total)} sub={`${data.campaigns.offers} offers · ${data.campaigns.flexRequests} flex requests · ${data.campaigns.testSends} tests`} icon="send" tone="ok" />
        </section>
      )}

      <div className="two">
        {/* ---------------------------------------------------------------- enrollment by district */}
        <Card labelledBy="rep-district-h">
          <CardHeader
            id="rep-district-h"
            icon="pylon"
            title={`Enrollment by district${liveSub ? ` · ${liveSub}` : ''}`}
            sub="Known (enrolled) and detected-but-unenrolled EVs per district. Moves live as customers enroll."
            actions={
              <ExportButton
                label="Export enrollment by district as CSV"
                onClick={() =>
                  downloadCsv(
                    `enrollment-by-district-${liveSub ?? 'all'}.csv`,
                    ['District', 'Known', 'Unenrolled', 'Total EVs', 'Known %'],
                    districtRows.map((r) => [r.code, r.known, r.unenrolled, r.evs, r.knownPct]),
                  )
                }
              />
            }
          />
          {districts.error && <ErrorNotice message={districts.error} onRetry={() => void districts.reload()} />}
          {districts.loading && !districts.data && <LoadingBlock rows={3} rowHeight={40} label="Loading districts" />}
          {districts.data && districtRows.length === 0 && <EmptyState title="No district split" body="The sample data has no enrolled / unenrolled split for this gridArea." />}
          {districtRows.length > 0 && (
            <>
              <div className="chart" role="img" aria-label={`Stacked bar chart of known and unenrolled EVs for ${districtRows.length} districts on ${liveSub ?? 'the gridArea'}`}>
                <ResponsiveContainer>
                  <BarChart data={districtChart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={Tip} cursor={{ fill: 'var(--primary-soft)' }} />
                    <Bar dataKey="Known" stackId="a" fill={KNOWN} stroke="var(--page-bg-deep)" strokeWidth={2} isAnimationActive={false} />
                    <Bar dataKey="Unenrolled" stackId="a" fill={UNENROLLED} stroke="var(--page-bg-deep)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <SrTable caption="Enrollment by district" headers={['District', 'Known', 'Unenrolled', 'Total']} rows={districtRows.map((r) => [r.code, r.known, r.unenrolled, r.evs])} />
              <div className="legend">
                <span>
                  <span className="sw" style={{ background: KNOWN }} />
                  Known / enrolled
                </span>
                <span>
                  <span className="sw" style={{ background: UNENROLLED }} />
                  Detected, unenrolled
                </span>
              </div>
            </>
          )}
        </Card>

        {/* ---------------------------------------------------------------- enrollment source */}
        <Card labelledBy="rep-source-h">
          <CardHeader id="rep-source-h" icon="users" tone="accent" title="Enrollment source" sub="Where active enrollments came from, and the last 30 days of new enrollments." />
          {data ? (
            <>
              <div className="stack gap8">
                {sources.map((s) => (
                  <div key={s.source} className="rowcard">
                    <span className="body">
                      <span className="title">{s.label}</span>
                      <span className="meta">{s.pct}% of active enrollments</span>
                    </span>
                    <span className="val">{fmtInt(s.count)}</span>
                  </div>
                ))}
              </div>
              <div className="chart" style={{ height: 120 }} role="img" aria-label={`Line chart of daily enrollments over the last ${trend.length} days`}>
                <ResponsiveContainer>
                  <AreaChart data={trend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip content={Tip} />
                    <Area type="monotone" dataKey="Enrollments" stroke="var(--chart-total)" strokeWidth={2} fill="none" dot={false} activeDot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <SrTable caption="Daily enrollments, last 30 days" headers={['Date', 'Enrollments']} rows={trend.map((t) => [t.date, t.Enrollments])} />
              <span className="small muted">New enrollments per day, last 30 days · {fmtInt(data.enrollments.today)} today</span>
            </>
          ) : (
            <LoadingBlock rows={3} label="Loading enrollment sources" />
          )}
        </Card>

        {/* ---------------------------------------------------------------- campaign funnel */}
        <Card labelledBy="rep-funnel-h">
          <CardHeader
            id="rep-funnel-h"
            icon="campaign"
            title="Campaign funnel"
            sub={funnel ? funnel.label : 'Slim Laden offers sent through Campaign 360.'}
            actions={
              <>
                <div className="toggle" role="group" aria-label="Funnel scope">
                  <button type="button" className={funnelMode === 'latest' ? 'on' : ''} aria-pressed={funnelMode === 'latest'} onClick={() => setFunnelMode('latest')}>
                    Latest
                  </button>
                  <button type="button" className={funnelMode === 'all' ? 'on' : ''} aria-pressed={funnelMode === 'all'} onClick={() => setFunnelMode('all')}>
                    All
                  </button>
                </div>
                {funnel && (
                  <ExportButton
                    label="Export campaign funnel as CSV"
                    onClick={() => downloadCsv(`campaign-funnel-${funnelMode}.csv`, ['Stage', 'Customers', '% of sent'], funnel.stages.map((s) => [s.stage, s.count, s.pct]))}
                  />
                )}
              </>
            }
          />
          {campaigns.error && <ErrorNotice message={campaigns.error} onRetry={() => void campaigns.reload()} />}
          {campaigns.loading && !campaigns.data && <LoadingBlock rows={3} rowHeight={28} label="Loading campaigns" />}
          {campaigns.data && !funnel && (
            <EmptyState
              title="No Slim Laden offers yet"
              body="Send an offer to detected, unenrolled EVs and the funnel fills in here."
              action={{ label: 'New Slim Laden offer', to: districtCampaignLink('ENROLL_OFFER', '3581', 'UNENROLLED_EV') }}
            />
          )}
          {funnel && (
            <>
              <div className="chart" role="img" aria-label={`Horizontal bar chart: ${funnel.stages.map((s) => `${s.stage} ${s.count}`).join(', ')}`}>
                <ResponsiveContainer>
                  <BarChart data={funnelChart} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 0 }} barCategoryGap="22%">
                    <CartesianGrid stroke="var(--border-color)" vertical={false} />
                    <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={72} />
                    <Tooltip content={Tip} cursor={{ fill: 'var(--primary-soft)' }} />
                    <Bar dataKey="Customers" fill="var(--ev)" radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: 'right', fontSize: 11, fill: 'var(--font-color)', formatter: (v: unknown) => fmtInt(Number(v)) }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <SrTable caption="Campaign funnel" headers={['Stage', 'Customers', '% of sent']} rows={funnel.stages.map((s) => [s.stage, s.count, `${s.pct}%`])} />
              <span className="small muted">
                {funnel.stages.map((s) => `${s.stage} ${fmtInt(s.count)}${s.stage === 'Sent' ? '' : ` (${s.pct}%)`}`).join(' → ')}
              </span>
            </>
          )}
        </Card>

        {/* ---------------------------------------------------------------- gridAreas */}
        <Card labelledBy="rep-subs-h">
          <CardHeader
            id="rep-subs-h"
            icon="dashboard"
            title="Known share by gridArea"
            sub="The 8 gridAreas with the most matched EVs, by share already enrolled."
            actions={
              subRows.length > 0 && (
                <ExportButton
                  label="Export known share by gridArea as CSV"
                  onClick={() => downloadCsv('slim-laden-share-by-grid-area.csv', ['Grid area', 'Province', 'Matched EVs', 'Known %'], subRows.map((s) => [s.code, s.region, s.evs, s.knownPct]))}
                />
              )
            }
          />
          {subs.error && <ErrorNotice message={subs.error} onRetry={() => void subs.reload()} />}
          {subs.loading && !subs.data && <LoadingBlock rows={4} rowHeight={28} label="Loading gridAreas" />}
          {subRows.length > 0 && (
            <div className="tablebox">
              <table className="tbl fit">
                <thead>
                  <tr>
                    <th scope="col">GridArea</th>
                    <th scope="col">Region</th>
                    <th scope="col">Matched EVs</th>
                    <th scope="col">Known share</th>
                  </tr>
                </thead>
                <tbody>
                  {subRows.map((s) => (
                    <tr key={s.code}>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {s.code}
                      </td>
                      <td>{s.region}</td>
                      <td className="mono">{fmtInt(s.evs)}</td>
                      <td>
                        <span className="gapbar" aria-hidden="true">
                          <span style={{ width: `${s.knownPct}%`, background: KNOWN }} />
                        </span>
                        <strong>{s.knownPct}%</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* ---------------------------------------------------------------- Flex event performance */}
        <Card labelledBy="rep-dr-h" wide>
          <CardHeader
            id="rep-dr-h"
            icon="bolt"
            tone="warn"
            title="Flex event performance"
            sub="Flex requests: who responded, who shifted charging, and the peak reduced."
            actions={
              drRows.length > 0 && (
                <ExportButton
                  label="Export Flex event performance as CSV"
                  onClick={() =>
                    downloadCsv(
                      'flex-event-performance.csv',
                      ['Sent', 'District', 'Audience', 'Status', 'Targeted', 'Responded', 'Paused', 'Reminders', 'Opted out', 'Peak reduced MW', 'Window start', 'Window end', 'Test'],
                      drRows.map((r) => [r.sentAt, r.districtCode, r.audienceLabel, r.status ?? '', r.targeted, r.responded, r.paused, r.reminders, r.optedOut, r.peakReducedMw, r.windowStart, r.windowEnd, r.isTest]),
                    )
                  }
                />
              )
            }
          />
          {flexEvents.error && <ErrorNotice message={flexEvents.error} onRetry={() => void flexEvents.reload()} />}
          {campaigns.data && drRows.length === 0 && (
            <EmptyState
              title="No flex events yet"
              body="Send a flex request to Slim Laden customers in a district and its results land here."
              action={{ label: 'New flex request', to: districtCampaignLink('FLEX_REQUEST', '3581', 'ENROLLED_EV') }}
            />
          )}
          {drRows.length > 0 && (
            <div className="tablebox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Sent</th>
                    <th scope="col">District</th>
                    <th scope="col">Status</th>
                    <th scope="col">Targeted</th>
                    <th scope="col">Responded</th>
                    <th scope="col">Paused</th>
                    <th scope="col">Reminders</th>
                    <th scope="col">Opted out</th>
                    <th scope="col">Peak reduced</th>
                  </tr>
                </thead>
                <tbody>
                  {drRows.map((r) => (
                    <tr key={r.campaignId}>
                      <td>
                        {fmtDate(r.sentAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {r.isTest && <StatusPill kind="test" className="small" />}
                      </td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {r.districtCode}
                        {r.windowStart && r.windowEnd && <span className="small muted" style={{ display: 'block', fontFamily: 'var(--font)' }}>{fmtWindow(r.windowStart, r.windowEnd)}</span>}
                      </td>
                      <td>
                        <StatusPill kind="drStatus" value={r.status} />
                      </td>
                      <td className="mono">{fmtInt(r.targeted)}</td>
                      <td className="mono">{fmtInt(r.responded)}</td>
                      <td className="mono">{fmtInt(r.paused)}</td>
                      <td className="mono">{fmtInt(r.reminders)}</td>
                      <td className="mono">{fmtInt(r.optedOut)}</td>
                      <td className="mono">{r.peakReducedMw.toFixed(3)} MW</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {drRows.length > 0 && (
            <span className="small muted">
              Peak reduced = households that shifted × 3.7 kW. <Link to="/events">Manage flex events ›</Link>
            </span>
          )}
        </Card>

        {/* ---------------------------------------------------------------- gaps */}
        <Card labelledBy="rep-blind-h" wide>
          <CardHeader
            id="rep-blind-h"
            icon="eye"
            tone="warn"
            title="Most EVs outside Slim Laden"
            sub="Districts where the largest share of detected EVs is invisible to enrollment."
            actions={
              gaps.length > 0 && (
                <ExportButton
                  label="Export districts with most EVs outside Slim Laden as CSV"
                  onClick={() => downloadCsv('worst-blind-spots.csv', ['Rank', 'District', 'Region', 'Known', 'Unenrolled', 'Gap %'], gaps.map((g) => [g.rank, g.districtCode, g.region, g.known, g.unenrolled, g.gapPct]))}
                />
              )
            }
          />
          {blind.error && <ErrorNotice message={blind.error} onRetry={() => void blind.reload()} />}
          {blind.loading && !blind.data && <LoadingBlock rows={4} rowHeight={28} label="Loading districts" />}
          {blind.data && gaps.length === 0 && <EmptyState title="No gaps" body="Every district with 15 or more EVs has most of them enrolled." />}
          {gaps.length > 0 && (
            <div className="tablebox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">District</th>
                    <th scope="col">Known</th>
                    <th scope="col">Unenrolled</th>
                    <th scope="col">Gap (% invisible)</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((g) => (
                    <tr key={g.districtCode}>
                      <td>{g.rank}</td>
                      <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                        {g.districtCode}
                        {g.region && <span className="small muted" style={{ display: 'block', fontFamily: 'var(--font)' }}>{g.region}</span>}
                      </td>
                      <td className="mono">{fmtInt(g.known)}</td>
                      <td className="mono">{fmtInt(g.unenrolled)}</td>
                      <td>
                        <span className="gapbar" aria-hidden="true">
                          <span style={{ width: `${g.gapPct}%` }} />
                        </span>
                        <strong>{g.gapPct}%</strong>
                      </td>
                      <td>
                        <Link className="btn sec sm" to={districtCampaignLink('ENROLL_OFFER', g.districtCode, 'UNENROLLED_EV')}>
                          Target {g.unenrolled}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="foot">
        Sample data · generated {generated ?? '—'} · {BRAND.conceptLabel}. Figures update live from the demo API; exports are the tables as shown.
      </p>
    </main>
  );
}
