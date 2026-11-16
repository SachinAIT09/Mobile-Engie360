import type { CampaignAudience, CampaignDraft, CampaignSegment, CampaignType } from '@engie/shared';

/** Build the /campaigns/new URL that prefills Campaign 360. */
export function campaignLink(type: CampaignType, audience: CampaignAudience): string {
  const q = new URLSearchParams({ type, segment: audience.segment });
  if (audience.kind === 'DISTRICT') q.set('district', audience.districtCode);
  else if (audience.kind === 'DISTRICTS') q.set('districts', audience.districtCodes.join(','));
  else q.set('liveEventId', audience.liveEventId);
  return `/campaigns/new?${q.toString()}`;
}

export function districtCampaignLink(type: CampaignType, districtCode: string, segment: CampaignSegment): string {
  return campaignLink(type, { kind: 'DISTRICT', districtCode, segment });
}

/**
 * Campaign 360 link prefilled with an assistant draft: audience (as campaignLink) plus variant A
 * (title/body/cta) and variant B (titleB/bodyB/ctaB) copy, tagged src=assistant.
 * lib/campaignDraft.ts parseDraftParams reads exactly these parameter names.
 */
export function campaignDraftLink(draft: CampaignDraft): string {
  const q = new URLSearchParams(campaignLink(draft.type, draft.audience).split('?')[1]);
  const [a, b] = draft.variants;
  q.set('title', a.title);
  q.set('body', a.body);
  q.set('cta', a.cta);
  q.set('titleB', b.title);
  q.set('bodyB', b.body);
  q.set('ctaB', b.cta);
  q.set('src', 'assistant');
  return `/campaigns/new?${q.toString()}`;
}
