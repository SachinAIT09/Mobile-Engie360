import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACTIVITY_CATEGORIES,
  activityLabel,
  fmtDate,
  fmtTime,
  type CustomerActivity,
  type CustomerActivityCategory,
} from '@engie/shared';
import { useLoad, useSocketEvent } from '../lib/client';
import { CATEGORY_ICON, CATEGORY_TONE, prependActivity } from '../lib/activity';
import { timeAgo } from '../lib/reports';
import { CardHeader } from '../components/CardHeader';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorNotice, LoadingBlock } from '../components/State';
import { Icon } from '../components/icons';
import '../components/activity.css';

const LIMIT = 200;

/** /activity: everything customers do in the mobile app, newest first, live via activity:new. */
export function ActivityPage() {
  const { data, error, loading, reload, setData } = useLoad((a) => a.activity({ limit: LIMIT }));
  const [category, setCategory] = useState<CustomerActivityCategory | ''>('');
  const [customerId, setCustomerId] = useState('');

  useSocketEvent('activity:new', (a) => setData((prev) => prependActivity(prev, a, LIMIT)));
  useSocketEvent('demo:reset', () => void reload());

  const all = data ?? [];
  const customers = [...new Map(all.map((a) => [a.customerId, a.customerName])).entries()].sort((x, y) => x[1].localeCompare(y[1]));
  const rows = all.filter((a) => (!category || a.category === category) && (!customerId || a.customerId === customerId));

  return (
    <main className="page">
      <PageHeader
        title="Customer activity"
        icon="phone"
        sub="Everything customers do in the mobile app (sign-ins, installment changes, Slim Laden sign-ups, flex responses, charging changes, assistant questions and screen views) as it happens."
      />
      {error && <ErrorNotice message={error} onRetry={() => void reload()} />}
      <section className="card pad stack gap12">
        <CardHeader
          icon="history"
          title="Live feed"
          sub={data ? `${rows.length} of the latest ${all.length} entries · ${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}` : undefined}
          actions={
            <label className="field" style={{ minWidth: 200 }}>
              <span className="lbl">CUSTOMER</span>
              <select className="fld" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">All customers</option>
                {customers.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <div className="pilltabs" role="group" aria-label="Category">
          <button type="button" className={category === '' ? 'on' : ''} aria-pressed={category === ''} onClick={() => setCategory('')}>
            All
          </button>
          {ACTIVITY_CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={category === c.id ? 'on' : ''} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {loading && !data && <LoadingBlock rows={5} rowHeight={44} label="Loading customer activity" />}
        {data && rows.length === 0 && (
          <EmptyState
            title={category || customerId ? 'Nothing matches these filters' : 'No app activity yet'}
            body={category || customerId ? undefined : 'Sign in on the phone and change the installment or open a message; it appears here instantly.'}
          />
        )}
        {rows.length > 0 && (
          <div className="tablebox">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Action</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <ActivityTableRow key={a.id} a={a} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ActivityTableRow({ a }: { a: CustomerActivity }) {
  return (
    <tr>
      <td title={`${fmtDate(a.at)} ${fmtTime(a.at)}`}>
        {fmtDate(a.at, { month: 'short', day: 'numeric' })} · {fmtTime(a.at)}
        <span className="small muted" style={{ display: 'block' }}>
          {timeAgo(a.at)}
        </span>
      </td>
      <td>
        <Link to={`/customers/${a.customerId}`} style={{ fontWeight: 600 }}>
          {a.customerName}
        </Link>
        <span className="small muted" style={{ display: 'block' }}>
          {a.districtCode ?? ''}
        </span>
      </td>
      <td>
        <span className={`row center gap8 cat-${a.category}`}>
          <span className="act-ico" aria-hidden="true">
            <Icon name={CATEGORY_ICON[a.category]} size={16} />
          </span>
          <span className={`pill ${CATEGORY_TONE[a.category]}`}>{activityLabel(a.kind)}</span>
        </span>
      </td>
      <td style={{ whiteSpace: 'normal', minWidth: 260 }}>{a.summary}</td>
    </tr>
  );
}
