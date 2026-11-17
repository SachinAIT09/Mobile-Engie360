import { lazy, Suspense } from 'react';
import App from './App';
import { retrying } from './lib/retrying';

const StaffApp = lazy(retrying(() => import('./staff/StaffApp')));

/** Two apps, one bundle: the staff app at /staff, the customer portal (with presenter bar and Eva) everywhere else. */
export default function Root({ staff }: { staff: boolean }) {
  if (!staff) return <App />;
  return (
    <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
      <StaffApp />
    </Suspense>
  );
}
