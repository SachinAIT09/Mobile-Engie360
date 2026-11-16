import { describe, expect, it } from 'vitest';
import type { CampaignDraft } from '@engie/shared';
import { campaignDraftLink, campaignLink, districtCampaignLink } from './links';

describe('campaignLink', () => {
  it('prefills type, segment and district for a district audience', () => {
    const url = campaignLink('ENROLL_OFFER', { kind: 'DISTRICT', districtCode: 'SUB-01-F1', segment: 'UNENROLLED_EV' });
    expect(url).toBe('/campaigns/new?type=ENROLL_OFFER&segment=UNENROLLED_EV&district=SUB-01-F1');
  });

  it('prefills the live event id for a live-event audience', () => {
    const url = campaignLink('FLEX_REQUEST', { kind: 'LIVE_EVENT', liveEventId: '66f1a2b3c4d5e6f7a8b9c0d1', segment: 'ENROLLED_EV' });
    const q = new URL(url, 'http://x').searchParams;
    expect(url.startsWith('/campaigns/new?')).toBe(true);
    expect(q.get('type')).toBe('FLEX_REQUEST');
    expect(q.get('segment')).toBe('ENROLLED_EV');
    expect(q.get('liveEventId')).toBe('66f1a2b3c4d5e6f7a8b9c0d1');
    expect(q.has('district')).toBe(false);
  });

  it('lists every district for a multi-district audience', () => {
    const url = campaignLink('FLEX_REQUEST', { kind: 'DISTRICTS', districtCodes: ['SUB-01-F1', 'SUB-01-F2'], segment: 'ENROLLED_EV' });
    const q = new URL(url, 'http://x').searchParams;
    expect(q.get('districts')).toBe('SUB-01-F1,SUB-01-F2');
    expect(q.has('district')).toBe(false);
    expect(q.has('liveEventId')).toBe(false);
  });

  it('URL-encodes values', () => {
    const url = campaignLink('ENROLL_OFFER', { kind: 'DISTRICT', districtCode: 'A B&C', segment: 'UNENROLLED_EV' });
    expect(new URL(url, 'http://x').searchParams.get('district')).toBe('A B&C');
    expect(url).not.toContain(' ');
  });
});

describe('districtCampaignLink', () => {
  it('is the district-audience shorthand', () => {
    expect(districtCampaignLink('FLEX_REQUEST', 'SUB-01-F2', 'ENROLLED_EV')).toBe(
      campaignLink('FLEX_REQUEST', { kind: 'DISTRICT', districtCode: 'SUB-01-F2', segment: 'ENROLLED_EV' }),
    );
  });
});

describe('campaignDraftLink', () => {
  const draft: CampaignDraft = {
    type: 'ENROLL_OFFER',
    audience: { kind: 'DISTRICT', districtCode: 'SUB-26-F1', segment: 'UNENROLLED_EV' },
    variants: [
      { title: '{first_name}, join & earn {incentive}', body: 'Line one.\nLine two: 100% opt-out?', cta: 'See how it works' },
      { title: 'Earn {incentive} off-peak', body: 'B body', cta: 'Claim my reward' },
    ],
  };

  it('carries type, audience, both variants and src=assistant', () => {
    const url = campaignDraftLink(draft);
    expect(url.startsWith('/campaigns/new?type=ENROLL_OFFER&segment=UNENROLLED_EV&district=SUB-26-F1&')).toBe(true);
    const q = new URL(url, 'http://x').searchParams;
    expect(q.get('title')).toBe(draft.variants[0].title);
    expect(q.get('body')).toBe(draft.variants[0].body);
    expect(q.get('cta')).toBe('See how it works');
    expect(q.get('titleB')).toBe('Earn {incentive} off-peak');
    expect(q.get('bodyB')).toBe('B body');
    expect(q.get('ctaB')).toBe('Claim my reward');
    expect(q.get('src')).toBe('assistant');
    expect(url).not.toMatch(/[ \n{}]/);
  });

  it('lists every district for a multi-district draft', () => {
    const url = campaignDraftLink({ ...draft, type: 'FLEX_REQUEST', audience: { kind: 'DISTRICTS', districtCodes: ['SUB-26-F1', 'SUB-15-F3'], segment: 'ENROLLED_EV' } });
    const q = new URL(url, 'http://x').searchParams;
    expect(q.get('type')).toBe('FLEX_REQUEST');
    expect(q.get('districts')).toBe('SUB-26-F1,SUB-15-F3');
    expect(q.has('district')).toBe(false);
    expect(q.get('segment')).toBe('ENROLLED_EV');
  });
});
