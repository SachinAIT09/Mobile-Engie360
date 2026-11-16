import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BRAND, fmtInt, type DistrictStat, type GridAreaStat } from '@engie/shared';
import { useLoad, useSocketEvent } from '../lib/client';
import { districtCampaignLink } from '../lib/links';
import { LiveEvents } from '../components/LiveEvents';
import { PageHeader } from '../components/PageHeader';
import { Icon, type IconName } from '../components/icons';
import { LoadingBlock } from '../components/State';

const BAR_MAX_PX = 140;

const CONGESTION: Record<GridAreaStat['congestion'], { label: string; tone: string }> = {
  NONE: { label: 'No congestion', tone: 'ok' },
  WATCH: { label: 'Watch', tone: 'warn' },
  CONGESTED: { label: 'Congested', tone: 'danger' },
};

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

export function DistrictsPage() {
  const overview = useLoad((api) => api.statsOverview());
  const subs = useLoad((api) => api.gridAreas());
  const blind = useLoad((api) => api.blindSpots());
  const dead = useLoad((api) => api.deadGridAreas());

  const [pickedSub, setSubCode] = useState<string | null>(null);
  const [pickedDistrict, setDistrictCode] = useState<string | null>(null);
  const [region, setRegion] = useState('all');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  // Region filter: distinct regions from the gridArea list; filters the gridArea list and the blind-spots table.
  const regions = useMemo(() => Array.from(new Set((subs.data ?? []).map((s) => s.region))).sort(), [subs.data]);
  const visibleSubs = useMemo(() => (subs.data ?? []).filter((s) => region === 'all' || s.region === region), [subs.data, region]);
  const visibleBlind = useMemo(() => (blind.data ?? []).filter((b) => region === 'all' || !b.region || b.region === region), [blind.data, region]);

  // Default selection: the interactive grid area (Utrecht-Oost in the demo), else the largest.
  const subCode =
    (pickedSub && visibleSubs.some((s) => s.code === pickedSub) ? pickedSub : null) ?? (visibleSubs.find((s) => s.interactive) ?? visibleSubs[0])?.code ?? null;

  const districts = useLoad((api) => (subCode ? api.gridAreaDistricts(subCode) : Promise.resolve([] as DistrictStat[])), [subCode]);

  // The picked district when it belongs to the listed gridArea; otherwise the first district of the list.
  const districtList = districts.data;
  const districtCode = pickedDistrict && districtList?.some((f) => f.code === pickedDistrict) ? pickedDistrict : (districtList?.[0]?.code ?? null);

  const refreshAll = () => {
    void overview.reload();
    void subs.reload();
    void blind.reload();
    void dead.reload();
    void districts.reload();
  };
  useSocketEvent('district:statsChanged', refreshAll);
  useSocketEvent('demo:reset', refreshAll);

  const sub: GridAreaStat | undefined = subs.data?.find((s) => s.code === subCode);
  const selected: DistrictStat | undefined = districts.data?.find((f) => f.code === districtCode);
  const maxEvs = useMemo(() => Math.max(1, ...(districts.data ?? []).map((f) => f.evs)), [districts.data]);
  const ov = overview.data;
  const subTotalEvs = (districts.data ?? []).reduce((a, f) => a + f.evs, 0);

  return (
    <main className="page">
      <PageHeader
        title="Dashboard"
        icon="dashboard"
        sub={`What ${BRAND.partners.disaggregation} recognises in ${BRAND.utilityName} smart-meter data, by grid area and postcode district: EVs charging outside Slim Laden, and customers whose installment no longer fits their usage.`}
        actions={
          <>
            <label className="filter">
              Province
              <select value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="all">All provinces</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter">
              Period
              <select value={String(period)} onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90)}>
                <option value="30">Last 30 days</option>
                <option value="7">Last 7 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
          </>
        }
      />

      <section className="kpis" aria-label="Headline figures">
        <Kpi label="Customers" value={ov ? fmtInt(ov.customers) : '—'} sub={ov ? `${fmtInt(ov.onDynamic)} on a dynamic contract` : ''} icon="users" />
        <Kpi label="EVs in Slim Laden" value={ov ? fmtInt(ov.knownEvs) : '—'} sub="flexible, shift on request" icon="check" tone="solar" />
        <Kpi label="EVs not in Slim Laden" value={ov ? fmtInt(ov.unenrolledEvs) : '—'} sub={`detected by ${BRAND.partners.disaggregation}`} icon="car" tone="accent" />
        <Kpi label="Installment too low" value={ov ? fmtInt(ov.installmentGapCustomers) : '—'} sub={ov ? `avg. € ${ov.avgInstallmentGap} a month below advice` : ''} icon="chart" />
        <Kpi label="Not flexible" value={ov ? `${ov.invisiblePct}%` : '—'} sub="of detected EVs charge unmanaged" icon="eye" dark />
      </section>
      {overview.error && <div className="notice err">Couldn't load figures: {overview.error}</div>}
      <p className="small muted" style={{ marginTop: -8 }}>
        Headline figures cover all provinces · Sample data{period !== 30 ? ` · live events: last ${period} days` : ''}
      </p>

      <LiveEvents days={period} />

      <section className="three">
        <div className="card sublist" aria-labelledby="subs-h">
          <h2 id="subs-h" className="h2">
            Grid areas, by detected EVs
          </h2>
          {subs.data && (
            <p className="small muted" style={{ padding: '0 20px 8px' }} aria-live="polite">
              Showing {visibleSubs.length} grid area{visibleSubs.length === 1 ? '' : 's'}
              {region === 'all' ? ' in all provinces' : ` in ${region}`}
            </p>
          )}
          {visibleSubs.map((s) => (
            <button
              key={s.code}
              type="button"
              className={`subbtn ${s.code === subCode ? 'sel' : ''}`}
              aria-pressed={s.code === subCode}
              onClick={() => setSubCode(s.code)}
            >
              <span className="row between">
                <span className="code">{s.name}</span>
                <span style={{ fontWeight: 600 }}>{fmtInt(s.evs)} EVs</span>
              </span>
              <span className="row between">
                <span className="small muted">
                  {s.operator} · {s.knownPct}% in Slim Laden
                </span>
                {s.congestion !== 'NONE' && <span className={`pill ${CONGESTION[s.congestion].tone}`}>{CONGESTION[s.congestion].label}</span>}
              </span>
              <span className="splitbar" aria-hidden="true">
                <span style={{ width: `${s.knownPct}%` }} />
              </span>
            </button>
          ))}
          {subs.loading && !subs.data && <LoadingBlock rows={4} rowHeight={40} label="Loading grid areas" className="pad" />}
        </div>

        <div className="card pad diagram stack gap14">
          <div className="row between gap8">
            <div className="card-head">
              <span className="ic-tile">
                <Icon name="pylon" size={18} />
              </span>
              <div>
                <div className="lbl">Selected grid area{sub ? ` · ${sub.operator}` : ''}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>{sub?.name ?? '—'}</div>
                <div className="small muted">{sub ? `${sub.districtCount} postcode districts · ${fmtInt(sub.evs)} detected EVs · ${CONGESTION[sub.congestion].label.toLowerCase()}` : ''}</div>
              </div>
            </div>
          </div>

          <>
              <div className="schematic" aria-hidden="true">
                <span className="node" />
                <span className="small muted">Grid area</span>
                <span className="stem" />
              </div>
              <div className="bus" aria-hidden="true" />
              {districts.data && districts.data.length > 0 ? (
                <div className="districts">
                  {districts.data.map((f) => {
                    const scale = BAR_MAX_PX / maxEvs;
                    const split = f.known !== null && f.unenrolled !== null;
                    return (
                      <button
                        key={f.code}
                        type="button"
                        className={`fbtn ${f.code === districtCode ? 'sel' : ''}`}
                        aria-pressed={f.code === districtCode}
                        aria-label={`${f.code} ${f.name}, ${f.evs} EVs${split ? `, ${f.known} in Slim Laden, ${f.unenrolled} not` : ''}`}
                        onClick={() => setDistrictCode(f.code)}
                      >
                        <span className="fbar" aria-hidden="true">
                          {split ? (
                            <>
                              <span style={{ background: 'var(--ev)', height: Math.max(2, Math.round((f.unenrolled ?? 0) * scale)) }} />
                              <span style={{ background: 'var(--solar)', height: Math.max(2, Math.round((f.known ?? 0) * scale)) }} />
                            </>
                          ) : (
                            <span style={{ background: 'var(--split-pending)', height: Math.max(4, Math.round(f.evs * scale)) }} />
                          )}
                        </span>
                        <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                          {f.code}
                        </span>
                        <span className="small muted">{f.evs} EVs</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mapph">
                  {districts.loading ? 'Loading districts…' : 'The per-district split is not available for this grid area in the sample data.'}
                </div>
              )}
              <div className="legend">
                <span>
                  <span className="sw" style={{ background: 'var(--solar)' }} />
                  In Slim Laden
                </span>
                <span>
                  <span className="sw" style={{ background: 'var(--ev)' }} />
                  Detected, not in Slim Laden
                </span>
                <span>
                  <span className="sw" style={{ background: 'var(--split-pending)' }} />
                  Split not in sample
                </span>
              </div>
              {sub && !sub.interactive && (
                <p className="small muted">
                  Only Utrecht-Oost has customer-level data in this demo; other grid areas show totals from the {BRAND.partners.disaggregation} sample.
                </p>
              )}
              {sub && sub.interactive && subTotalEvs !== sub.evs && (
                <p className="small muted">District totals update live as EVs are detected and customers join Slim Laden.</p>
              )}
          </>
        </div>

        <DistrictDetail district={selected} />
      </section>

      <section className="card pad stack gap12" aria-labelledby="blind-h">
        <div className="card-head">
          <span className="ic-tile warn">
            <Icon name="eye" size={18} />
          </span>
          <div className="stack gap4" style={{ flex: 1 }}>
            <h2 id="blind-h" className="h2">
              Most EVs outside Slim Laden
            </h2>
            <p className="small muted" style={{ fontSize: 13 }}>
              Postcode districts with at least 15 detected EVs, ranked by the share charging outside Slim Laden.
            </p>
          </div>
        </div>
        <div className="tablebox">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">District</th>
                <th scope="col">In Slim Laden</th>
                <th scope="col">Not in Slim Laden</th>
                <th scope="col">Penetration</th>
                <th scope="col">Gap (% not flexible)</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleBlind.map((b) => (
                <tr key={b.districtCode}>
                  <td>{b.rank}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                    {b.districtCode} <span className="muted" style={{ fontWeight: 400 }}>{b.name}</span>
                  </td>
                  <td>{b.known}</td>
                  <td>{b.unenrolled}</td>
                  <td>{b.penetrationText}</td>
                  <td>
                    <span className="gapbar" aria-hidden="true">
                      <span style={{ width: `${b.gapPct}%` }} />
                    </span>
                    <strong>{b.gapPct}%</strong>
                  </td>
                  <td>
                    <Link className="btn sec sm" to={districtCampaignLink('ENROLL_OFFER', b.districtCode, 'UNENROLLED_EV')}>
                      Target {b.unenrolled}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blind.loading && !blind.data && <LoadingBlock rows={3} label="Loading districts" />}
        {blind.data && visibleBlind.length === 0 && <p className="sub">No gaps in {region === 'all' ? 'the sample' : region}.</p>}
      </section>

      <section className="card pad stack gap10" aria-labelledby="dead-h">
        <div className="card-head">
          <span className="ic-tile">
            <Icon name="alert" size={18} />
          </span>
          <h2 id="dead-h" className="h2">
            No EV signal yet
          </h2>
        </div>
        {ov && (
          <>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text-body)' }}>
              {ov.deadGridAreas} grid areas show no EV signal in any district, and {ov.partiallyDeadGridAreas} more have at
              least one district without ({ov.deadDistricts} districts, {fmtInt(ov.deadDistrictPremises)} homes). Check whether these are
              truly zero EVs or homes without a readable smart meter.
            </p>
            <p className="muted" style={{ fontSize: 13 }}>
              Of {fmtInt(ov.matchedPremises)} homes with smart-meter data, {fmtInt(ov.noSignalPremises)} show no EV signal.{' '}
              {fmtInt(ov.noLocationPremises)} homes have no grid area yet and are excluded.
            </p>
          </>
        )}
        {dead.data && dead.data.length > 0 && (
          <div className="tablebox">
            <table className="tbl" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th scope="col">Grid area</th>
                  <th scope="col">Districts</th>
                  <th scope="col">Homes</th>
                </tr>
              </thead>
              <tbody>
                {dead.data.slice(0, 8).map((d) => (
                  <tr key={d.code}>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--navy)' }}>
                      {d.code}
                    </td>
                    <td>
                      {d.districts} district{d.districts === 1 ? '' : 's'}, no signal
                    </td>
                    <td>{d.premises}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="small muted">{ov?.dataSourceNote ?? `${BRAND.partners.disaggregation} appliance recognition, anonymised. Shown as sample data.`}</p>
    </main>
  );
}

function DistrictDetail({ district }: { district: DistrictStat | undefined }) {
  if (!district) {
    return (
      <div className="card pad detail stack gap10">
        <p className="sub">Select a district to see its details.</p>
      </div>
    );
  }
  const split = district.known !== null && district.unenrolled !== null;
  const dash = (v: number | null, suffix = '') => (v === null ? '—' : `${fmtInt(v)}${suffix}`);
  return (
    <div className="card pad detail stack gap10" aria-live="polite">
      <div className="card-head">
        <span className="ic-tile accent">
          <Icon name="bolt" size={18} />
        </span>
        <div>
          <div className="lbl">Postcode district</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>
            <span className="mono">{district.code}</span> {district.name}
          </div>
        </div>
      </div>
      <div className="stack">
        <div className="kvrow">
          <span>EVs in Slim Laden</span>
          <strong style={{ color: 'var(--known-text)' }}>{dash(district.known)}</strong>
        </div>
        <div className="kvrow">
          <span>Detected, not in Slim Laden</span>
          <strong style={{ color: 'var(--unenrolled-text)' }}>{dash(district.unenrolled)}</strong>
        </div>
        <div className="kvrow">
          <span>Total detected EVs</span>
          <strong>{fmtInt(district.evs)}</strong>
        </div>
        <div className="kvrow">
          <span>Slim Laden EVs also seen by Net2Grid</span>
          <strong>{dash(district.confirmedByEnrollment)}</strong>
        </div>
        <div className="kvrow">
          <span>Ground-truth validated</span>
          <strong>{dash(district.groundTruthValidated)}</strong>
        </div>
        <div className="kvrow">
          <span>Customers in this district</span>
          <strong>{dash(district.premises)}</strong>
        </div>
        <div className="kvrow">
          <span>Installment below the advice</span>
          <strong>{dash(district.installmentGap)}</strong>
        </div>
        <div className="kvrow">
          <span>EV penetration</span>
          <strong>{district.penetrationPct === null ? '—' : `${district.penetrationPct}%`}</strong>
        </div>
        {district.forecastLoadPct !== null && district.forecastLoadPct >= 90 && (
          <div className="kvrow">
            <span>Grid forecast tonight</span>
            <strong style={{ color: 'var(--warning-text)' }}>{district.forecastLoadPct}% of capacity</strong>
          </div>
        )}
      </div>
      <p className="notice info" style={{ margin: '4px 0' }}>
        {split ? (
          <>
            <strong>{district.invisiblePct ?? 0}% not flexible.</strong> {district.known} of {district.evs} EVs here are in Slim Laden.
            The other {district.unenrolled} mostly charge at the evening peak: the most expensive hours for them and the busiest for the grid.
            {district.penetrationPct !== null && district.premises !== null
              ? ` EVs sit at ${district.penetrationPct}% of the ${fmtInt(district.premises)} homes in this district.`
              : ''}
          </>
        ) : (
          'The Slim Laden split for this district is not in the sample data.'
        )}
      </p>
      {split ? (
        <>
          <Link className="btn pri wrap" to={districtCampaignLink('ENROLL_OFFER', district.code, 'UNENROLLED_EV')}>
            Slim Laden offer to {district.unenrolled} EV owners
          </Link>
          <Link className="btn outline wrap" to={districtCampaignLink('FLEX_REQUEST', district.code, 'ENROLLED_EV')}>
            Flex request to {district.known} in Slim Laden
          </Link>
          {!!district.installmentGap && (
            <Link className="btn outline wrap" to={districtCampaignLink('INSTALLMENT_ADVICE', district.code, 'INSTALLMENT_GAP')}>
              Installment advice to {district.installmentGap}
            </Link>
          )}
        </>
      ) : (
        <span className="btn sec" aria-disabled="true">
          Targeting needs customer-level data
        </span>
      )}
    </div>
  );
}
