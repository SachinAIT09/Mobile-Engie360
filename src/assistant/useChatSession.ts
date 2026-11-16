import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AssistantContext, AssistantProvider, ChatMessage } from './types';

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface ChatSession {
  messages: ChatMessage[];
  typing: boolean;
  send: (text: string) => void;
  reset: () => void;
  suggestions: string[];
  provider: AssistantProvider;
}

/** Session-scoped chat state over any AssistantProvider (mock now, LLM later). */
export function useChatSession(provider: AssistantProvider, context: AssistantContext): ChatSession {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  // Latest values for the async send path; synced after render, never written during it.
  const ctxRef = useRef(context);
  const historyRef = useRef<ChatMessage[]>(messages);
  useLayoutEffect(() => {
    ctxRef.current = context;
    historyRef.current = messages;
  });

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const userMsg: ChatMessage = { id: nextId(), role: 'user', text, ts: Date.now() };
      const history = [...historyRef.current, userMsg];
      historyRef.current = history;
      const lastIntent = [...history].reverse().find((m) => m.role === 'assistant')?.intent;
      setMessages(history);
      setTyping(true);
      provider
        .reply(history, { ...ctxRef.current, lastIntent })
        .then((reply) => {
          setMessages((m) => [...m, { ...reply, id: nextId(), role: 'assistant', ts: Date.now() }]);
        })
        .catch(() => {
          setMessages((m) => [
            ...m,
            {
              id: nextId(),
              role: 'assistant',
              ts: Date.now(),
              text: ctxRef.current.lang === 'nl' ? 'Er ging iets mis. Probeer het opnieuw.' : 'Something went wrong. Please try again.',
            },
          ]);
        })
        .finally(() => setTyping(false));
    },
    [provider],
  );

  const reset = useCallback(() => {
    historyRef.current = [];
    setMessages([]);
  }, []);

  const { lang, route, audience } = context;
  const suggestions = useMemo(() => provider.suggestions({ lang, route, audience }), [provider, lang, route, audience]);

  return { messages, typing, send, reset, suggestions, provider };
}
