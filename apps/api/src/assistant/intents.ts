import type { IntentDef } from './nlu.js';

export type StaffIntent =
  | 'DISTRICT_STATUS'
  | 'BLIND_SPOTS'
  | 'OVERVIEW'
  | 'CAMPAIGN_PERFORMANCE'
  | 'DR_PERFORMANCE'
  | 'ENROLLMENT_TREND'
  | 'GRID_RISK'
  | 'DRAFT_CAMPAIGN'
  | 'FLEX_LOAD';

/**
 * Staff intents. Weights: a distinctive topic word ≈ 2–3, a supporting word ≈ 1–1.5; threshold 2.
 * Postcode districts boost DISTRICT_STATUS (and DRAFT_CAMPAIGN a little) so "3581?" alone still answers.
 */
export const STAFF_INTENTS: readonly IntentDef<StaffIntent>[] = [
  {
    id: 'DISTRICT_STATUS',
    suggestion: 'How is 3581 doing?',
    priority: 5,
    districtBoost: 2.5,
    groups: [
      { words: ['how is', 'how are', 'doing', 'status', 'health', 'looking', 'tell me about', 'details', 'detail', 'stats for', 'numbers for', 'whats up with', 'what is up with'], weight: 1 },
      { words: ['district', 'postcode', 'neighbourhood', 'area'], weight: 1 },
    ],
    negative: ['draft', 'write', 'compose'],
  },
  {
    id: 'BLIND_SPOTS',
    suggestion: 'Where are the most EVs not in Slim Laden?',
    priority: 6,
    groups: [
      { words: ['blind spot', 'blindspot', 'blind', 'invisible', 'hidden', 'unseen', 'not enrolled', 'unenrolled', 'not in slim laden', 'gap', 'gaps', 'untapped', 'opportunit', 'target next', 'should we target', 'who to target'], weight: 2.5 },
      { words: ['worst', 'biggest', 'top', 'where', 'which districts', 'rank', 'most'], weight: 1 },
    ],
    negative: ['draft', 'write', 'compose', 'trend'],
  },
  {
    id: 'OVERVIEW',
    suggestion: 'Give me the portfolio overview',
    priority: 3,
    groups: [
      { words: ['overview', 'headline', 'big picture', 'overall', 'network', 'portfolio', 'across', 'everything', 'summary', 'summarise', 'summarize', 'totals', 'territory', 'whole'], weight: 2 },
      { words: ['how many evs', 'how many ev', 'total evs', 'all evs', 'evs do we', 'evs are there'], weight: 2 },
      { words: ['evs', 'grid areas', 'customers'], weight: 0.5 },
    ],
  },
  {
    id: 'CAMPAIGN_PERFORMANCE',
    suggestion: 'How did the last campaign perform?',
    priority: 6,
    groups: [
      { words: ['campaign', 'campaigns', 'offer', 'outreach', 'message', 'a/b', 'ab test', 'variant'], weight: 2 },
      { words: ['perform', 'result', 'results', 'how did', 'how is', 'how are', 'convert', 'conversion', 'open rate', 'opened', 'response rate', 'winner', 'winning', 'last', 'latest', 'working', 'land'], weight: 1.5 },
    ],
    negative: ['draft', 'write', 'compose', 'create a', 'new campaign', 'prepare'],
  },
  {
    id: 'DR_PERFORMANCE',
    suggestion: 'How did our flex events perform?',
    priority: 5,
    groups: [
      { words: ['flex event', 'flex events', 'flex moment', 'demand response', 'grid event', 'grid events', 'event', 'events', 'curtail', 'flex program'], weight: 2 },
      { words: ['perform', 'result', 'results', 'how did', 'shift', 'shifted', 'paused', 'reduc', 'mw', 'kwh', 'saved', 'cut', 'delivered', 'went'], weight: 1.5 },
    ],
    negative: ['draft', 'write', 'compose', 'tonight', 'risk'],
  },
  {
    id: 'ENROLLMENT_TREND',
    suggestion: 'How are Slim Laden sign-ups trending?',
    priority: 5,
    groups: [
      { words: ['enroll', 'sign up', 'signup', 'sign ups', 'signups', 'joined', 'joining', 'join', 'recruit'], weight: 2 },
      { words: ['trend', 'trending', 'per day', 'daily', 'over time', 'growth', 'growing', 'pace', 'how many', 'last 30', 'this week', 'this month', 'today', 'lately', 'recent'], weight: 1.5 },
    ],
    negative: ['draft', 'write', 'compose', 'offer for', 'blind'],
  },
  {
    id: 'GRID_RISK',
    suggestion: 'Which districts are at risk tonight?',
    priority: 6,
    groups: [
      { words: ['risk', 'at risk', 'overload', 'forecast', 'capacity', 'stress', 'constrain', 'hot spot', 'hotspot', 'congest', 'peak load', 'overloaded', 'danger'], weight: 2.5 },
      { words: ['tonight', 'today', 'peak', 'load', 'evening', 'this afternoon'], weight: 1 },
    ],
    negative: ['draft', 'write', 'compose'],
  },
  {
    id: 'DRAFT_CAMPAIGN',
    suggestion: 'Draft a Slim Laden offer for 1401',
    priority: 8,
    districtBoost: 0.5,
    groups: [
      { words: ['draft', 'write', 'compose', 'create', 'prepare', 'suggest copy', 'come up with', 'make', 'build'], weight: 2.5 },
      { words: ['offer', 'campaign', 'message', 'copy', 'text', 'push', 'notification', 'request', 'stop charging', 'enroll', 'outreach', 'email', 'sms'], weight: 1.5 },
    ],
  },
  {
    id: 'FLEX_LOAD',
    suggestion: 'How much flexible load do we have?',
    priority: 5,
    groups: [
      { words: ['flexib', 'flex', 'shiftable', 'controllable', 'dispatchable', 'smart charging', 'smart charg', 'curtailable', 'pausable', 'headroom'], weight: 2.5 },
      { words: ['load', 'mw', 'kw', 'capacity', 'how much', 'available'], weight: 1 },
    ],
    negative: ['draft', 'write', 'compose'],
  },
];

export const STAFF_SUGGESTIONS = STAFF_INTENTS.map((d) => d.suggestion);
