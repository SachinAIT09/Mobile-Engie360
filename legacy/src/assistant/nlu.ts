/**
 * Scripted assistant "NLU" (same approach as the Hydro One demo): deterministic normalisation,
 * entity extraction and weighted keyword intent matching, in English and Dutch.
 * No model, no network; behaviour is pinned by nlu.spec.ts.
 */

export const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;
export const MONTHS_NL = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'] as const;
const ABBR = new Map<string, number>([
  ['jan', 0], ['feb', 1], ['apr', 3], ['aug', 7], ['sep', 8], ['sept', 8], ['oct', 9], ['okt', 9], ['nov', 10], ['dec', 11],
]);

export type Range = 'today' | 'week' | 'month' | 'year';

export interface Entities {
  /** 0-based month index ("september" / "sept" → 8). */
  month: number | null;
  /** "last month" / "vorige maand". Resolved by the answer. */
  lastMonth: boolean;
  range: Range | null;
}

/** Misspellings and shorthand seen in rehearsals, applied word by word after lowercasing. */
const TYPOS: Record<string, string> = {
  bil: 'bill', bills: 'bill', rekning: 'rekening', notas: 'nota', factur: 'factuur', facturen: 'factuur',
  instalment: 'installment', installement: 'installment', instalments: 'installment', installments: 'installment',
  termijbedrag: 'termijnbedrag', termijnbedrg: 'termijnbedrag', elec: 'electricity', electricty: 'electricity',
  verbuik: 'verbruik', verbrik: 'verbruik', solor: 'solar', sollar: 'solar', zonnepanels: 'zonnepanelen',
  chargin: 'charging', chraging: 'charging', chrage: 'charge', whats: 'what is', wats: 'what is', whys: 'why is',
  hows: 'how is', im: 'i am', u: 'you', ur: 'your', thx: 'thanks', pls: 'please', plz: 'please', tonite: 'tonight',
  hogere: 'hoger', duurdere: 'duurder', wnr: 'wanneer', bedankt: 'bedankt', dankje: 'bedankt', dankjewel: 'bedankt',
};

/**
 * Lowercase, strip accents and punctuation, fix typos, collapse whitespace.
 * "Waarom is m'n NOTA zo hoog??" → "waarom is mn nota zo hoog".
 */
export function normalise(q: string): string {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`']/g, '')
    .replace(/m³/g, 'm3')
    .replace(/[^a-z0-9%€ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => TYPOS[w] ?? w)
    .join(' ');
}

export function extractEntities(raw: string): Entities {
  const n = normalise(raw);
  const words = n.split(' ');
  const lastMonth = /\b(last|previous|past) month\b|\b(vorige|afgelopen) maand\b/.test(n);
  let month: number | null = null;
  for (const w of words) {
    let i: number = MONTHS_EN.indexOf(w as (typeof MONTHS_EN)[number]);
    if (i < 0) i = MONTHS_NL.indexOf(w as (typeof MONTHS_NL)[number]);
    // "may" is also a verb: only a month after in/for/of or before bill/usage.
    if (i === 4 && w === 'may' && !/\b(in|for|of) may\b|\bmay (bill|usage|invoice)\b/.test(n)) continue;
    if (i < 0) i = ABBR.get(w) ?? -1;
    if (i >= 0) {
      month = i;
      break;
    }
  }
  let range: Range | null = null;
  if (/\b(today|so far|right now|tonight|vandaag|nu|vannacht|vanavond)\b/.test(n)) range = 'today';
  else if (/\b(this|past|last) week\b|\b(deze|vorige) week\b/.test(n)) range = 'week';
  else if (/\b(this|past) month\b|\bdeze maand\b/.test(n)) range = 'month';
  else if (/\b(this|past) year\b|\bper year\b|\b(dit|per) jaar\b|\bannual|\bjaarlijks/.test(n)) range = 'year';
  return { month, lastMonth, range };
}

// ---------------------------------------------------------------- intent matching

export interface KeywordGroup {
  /**
   * Phrases match on word boundaries. Single words match whole words, or word prefixes when at
   * least 4 letters ("bespar" ⊂ "besparen"). Prefix a word with "=" to force an exact match
   * ("=auto" must not match "automatische").
   */
  words: string[];
  weight: number;
}

export interface IntentDef<I extends string = string> {
  id: I;
  groups: KeywordGroup[];
  /** Regexes tested on the normalised question. */
  patterns?: { re: RegExp; weight: number }[];
  /** Any of these present → the intent scores 0. */
  negative?: string[];
  /** Tie-breaker: higher wins on equal score. */
  priority: number;
}

export interface IntentMatch<I extends string = string> {
  intent: I | 'FALLBACK';
  score: number;
  entities: Entities;
  /** True when the intent was inherited from the previous turn ("and last month?"). */
  followUp: boolean;
  scores: Record<string, number>;
}

export const MATCH_THRESHOLD = 2;

export function hasWord(words: string[], text: string, w: string): boolean {
  if (w.startsWith('=')) return words.includes(w.slice(1));
  if (w.includes(' ')) {
    const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${esc}(?=\\s|$)`).test(text);
  }
  if (w.length >= 4) return words.some((x) => x.startsWith(w));
  return words.includes(w);
}

