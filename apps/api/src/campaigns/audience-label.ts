import type { CampaignAudience, CampaignSegment } from '@engie/shared';

export const SEGMENT_LABEL: Record<CampaignSegment, string> = {
  UNENROLLED_EV: 'Detected EVs, not in Slim Laden',
  ENROLLED_EV: 'Slim Laden customers',
  INSTALLMENT_GAP: 'Installment below the advice',
};

/** Smallest gap (€ / month) between advice and installment that puts a customer in the INSTALLMENT_GAP segment. */
export const INSTALLMENT_GAP_MIN = 5;

/** Distinct values, first-occurrence order. */
export function distinctDistricts(codes: readonly string[]): string[] {
  return [...new Set(codes)];
}

/**
 * Human label for an audience, e.g. "3581 · Detected EVs, not in Slim Laden",
 * "3581, 3582 +1 · Slim Laden customers", "UT-OOST new-EV cluster · …".
 */
export function audienceLabel(audience: CampaignAudience, liveEventGridArea?: string): string {
  const seg = SEGMENT_LABEL[audience.segment];
  if (audience.kind === 'DISTRICT') return `${audience.districtCode} · ${seg}`;
  if (audience.kind === 'DISTRICTS') {
    const codes = distinctDistricts(audience.districtCodes);
    const more = codes.length > 2 ? ` +${codes.length - 2}` : '';
    return `${codes.slice(0, 2).join(', ')}${more} · ${seg}`;
  }
  return `${liveEventGridArea ?? 'Live event'} new-EV cluster · ${seg}`;
}
