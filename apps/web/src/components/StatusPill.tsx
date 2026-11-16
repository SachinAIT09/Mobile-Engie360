import type { CampaignType, FlexEventStatus } from '@engie/shared';

type PillTone = 'ok' | 'warn' | 'ev' | 'accent' | 'grey' | 'danger';

const DR_STATUS: Record<FlexEventStatus, { tone: PillTone; label: string }> = {
  SCHEDULED: { tone: 'grey', label: 'Scheduled' },
  ACTIVE: { tone: 'warn', label: 'Active' },
  ENDED: { tone: 'ok', label: 'Ended' },
};

const CAMPAIGN_TYPE: Record<CampaignType, { tone: PillTone; label: string }> = {
  ENROLL_OFFER: { tone: 'ev', label: 'Slim Laden offer' },
  FLEX_REQUEST: { tone: 'warn', label: 'Flex request' },
  INSTALLMENT_ADVICE: { tone: 'accent', label: 'Installment advice' },
};

export type StatusPillProps =
  | { kind: 'drStatus'; value: FlexEventStatus | null; className?: string }
  | { kind: 'campaignType'; value: CampaignType; className?: string }
  | { kind: 'test'; className?: string };

/** `.pill` with the tone that the rest of the staff app uses for flex statuses and campaign types. */
export function StatusPill(props: StatusPillProps) {
  let tone: PillTone = 'grey';
  let label: string;
  if (props.kind === 'drStatus') {
    if (props.value) ({ tone, label } = DR_STATUS[props.value]);
    else label = 'Unknown';
  } else if (props.kind === 'campaignType') {
    ({ tone, label } = CAMPAIGN_TYPE[props.value]);
  } else {
    label = 'Test';
  }
  return <span className={`pill ${tone} ${props.className ?? ''}`.trim()}>{label}</span>;
}

