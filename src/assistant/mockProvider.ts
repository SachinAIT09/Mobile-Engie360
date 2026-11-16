/**
 * Scripted assistant for the demo. No AI backend is connected: questions are matched to intents
 * (nlu.ts + intents.ts, English and Dutch) and answered from the local demo data (answers.ts).
 */
import { answerFor, phrase } from './answers';
import { INTENTS, SUGGESTIONS } from './intents';
import { matchIntent } from './nlu';
import type { AssistantContext, AssistantProvider, AssistantReply, ChatMessage } from './types';

/** Answer one question synchronously (used by the provider and by the specs). */
export function reply(question: string, context: AssistantContext): AssistantReply {
  const m = matchIntent(question, INTENTS, context.lastIntent);
  return answerFor({ intent: m.intent, entities: m.entities, text: question }, context);
}

export class MockAssistantProvider implements AssistantProvider {
  readonly id = 'mock-rules-v2';
  readonly isMock = true;

  async reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply> {
    const last = [...history].reverse().find((m) => m.role === 'user');
    // Simulated thinking time so the typing indicator is visible.
    await new Promise((r) => setTimeout(r, 650 + Math.random() * 650));
    return reply(last?.text ?? '', context);
  }

  suggestions(context: AssistantContext): string[] {
    const ids = context.audience === 'visitor' ? SUGGESTIONS.visitor : (SUGGESTIONS[context.route] ?? SUGGESTIONS.default);
    return (ids ?? []).map((id) => phrase(id, context.lang));
  }
}
