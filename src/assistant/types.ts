import type { Lang } from '../lib/i18n';

export type Role = 'user' | 'assistant';

export interface Fact {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}

export interface ChatAction {
  label: string;
  /** Navigate inside the portal. */
  to?: string;
  /** Send this text as the next user message. */
  prompt?: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  facts?: Fact[];
  chart?: 'monthly' | 'breakdown';
  /** Staff assistant: a drafted message, shown as a card with a hand-off to the composer. */
  draft?: { templateId: string; title: string; body: string; /** Where "Open in the composer" goes. */ to?: string };
  /** Staff assistant: a small bar chart with its own data. */
  bars?: { caption: string; points: { label: string; value: number; hi?: boolean }[] };
  actions?: ChatAction[];
  /** Matched intent (assistant messages); echoed back as `lastIntent` for follow-ups. */
  intent?: string;
  /** Suggested next questions for this answer. */
  followUps?: string[];
  ts: number;
}

export interface AssistantContext {
  lang: Lang;
  /** Current portal route, used for contextual answers and suggestions. */
  route: string;
  /** Intent of the previous answer, so "and last month?" continues the same topic. */
  lastIntent?: string;
}

export type AssistantReply = Omit<ChatMessage, 'id' | 'role' | 'ts'>;

/**
 * Anything that can answer the customer. The prototype ships `MockAssistantProvider`
 * (rule-based, local data). A real LLM provider implements the same interface,
 * e.g. by POSTing `history` + `context` to a backend that calls the model with tools
 * for usage, billing and contract data.
 */
export interface AssistantProvider {
  readonly id: string;
  readonly isMock: boolean;
  reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply>;
  suggestions(context: AssistantContext): string[];
}
