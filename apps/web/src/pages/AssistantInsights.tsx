import { Link } from 'react-router-dom';
import { ASSISTANT, fmtInt, fmtTime, type AssistantChannel, type AssistantLogEntry } from '@engie/shared';
import { useLoad, useSocketEvent } from '../lib/client';
import { timeAgo } from '../lib/reports';
import { CardHeader } from '../components/CardHeader';
import { PageHeader } from '../components/PageHeader';
import { Icon, type IconName } from '../components/icons';
import { EmptyState, ErrorNotice, LoadingBlock } from '../components/State';

const EVA = ASSISTANT.customerName.en;

const CHANNEL: Record<AssistantChannel, { label: string; tone: string }> = {
  APP: { label: 'MijnENGIE app', tone: 'accent' },
  WEBSITE: { label: 'engie.nl visitor', tone: 'grey' },
  WEBSITE_SIGNED_IN: { label: 'engie.nl signed in', tone: 'ev' },
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

function outcome(e: AssistantLogEntry): { label: string; tone: string } {
  if (!e.matched) return { label: 'Not understood', tone: 'danger' };
  if (e.handoff) return { label: 'Handed to customer service', tone: 'warn' };
  if (e.signInPrompt) return { label: 'Asked to sign in', tone: 'grey' };
  return { label: `Answered by ${EVA}`, tone: 'ok' };
}

/** What customers and website visitors ask Eva, live: volume, topics, self-service and the questions she could not answer. */
export function AssistantInsightsPage() {
  const { data, error, loading, reload } = useLoad((api) => api.assistantInsights());
  useSocketEvent('assistant:logged', () => void reload());
  useSocketEvent('demo:reset', () => void reload());

  const maxHour = Math.max(1, ...(data?.hourly ?? []).map((h) => h.count));
  const maxIntent = Math.max(1, ...(data?.topIntents ?? []).map((t) => t.count));
  const channels = data ? (Object.keys(CHANNEL) as AssistantChannel[]).map((c) => ({ id: c, n: data.byChannel[c] })) : [];

  return (
    <main className="page">
      <PageHeader
        title="Assistant insights"
        icon="chat"
        sub={`What customers ask ${EVA} in the MijnENGIE app and on engie.nl, as it happens: topics, how many she answers herself, and where she hands over to customer service.`}
      />
      {error && <ErrorNotice message={error} onRetry={() => void reload()} />}
      {loading && !data && <LoadingBlock rows={4} rowHeight={40} label="Loading assistant insights" />}

      {data && (
        <>
          <section className="kpis" aria-label="Last 24 hours">
            <Kpi label="Questions" value={fmtInt(data.last24h)} sub="in the last 24 hours" icon="chat" />
            <Kpi label="Self-service" value={`${data.selfServicePct}%`} sub={`answered by ${EVA}, no hand-over`} icon="check" tone="solar" />
            <Kpi label="Understood" value={`${data.matchedPct}%`} sub="matched to a known topic" icon="sparkle" tone="accent" />
            <Kpi label="Hand-overs" value={fmtInt(data.handoffs)} sub="passed to customer service" icon="users" />
            <Kpi label="Sign-in prompts" value={fmtInt(data.signInPrompts)} sub="visitors asking about their account" icon="phone" dark />
          </section>

          <section className="two" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 16 }}>
            <div className="card pad stack gap12">
              <CardHeader icon="chart" title="Top topics" sub="Share of questions per topic, last 24 hours" />
              {data.topIntents.length === 0 && <EmptyState title="No questions yet" body={`Ask ${EVA} something on the phone; it appears here instantly.`} />}
              <div className="stack gap10">
                {data.topIntents.map((t) => (
                  <div key={t.intent} className="stack gap4">
                    <div className="row between">
                      <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{t.label}</span>
                      <span className="small muted">
                        {t.count} · {Math.round((t.count / Math.max(1, data.last24h)) * 100)}%
                      </span>
                    </div>
                    <span className="gapbar" aria-hidden="true" style={{ width: '100%' }}>
                      <span style={{ width: `${(t.count / maxIntent) * 100}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card pad stack gap12">
              <CardHeader icon="clock" title="Questions per hour" sub="Last 24 hours, newest on the right" />
              <div className="row" role="img" aria-label="Questions per hour over the last 24 hours" style={{ alignItems: 'flex-end', gap: 3, height: 120 }}>
                {data.hourly.map((h) => (
                  <span
                    key={h.hour}
                    title={`${fmtTime(h.hour)}: ${h.count}`}
                    style={{ flex: 1, minHeight: 2, height: `${(h.count / maxHour) * 100}%`, background: 'var(--accent)', borderRadius: 2 }}
                  />
                ))}
              </div>
              <div className="row between small muted">
                <span>{data.hourly[0] ? fmtTime(data.hourly[0].hour) : ''}</span>
                <span>now</span>
              </div>
              <div className="stack gap6">
                {channels.map((c) => (
                  <div key={c.id} className="kvrow">
                    <span>
                      <span className={`pill ${CHANNEL[c.id].tone}`}>{CHANNEL[c.id].label}</span>
                    </span>
                    <strong>{fmtInt(c.n)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card pad stack gap12">
            <CardHeader icon="alert" title={`Questions ${EVA} could not answer`} sub="Candidates for new answers or a hand-over rule" />
            {data.unanswered.length === 0 ? (
              <EmptyState title="Nothing unanswered" body={`${EVA} understood every question in the last 24 hours.`} />
            ) : (
              <div className="tablebox">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Question</th>
                      <th scope="col">Channel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.unanswered.map((e) => (
                      <tr key={e.id}>
                        <td>{timeAgo(e.at)}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 280 }}>“{e.question}”</td>
                        <td>
                          <span className={`pill ${CHANNEL[e.channel].tone}`}>{CHANNEL[e.channel].label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card pad stack gap12">
            <CardHeader icon="history" title="Live questions" sub={`Newest first · ${fmtInt(data.total)} questions in total`} />
            <div className="tablebox">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Who</th>
                    <th scope="col">Question</th>
                    <th scope="col">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((e) => {
                    const o = outcome(e);
                    return (
                      <tr key={e.id}>
                        <td title={fmtTime(e.at)}>{timeAgo(e.at)}</td>
                        <td>
                          {e.customerId ? (
                            <Link to={`/customers/${e.customerId}`} style={{ fontWeight: 600 }}>
                              {e.customerName}
                            </Link>
                          ) : (
                            <span style={{ fontWeight: 600 }}>{e.customerName ?? 'Website visitor'}</span>
                          )}
                          <span className="small muted" style={{ display: 'block' }}>
                            {CHANNEL[e.channel].label} · {e.lang.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'normal', minWidth: 260 }}>“{e.question}”</td>
                        <td>
                          <span className={`pill ${o.tone}`}>{o.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
