import type { AuditAction } from '@engie/shared';
import type { Db } from '../db/db.service.js';
import { DEMO_EMAILS, DEMO_IDS } from './seed.service.js';

const DAY = 86400000;

/** Historical entries by a second staff member, so the audit log always shows two identities after a reset. */
const HISTORY: { daysAgo: number; hour: number; action: AuditAction; label: string; summary: string }[] = [
  {
    daysAgo: 3,
    hour: 10.25,
    action: 'CAMPAIGN_SENT',
    label: 'Laad slimmer en goedkoper met Slim Laden',
    summary: 'Slim Laden offer sent to 142 customers · 1072 De Pijp · Detected EVs, not in Slim Laden',
  },
  {
    daysAgo: 2,
    hour: 15.5,
    action: 'CAMPAIGN_CANCELLED',
    label: 'Wil je vanavond later laden?',
    summary: 'Cancelled before sending (Stedin forecast for 3583 Abstede dropped below 90%)',
  },
  {
    daysAgo: 1,
    hour: 16.75,
    action: 'CAMPAIGN_SENT',
    label: 'Je termijnbedrag past niet meer bij je verbruik',
    summary: 'Installment advice sent to 211 customers · 3582, 3583 · Installment below the advice',
  },
]

/** Seeds the audit log at the end of a seed/reset: three entries by Lotte Visser, 1–3 days ago. */
export async function seedAudit(db: Db): Promise<void> {
  const now = Date.now();
  const actor = { userId: String(DEMO_IDS.staffUser2), name: 'Lotte Visser', email: DEMO_EMAILS.staff2, kind: 'STAFF' as const };
  await db.audit.insertMany(
    HISTORY.map((h) => {
      // Roughly `daysAgo` days back, spread by `hour` so the entries do not line up; always in the past.
      const at = new Date(now - h.daysAgo * DAY + Math.round((h.hour - 12) * 3600000));
      return { at, actor, action: h.action, target: { kind: 'campaign' as const, id: null, label: h.label }, summary: h.summary };
    }),
  );
}
