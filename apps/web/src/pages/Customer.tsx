import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ACTIVITY_CATEGORIES, fmtTime, type CustomerActivityCategory, type EvStatus } from '@engie/shared';
import { useLoad, useSocketEvent } from '../lib/client';
import { groupByDay, prependActivity } from '../lib/activity';
import { initials } from '../lib/reports';
import { ActivityRow } from '../components/ActivityFeed';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorNotice, LoadingBlock } from '../components/State';
import '../components/activity.css';

const EV_STATUS: Record<EvStatus, { tone: 'ok' | 'ev' | 'grey'; label: string }> = {
  NONE: { tone: 'grey', label: 'No EV detected' },
  DETECTED_NOT_ENROLLED: { tone: 'ev', label: 'EV · not enrolled' },
  ENROLLED: { tone: 'ok', label: 'Enrolled' },
};

/** /customers/:id: one customer's app activity as a timeline, live. */
export function CustomerPage() {
  const { id = '' } = useParams();
  const { data, error, loading, reload, setData } = useLoad((a) => a.customerActivity(id), [id]);
  const [category, setCategory] = useState<CustomerActivityCategory | ''>('');
  const [fresh, setFresh] = useState<string | null>(null);

  useSocketEvent('activity:new', (a) => {
    if (a.customerId !== id) return;
    setData((prev) => (prev ? { ...prev, activity: prependActivity(prev.activity, a, 200) } : prev));
    setFresh(a.id);
  });
  // Online status and EV status can change with any of these.
  useSocketEvent('district:statsChanged', () => void reload());
  useSocketEvent('demo:reset', () => void reload());

  const c = data?.customer;
  const rows = (data?.activity ?? []).filter((a) => !category || a.category === category);
  const counts = new Map<CustomerActivityCategory, number>();
  for (const a of data?.activity ?? []) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const last = data?.activity[0];

  return (
    <main className="page">
      <PageHeader
        title={c ? c.name : 'Customer'}
        icon="users"
        sub={
          <>
            App activity, live. <Link to="/activity">All customer activity</Link>
          </>
        }
      />
      {error && <ErrorNotice message={error} onRetry={() => void reload()} />}
      {loading && !data && <LoadingBlock rows={6} rowHeight={44} label="Loading customer" />}
      {c && (
        <section className="card pad stack gap12">
          <div className="act-cust-head">
            <span className="avatar" aria-hidden="true">
              {initials(c.name)}
            </span>
            <div className="stack" style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ color: 'var(--navy)', fontSize: 18 }}>{c.name}</strong>
              <div className="act-cust-meta">
                <span>{c.email}</span>
                {c.districtCode && <span>District {c.districtCode}</span>}
                <span className="row center gap8">
                  <span className={`dot ${c.online ? 'on' : 'off'}`} aria-hidden="true" />
                  {c.online ? 'App open now' : 'App offline'}
                </span>
                {last && <span>Last action {fmtTime(last.at)}</span>}
              </div>
            </div>
            <span className={`pill ${EV_STATUS[c.evStatus].tone}`}>{EV_STATUS[c.evStatus].label}</span>
          </div>
        </section>
      )}
      {data && (
        <section className="card pad stack gap12">
          <div className="pilltabs" role="group" aria-label="Category">
            <button type="button" className={category === '' ? 'on' : ''} aria-pressed={category === ''} onClick={() => setCategory('')}>
              All · {data.activity.length}
            </button>
            {ACTIVITY_CATEGORIES.filter((x) => counts.has(x.id)).map((x) => (
              <button key={x.id} type="button" className={category === x.id ? 'on' : ''} aria-pressed={category === x.id} onClick={() => setCategory(x.id)}>
                {x.label} · {counts.get(x.id)}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No app activity yet" body={`When ${c?.name.split(' ')[0] ?? 'this customer'} uses the app, each step shows up here as it happens.`} />
          ) : (
            groupByDay(rows).map((g) => (
              <div key={g.day}>
                <h2 className="act-day">{g.day}</h2>
                <div className="act-timeline">
                  {g.items.map((a) => (
                    <div key={a.id} className={a.id === fresh ? 'act-fresh' : undefined} style={{ borderRadius: 10 }}>
                      <ActivityRow a={a} showName={false} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}
