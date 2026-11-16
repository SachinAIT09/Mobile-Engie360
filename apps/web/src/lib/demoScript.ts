import { BRAND, PROGRAM, type Api, type AssistantLogEntry, type Campaign, type DemoState, type FlexEvent, type LiveEvent } from '@engie/shared';
import { campaignLink } from './links';

/**
 * The presenter's script (docs/BUILD_SPEC.md §13) as data, so the demo panel and the presenter bar can
 * drive it: each step has a talk track, what to expect on each screen, an optional one-click action, and
 * an optional rule for marking itself done from live state or socket events.
 */

export type ScriptEvent =
  | { name: 'liveEvent:new'; event: LiveEvent }
  | { name: 'district:statsChanged' }
  | { name: 'campaign:statsChanged'; campaign: Campaign }
  | { name: 'flexEvent:statusChanged'; event: FlexEvent }
  | { name: 'assistant:logged'; entry: AssistantLogEntry }
  | { name: 'demo:reset' };

export interface ScriptActionResult {
  text: string;
  /** Route to open next (e.g. a prefilled Campaign 360 page). */
  link?: string;
}

export interface ScriptStep {
  id: string;
  /** Use-case grouping shown as section headers. */
  phase: 'Setup' | 'Tour' | 'Detect → offer' | 'Campaign 360' | 'Flex event' | 'Assistant' | 'Wrap-up';
  title: string;
  /** What the presenter says (short). */
  talkTrack: string;
  expect: { phone?: string; web?: string };
  /** One-click action; runs through the same API calls as the manual controls. */
  action?: {
    label: string;
    tone?: 'primary' | 'warn' | 'secondary';
    run: (ctx: { api: Api; state: DemoState | null }) => Promise<ScriptActionResult>;
  };
  /** Staff page to be on for this step. */
  link?: string;
  /** Marks the step done from a socket event. */
  advanceOn?: (ev: ScriptEvent) => boolean;
  /** Marks the step done from polled demo state. */
  doneWhen?: (state: DemoState) => boolean;
}

const unenrolled = (s: DemoState | null) => s?.customers.find((c) => c.role === 'UNENROLLED_DEMO') ?? null;
const enrolled = (s: DemoState | null) => s?.customers.find((c) => c.role === 'ENROLLED_DEMO') ?? null;
const N2G = BRAND.partners.disaggregation;
const SLIM = PROGRAM.name.nl;

