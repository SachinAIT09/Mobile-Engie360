import type { AssistantRequest, ChatChannel } from '../../shared/contract';
import { MockAssistantProvider } from '../assistant/mockProvider';
import type { AssistantContext, AssistantProvider, AssistantReply, ChatMessage } from '../assistant/types';
import { API, post } from './client';

/** One id per browser tab and channel, so staff see a conversation as one thread. */
function conversationId(channel: ChatChannel): string {
  const key = `engie-demo-conversation-${channel}`;
  const fresh = () => `${channel}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const id = fresh();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return fresh();
  }
}

/** Shortest time the typing indicator shows, so a fast server still reads as "Eva is typing". */
const MIN_THINKING_MS = 450;

/**
 * Eva over HTTP: the server runs the same scripted answers and logs the conversation for the staff
 * view. If the server is not reachable the local scripted provider answers, so the chat never breaks.
 */
export class HttpAssistantProvider implements AssistantProvider {
  readonly id = 'engie360-server';
  readonly isMock = true;
  private readonly local = new MockAssistantProvider();

  constructor(private readonly channel: ChatChannel) {}

  async reply(history: ChatMessage[], context: AssistantContext): Promise<AssistantReply> {
    const question = [...history].reverse().find((m) => m.role === 'user')?.text ?? '';
    const body: AssistantRequest = { question, context, conversationId: conversationId(this.channel), channel: this.channel };
    try {
      const [reply] = await Promise.all([post<AssistantReply>(API.assistant, body), new Promise((r) => setTimeout(r, MIN_THINKING_MS))]);
      return reply;
    } catch {
      return this.local.reply(history, context);
    }
  }

  suggestions(context: AssistantContext): string[] {
    return this.local.suggestions(context);
  }
}
