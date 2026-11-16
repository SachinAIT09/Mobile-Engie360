import { PROGRAM, type CampaignAudience, type CampaignDraft, type CampaignDraftCopy, type CampaignType } from '@engie/shared';
import { MERGE_FIELDS } from '../campaigns/merge.js';

/** Limits enforced by the campaign create DTO. */
export const COPY_LIMITS = { title: 140, body: 1000, cta: 40 } as const;

export interface DraftInput {
  /** One district, or several for a multi-district audience (2–10). */
  districtCodes: string[];
  /** Enrolled EVs on the (first) district: drives the social-proof wording. */
  knownOnDistrict: number;
  /** Detected but unenrolled EVs across the districts. */
  unenrolled: number;
}

/** Enough neighbours enrolled to quote the number; below it the copy speaks of neighbours in general. */
const SOCIAL_PROOF_MIN = 5;

/**
 * Two variants per campaign type: A leans on social proof, B on the reward and urgency. Written in Dutch,
 * the customers' language. Copy uses only the campaign merge fields and PROGRAM placeholders, so
 * Campaign 360 personalises it per recipient exactly like hand-written copy.
 */
export function draftCopy(type: CampaignType, input: DraftInput): [CampaignDraftCopy, CampaignDraftCopy] {
  const proof = input.knownOnDistrict >= SOCIAL_PROOF_MIN;
  const program = PROGRAM.name.nl;
  if (type === 'ENROLL_OFFER') {
    return [
      {
        title: proof ? `{first_name}, {neighbours_enrolled} buren laden al slim met ${program}` : `{first_name}, steeds meer buren laden slim met ${program}`,
        body: proof
          ? `{neighbours_enrolled} buren met een elektrische auto laden automatisch op de goedkoopste uren. Meld je aan voor ${program} en ontvang {incentive}. Je auto is 's ochtends gewoon vol en je kunt elk flexmoment overslaan.`
          : `Je buren verschuiven het laden van hun auto naar de goedkoopste uren. Meld je aan voor ${program}, ontvang {incentive} en sla elk flexmoment over wanneer je wilt. Je auto is 's ochtends gewoon vol.`,
        cta: 'Bekijk hoe het werkt',
      },
      {
        title: 'Ontvang {incentive} en laad voortaan op de goedkoopste uren',
        body: `{first_name}, meld je aan voor ${program} en ontvang {incentive}, plus ${PROGRAM.perEventIncentive.nl} voor elk flexmoment waaraan je meedoet. Aanmelden duurt twee minuten en je kunt altijd stoppen.`,
        cta: 'Aanmelden',
      },
    ];
  }
  if (type === 'INSTALLMENT_ADVICE') {
    return [
      {
        title: '{first_name}, voorkom bijbetalen bij je jaarnota',
        body: 'Je betaalt nu {installment} per maand, maar op basis van je verbruik adviseren we {advised_installment}. Pas je termijnbedrag in een paar tikken aan en spreid de kosten over het jaar.',
        cta: 'Termijnbedrag aanpassen',
      },
      {
        title: 'Je termijnbedrag past niet meer bij je verbruik',
        body: 'Hoi {first_name}, je verbruik is hoger dan waar je termijnbedrag van {installment} op is gebaseerd. Met {advised_installment} per maand kom je bij de jaarnota niet voor verrassingen te staan.',
        cta: 'Bekijk advies',
      },
    ];
  }
  return [
    {
      title: proof ? `{first_name}, {neighbours_enrolled} buren laden vandaag later dan {event_window}` : `{first_name}, help het stroomnet in je buurt: laad later dan {event_window}`,
      body: proof
        ? `Het stroomnet in je buurt is druk tussen {event_window}. {neighbours_enrolled} buren met ${program} verschuiven het laden. Doe mee en ontvang {incentive}; het laden gaat daarna vanzelf verder.`
        : `Het stroomnet in je buurt is druk tussen {event_window}. Verschuif het laden van je auto een paar uur en ontvang {incentive}. Het laden gaat daarna vanzelf verder.`,
      cta: 'Laden verschuiven',
    },
    {
      title: 'Ontvang {incentive}: laad vandaag buiten {event_window}',
      body: `{first_name}, verschuif het laden van je auto buiten {event_window} en ontvang {incentive} van ${program}. Eén tik is genoeg, en je auto is morgenochtend gewoon vol.`,
      cta: 'Doe mee',
    },
  ];
}

export function draftAudience(type: CampaignType, districtCodes: string[]): CampaignAudience {
  const segment = type === 'ENROLL_OFFER' ? 'UNENROLLED_EV' : type === 'INSTALLMENT_ADVICE' ? 'INSTALLMENT_GAP' : 'ENROLLED_EV';
  return districtCodes.length > 1 ? { kind: 'DISTRICTS', districtCodes: districtCodes.slice(0, 10), segment } : { kind: 'DISTRICT', districtCode: districtCodes[0], segment };
}

export function buildDraft(type: CampaignType, input: DraftInput): CampaignDraft {
  return { type, audience: draftAudience(type, input.districtCodes), variants: draftCopy(type, input) };
}

/** Merge fields used in `text` that Campaign 360 does not know (should always be empty). */
export function unknownMergeFields(text: string): string[] {
  const known = new Set<string>(MERGE_FIELDS);
  return [...text.matchAll(/\{[a-z_]+\}/g)].map((m) => m[0]).filter((f) => !known.has(f));
}

/** Problems with one copy variant (length limits, unknown merge fields); empty when valid. */
export function validateCopy(c: CampaignDraftCopy): string[] {
  const out: string[] = [];
  if (c.title.length > COPY_LIMITS.title) out.push(`title longer than ${COPY_LIMITS.title}`);
  if (c.body.length > COPY_LIMITS.body) out.push(`body longer than ${COPY_LIMITS.body}`);
  if (c.cta.length > COPY_LIMITS.cta) out.push(`cta longer than ${COPY_LIMITS.cta}`);
  for (const f of unknownMergeFields(`${c.title} ${c.body} ${c.cta}`)) out.push(`unknown merge field ${f}`);
  return out;
}