function scoreIntent(def: IntentDef, text: string, words: string[]): number {
  if (def.negative?.some((w) => hasWord(words, text, w))) return 0;
  let s = 0;
  for (const g of def.groups) if (g.words.some((w) => hasWord(words, text, w))) s += g.weight;
  for (const p of def.patterns ?? []) if (p.re.test(text)) s += p.weight;
  return s;
}

const FOLLOW_UP_CUE = /^(and|what about|how about|same for|also|ok|okay|then|en|wat dacht je van|en voor|ook|dan|oke|en in)\b/;
const FILLER = new Set([
  'and', 'what', 'about', 'how', 'same', 'for', 'also', 'ok', 'okay', 'then', 'the', 'is', 'in', 'it', 'that', 'please',
  'en', 'wat', 'dacht', 'je', 'van', 'voor', 'ook', 'dan', 'oke', 'de', 'het', 'in', 'last', 'month', 'vorige', 'maand', 'afgelopen', 'previous',
]);

/** "and last month?", "en september?": nothing left once entities and filler words are removed. */
function isEntityOnly(text: string, ent: Entities): boolean {
  const rest = text.split(' ').filter((w) => w && !FILLER.has(w) && !MONTHS_EN.includes(w as never) && !MONTHS_NL.includes(w as never) && !ABBR.has(w));
  const hasEntity = ent.month !== null || ent.lastMonth || ent.range !== null;
  return hasEntity && rest.length <= 1;
}

/**
 * Pick the best intent. Below the threshold → FALLBACK, except a bare follow-up
 * ("and last month?") which inherits `lastIntent` when that intent is one of `defs`.
 */
export function matchIntent<I extends string>(question: string, defs: readonly IntentDef<I>[], lastIntent?: string): IntentMatch<I> {
  const text = normalise(question);
  const words = text.split(' ').filter(Boolean);
  const entities = extractEntities(question);
  const scores: Record<string, number> = {};
  let best: IntentDef<I> | null = null;
  let bestScore = 0;
  for (const d of defs) {
    const s = scoreIntent(d, text, words);
    scores[d.id] = s;
    if (s > bestScore || (s === bestScore && s > 0 && best && d.priority > best.priority)) {
      best = d;
      bestScore = s;
    }
  }

  const last = defs.find((d) => d.id === lastIntent);
  if (last && (isEntityOnly(text, entities) || (FOLLOW_UP_CUE.test(text) && words.length <= 5 && bestScore < MATCH_THRESHOLD))) {
    return { intent: last.id, score: Math.max(bestScore, MATCH_THRESHOLD), entities, followUp: true, scores };
  }
  if (!best || bestScore < MATCH_THRESHOLD) return { intent: 'FALLBACK', score: bestScore, entities, followUp: false, scores };
  return { intent: best.id, score: bestScore, entities, followUp: false, scores };
}
