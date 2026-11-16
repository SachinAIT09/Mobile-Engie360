import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { activityLabel, type CustomerActivity } from '@engie/shared';
import { CATEGORY_ICON, TOAST_MS, useActivity } from '../lib/activity';
import { Icon } from './icons';
import './activity.css';

function Toast({ a, onDismiss }: { a: CustomerActivity; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = window.setTimeout(() => onDismiss(a.id), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [a.id, onDismiss]);
  return (
    <div className={`act-toast cat-${a.category}`}>
      <span className="act-ico" aria-hidden="true">
        <Icon name={CATEGORY_ICON[a.category]} size={16} />
      </span>
      <Link to={`/customers/${a.customerId}`} className="act-body" onClick={() => onDismiss(a.id)}>
        <span className="act-title">
          <strong>{a.customerName}</strong> · {activityLabel(a.kind)}
        </span>
        <span className="act-sum">{a.summary}</span>
      </Link>
      <button type="button" className="iconbtn sm" aria-label="Dismiss notification" onClick={() => onDismiss(a.id)}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

/** Pop-ups for new customer activity, top right under the top bar; each fades after a few seconds. */
export function Toasts() {
  const { toasts, dismissToast } = useActivity();
  return (
    <div className="act-toasts" aria-live="polite" aria-label="Customer activity notifications">
      {toasts.map((a) => (
        <Toast key={a.id} a={a} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