export const DEMO_SCRIPT: ScriptStep[] = [
  {
    id: 'setup',
    phase: 'Setup',
    title: 'Split screen: staff app left, phone right',
    talkTrack: `${BRAND.utilityName} staff see the portfolio; the customer sees their home in ${BRAND.appName}. Everything in between is ${BRAND.vendorName} on top of ${N2G} appliance recognition.`,
    expect: { web: 'Dashboard open', phone: 'Signed in as the customer without Slim Laden (sanne@demo.test)' },
    link: '/districts',
    doneWhen: (s) => !!unenrolled(s)?.online,
  },
  {
    id: 'tour',
    phase: 'Tour',
    title: 'MijnENGIE basics on the phone',
    talkTrack: 'Home, usage with the dynamic hourly price, invoices and the monthly installment, live power on Slim Energie, and Eva the assistant. NL/EN switch on Account.',
    expect: { phone: 'Live power updates every 5 seconds', web: 'Customer activity shows each screen she opens' },
    link: '/activity',
  },
  {
    id: 'uc1-detect',
    phase: 'Detect → offer',
    title: 'Net2Grid detects an EV at the customer’s home',
    talkTrack: `${N2G} recognises EV charging in the smart-meter data. She is on a dynamic contract but not in ${SLIM}. The app invites her on the spot.`,
    expect: { phone: 'Banner, then the “We zien dat je thuis een auto laadt” sheet', web: 'Live row “New EV detected · ✓ Auto-sent”, not-in-Slim-Laden +1' },
    link: '/districts',
    action: {
      label: 'Simulate EV detected',
      tone: 'primary',
      run: async ({ api, state }) => {
        const c = unenrolled(state);
        if (!c) throw new Error('No demo customer without Slim Laden. Reset the demo first.');
        const e = await api.simEvDetected(c.customerId);
        return { text: `${e.headline} ${e.summary}` };
      },
    },
    advanceOn: (ev) => ev.name === 'liveEvent:new' && ev.event.kind === 'EV_DETECTED',
  },
  {
    id: 'uc1-enroll',
    phase: 'Detect → offer',
    title: 'Join Slim Laden from the phone',
    talkTrack: 'She reads how it works, gives consent and joins. The counts on the left move the moment she taps.',
    expect: { phone: `Confirmation, Home card “${SLIM} actief”`, web: 'In Slim Laden +1, not in Slim Laden −1 without refresh' },
    link: '/districts',
    doneWhen: (s) => unenrolled(s)?.evStatus === 'ENROLLED',
  },
  {
    id: 'uc2-reset',
    phase: 'Campaign 360',
    title: 'Reset to the starting state',
    talkTrack: 'Back to square one; the phone stays signed in.',
    expect: { web: 'Counts back to 1,726 / 1,770', phone: 'Home, no EV card' },
    action: {
      label: 'Reset demo (keep phone signed in)',
      tone: 'secondary',
      run: async ({ api }) => {
        await api.demoReset({ keepSessions: true });
        return { text: 'Demo reset to the starting state.' };
      },
    },
    advanceOn: (ev) => ev.name === 'demo:reset',
  },
  {
    id: 'uc2-cluster',
    phase: 'Campaign 360',
    title: '212 EVs charging at the evening peak in Utrecht-Oost',
    talkTrack: `${N2G} sees a cluster of EVs charging when power is most expensive. 96 of them are not in ${SLIM}.`,
    expect: { web: 'Live row with “Target 96 with Slim Laden offer”' },
    link: '/districts',
    action: {
      label: 'Simulate evening-peak cluster',
      tone: 'primary',
      run: async ({ api }) => {
        const e = await api.simCluster('UT-OOST');
        return { text: `${e.headline} ${e.summary}`, link: e.suggested ? campaignLink(e.suggested.campaignType, e.suggested.audience) : undefined };
      },
    },
    advanceOn: (ev) => ev.name === 'liveEvent:new' && ev.event.kind === 'EV_CLUSTER',
  },
  {
    id: 'uc2-send',
    phase: 'Campaign 360',
    title: 'Send the Slim Laden offer with Campaign 360',
    talkTrack: 'Audience, Dutch copy with merge fields, channels, send. One click reaches all 96.',
    expect: { web: 'Results panel: Sent 96, Delivered and Opened ticking', phone: `Banner “Laad slimmer en goedkoper met ${SLIM}”` },
    advanceOn: (ev) => ev.name === 'liveEvent:new' && ev.event.kind === 'CAMPAIGN_SENT',
  },
  {
    id: 'uc2-enroll',
    phase: 'Campaign 360',
    title: 'Open the offer and join on the phone',
    talkTrack: 'Opened +1 the moment it is read; Enrolled +1 when she joins.',
    expect: { phone: 'Offer → Aanmelden → confirmation', web: 'Opened +1, Enrolled +1' },
    doneWhen: (s) => unenrolled(s)?.evStatus === 'ENROLLED',
  },
  {
    id: 'uc2-installment',
    phase: 'Campaign 360',
    title: 'Second segment: installment below the advice',
    talkTrack: 'Same tool, different segment. Customers whose monthly installment no longer covers their usage get advice before the annual statement surprises them.',
    expect: { web: 'Dashboard → a district → “Installment advice to N”', phone: 'Message “Je termijnbedrag past niet meer bij je verbruik” → adjust in two taps' },
    link: '/campaigns/new?type=INSTALLMENT_ADVICE&district=3581&segment=INSTALLMENT_GAP',
    advanceOn: (ev) => ev.name === 'campaign:statsChanged' && ev.campaign.type === 'INSTALLMENT_ADVICE' && ev.campaign.stats.acted > 0,
  },
  {
    id: 'uc3-switch',
    phase: 'Flex event',
    title: 'Switch the phone to the Slim Laden customer',
    talkTrack: 'Now a customer who is already in Slim Laden, in a neighbourhood where the grid is about to run hot.',
    expect: { phone: 'Signed in as daan@demo.test (Account → Switch account)' },
    doneWhen: (s) => !!enrolled(s)?.online,
  },
  {
    id: 'uc3-forecast',
    phase: 'Flex event',
    title: 'Stedin forecasts congestion in 3581 Oudwijk',
    talkTrack: 'The grid operator expects 92% of capacity between 17:00 and 20:00. Slim Laden EVs are the flexible load.',
    expect: { web: 'Live row with “Send flex request”' },
    link: '/districts',
    action: {
      label: 'Simulate congestion forecast for 3581',
      tone: 'warn',
      run: async ({ api }) => {
        const e = await api.simForecast('3581');
        return { text: `${e.headline} ${e.summary}`, link: e.suggested ? campaignLink(e.suggested.campaignType, e.suggested.audience) : undefined };
      },
    },
    advanceOn: (ev) => ev.name === 'liveEvent:new' && ev.event.kind === 'CONGESTION_FORECAST',
  },
  {
    id: 'uc3-send',
    phase: 'Flex event',
    title: 'Send the flex request',
    talkTrack: 'Shift charging out of 17:00–20:00 and earn a credit. Expires when the window ends.',
    expect: { phone: 'Banner “Wil je vandaag 17:00–20:00 later laden?”, request screen with countdown', web: 'Flex event scheduled' },
    doneWhen: (s) => s.activeFlexEvent !== null,
  },
  {
    id: 'uc3-respond',
    phase: 'Flex event',
    title: 'Customer answers “Ja, ik verschuif het laden”',
    talkTrack: 'Responses land live. Shifted charging is what the grid operator cares about.',
    expect: { phone: 'Confirmation', web: 'Responded +1, Shifted +1' },
    advanceOn: (ev) => ev.name === 'campaign:statsChanged' && ev.campaign.type === 'FLEX_REQUEST' && ev.campaign.stats.paused > 0,
  },
  {
    id: 'uc3-start',
    phase: 'Flex event',
    title: 'Start the event now',
    talkTrack: 'During the event the car draws 0 kW; live power on the phone shows it.',
    expect: { phone: 'Slim Energie: auto laden 0,0 kW' },
    action: {
      label: 'Start event now',
      tone: 'warn',
      run: async ({ api, state }) => {
        const ev = state?.activeFlexEvent;
        if (!ev) throw new Error('No flex event yet. Send a flex request first.');
        return { text: `Event ${(await api.flexStart(ev.id)).status.toLowerCase()}.` };
      },
    },
    advanceOn: (ev) => ev.name === 'flexEvent:statusChanged' && ev.event.status === 'ACTIVE',
  },
  {
    id: 'uc3-end',
    phase: 'Flex event',
    title: 'End the event and show results',
    talkTrack: 'Per-home results on the phone; peak reduced in MW for the grid operator.',
    expect: { phone: 'Result: credit earned, energy shifted, peak reduced', web: 'Peak reduced (MW) in the results panel' },
    action: {
      label: 'End event now',
      tone: 'secondary',
      run: async ({ api, state }) => {
        const ev = state?.activeFlexEvent;
        if (!ev) throw new Error('No flex event to end.');
        return { text: `Event ${(await api.flexEnd(ev.id)).status.toLowerCase()}. Results are on the phone.` };
      },
    },
    advanceOn: (ev) => ev.name === 'flexEvent:statusChanged' && ev.event.status === 'ENDED',
  },
  {
    id: 'uc4-assistant',
    phase: 'Assistant',
    title: 'Ask Eva on the phone, watch it land in Assistant insights',
    talkTrack: 'Ask “Waarom is mijn energierekening hoger?” on the phone. Staff see the question, the topic and whether Eva answered it herself, live.',
    expect: { phone: 'Eva answers from the customer’s own usage', web: 'Assistant insights: question appears, self-service rate updates' },
    link: '/assistant-insights',
    advanceOn: (ev) => ev.name === 'assistant:logged',
  },
  {
    id: 'wrap',
    phase: 'Wrap-up',
    title: 'Where Campaign 360 goes next',
    talkTrack: 'Districts where most EVs charge outside Slim Laden. Each row is a campaign waiting to happen.',
    expect: { web: 'Most EVs outside Slim Laden table, Target buttons' },
    link: '/districts',
  },
];

export const SCRIPT_STORAGE_KEY = 'engie360.script';

export function nextStepIndex(done: Record<string, boolean>): number {
  const i = DEMO_SCRIPT.findIndex((s) => !done[s.id]);
  return i === -1 ? DEMO_SCRIPT.length : i;
}
