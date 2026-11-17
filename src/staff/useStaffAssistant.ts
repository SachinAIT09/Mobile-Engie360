import { useCallback, useRef, useState } from 'react';
import type { StaffAssistantRequest } from '../../shared/contract';
import { API, post } from '../api/client';
import type { AssistantReply } from '../assistant/types';
import type { Lang } from '../lib/i18n';

/** One question and its answer in the staff assistant. */
export interface Turn {
  id: string;
  question: string;
  status: 'pending' | 'done' | 'error';
  answer?: AssistantReply;
}

export interface StaffAssistant {
  turns: Turn[];
  busy: boolean;
  ask: (question: string) => void;
  clear: () => void;
  /** Questions asked this session, newest first (max 20). */
  history: string[];
}

let seq = 0;

/**
 * The staff assistant's conversation. It lives in the staff layout, so it is still there when you
 * come back from the page an answer sent you to (the composer, the customer page).
 */
export function useStaffAssistant(lang: Lang): StaffAssistant {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const lastIntent = useRef<string | undefined>(undefined);
  const busy = turns.some((t) => t.status === 'pending');

  const ask = useCallback(
    (raw: string) => {
      const question = raw.trim();
      if (!question) return;
      const id = `t${Date.now().toString(36)}${(seq++).toString(36)}`;
      setTurns((list) => [...list, { id, question, status: 'pending' }]);
      setHistory((h) => [question, ...h.filter((q) => q !== question)].slice(0, 20));
      const body: StaffAssistantRequest = { question, lang, lastIntent: lastIntent.current };
      // A short pause so the typing dots are visible before the answer types in.
      Promise.all([post<AssistantReply>(API.staffAssistant, body), new Promise((r) => setTimeout(r, 500))]).then(
        ([answer]) => {
          lastIntent.current = answer.intent;
          setTurns((list) => list.map((t) => (t.id === id ? { ...t, status: 'done', answer } : t)));
        },
        () => setTurns((list) => list.map((t) => (t.id === id ? { ...t, status: 'error' } : t))),
      );
    },
    [lang],
  );

  const clear = useCallback(() => {
    lastIntent.current = undefined;
    setTurns([]);
  }, []);

  return { turns, busy, ask, clear, history };
}
