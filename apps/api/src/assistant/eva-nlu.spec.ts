import { describe, expect, it } from 'vitest';
import { INTENTS, PERSONAL, PHRASES, SUGGESTIONS, type Intent } from './eva-intents.js';
import { extractEntities, matchIntent, normalise } from './eva-nlu.js';

const intentOf = (q: string, last?: string) => matchIntent(q, INTENTS, last).intent;

describe('normalise', () => {
  it('lowercases, strips accents and punctuation, fixes typos', () => {
    expect(normalise('Why’s my BIL so high??')).toBe('why is my bill so high');
    expect(normalise('Waarom is m’n nota’s zo hoog')).toBe('waarom is mn nota zo hoog');
    expect(normalise('Hoeveel m³ gas?')).toBe('hoeveel m3 gas');
    expect(normalise('één')).toBe('een');
  });
});

describe('entities', () => {
  it('reads English and Dutch months', () => {
    expect(extractEntities('my September bill').month).toBe(8);
    expect(extractEntities('verbruik in oktober').month).toBe(9);
    expect(extractEntities('sept usage').month).toBe(8);
    expect(extractEntities('nota van maart').month).toBe(2);
  });
  it('only treats "may" as a month in month context', () => {
    expect(extractEntities('may I ask something').month).toBeNull();
    expect(extractEntities('usage in may').month).toBe(4);
  });
  it('detects last month', () => {
    expect(extractEntities('and last month?').lastMonth).toBe(true);
    expect(extractEntities('en vorige maand?').lastMonth).toBe(true);
  });
});

describe('every suggestion phrase round-trips to its intent', () => {
  for (const [id, text] of Object.entries(PHRASES) as [Intent, { en: string; nl: string }][]) {
    it(`${id} (en)`, () => expect(intentOf(text.en)).toBe(id));
    it(`${id} (nl)`, () => expect(intentOf(text.nl)).toBe(id));
  }
});

describe('ambiguities', () => {
  it.each<[string, Intent]>([
    // "automatische" must never trigger the car intent
    ['Wanneer wordt mijn automatische incasso afgeschreven?', 'PAYMENT'],
    ['When is the direct debit collected?', 'PAYMENT'],
    ['What is my monthly payment?', 'INSTALLMENT'],
    ['How much could I save with solar?', 'SOLAR'],
    ['Wat levert zonnepanelen op?', 'SOLAR'],
    ['Why is my bill so high', 'BILL_WHY_HIGH'],
    ['why is my bil so hi', 'BILL_WHY_HIGH'],
    ['Waarom is mijn nota duurder', 'BILL_WHY_HIGH'],
    ['Why was my usage higher in September?', 'BILL_WHY_HIGH'],
    ['Show me my September invoice', 'INVOICE'],
    ['Explain my annual statement', 'INVOICE'],
    ['How much did I use in September?', 'USAGE'],
    ['Hoeveel stroom heb ik vandaag verbruikt', 'USAGE'],
    ['When is electricity cheapest to charge my car?', 'EV'],
    ['Mijn auto opladen, wanneer?', 'EV'],
    ['tips to lower my costs', 'SAVE'],
    ['Which energy contract suits me?', 'PRODUCTS'],
    ['I want a fixed contract', 'CONTRACT'],
    ['Hoe stap ik over naar ENGIE?', 'SWITCH'],
    ['I want to talk to a person', 'HUMAN'],
    ['Is there a flex moment today?', 'FLEX'],
    ['Kan ik vanavond later laden?', 'FLEX'],
    ['Tell me about Slim Laden', 'FLEX'],
    ['Het net is druk, moet ik iets doen?', 'FLEX'],
    ['hoi', 'GREETING'],
    ['thanks!', 'THANKS'],
  ])('%s → %s', (q, id) => expect(intentOf(q)).toBe(id));

  it('falls back on unrelated questions', () => {
    expect(intentOf('What is the capital of France?')).toBe('FALLBACK');
    expect(intentOf('blah blah')).toBe('FALLBACK');
  });
});

describe('suggestions', () => {
  it('every page lists known phrases, with a default and a visitor set', () => {
    expect(Object.keys(SUGGESTIONS).sort()).toEqual(['/billing', '/insights', '/profile', '/smart-charging', '/usage', 'default', 'visitor']);
    for (const ids of Object.values(SUGGESTIONS)) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect(intentOf(PHRASES[id].en)).toBe(id);
    }
    expect(SUGGESTIONS['/smart-charging']).toContain('FLEX');
  });
  it('visitors are only offered questions that need no sign-in', () => {
    for (const id of SUGGESTIONS.visitor.filter((x) => x !== 'BILL_WHY_HIGH')) expect(PERSONAL).not.toContain(id);
    expect(PERSONAL).toContain('FLEX');
  });
});

describe('follow-ups', () => {
  it('a bare date inherits the previous intent', () => {
    const m = matchIntent('and last month?', INTENTS, 'USAGE');
    expect(m.intent).toBe('USAGE');
    expect(m.followUp).toBe(true);
    expect(matchIntent('en in september?', INTENTS, 'INVOICE').intent).toBe('INVOICE');
    expect(matchIntent('what about August', INTENTS, 'BILL_WHY_HIGH').intent).toBe('BILL_WHY_HIGH');
  });
  it('a new topic wins over the previous intent', () => {
    expect(matchIntent('and what about solar panels?', INTENTS, 'USAGE').intent).toBe('SOLAR');
  });
  it('without a previous intent a bare date is a fallback', () => {
    expect(matchIntent('and last month?', INTENTS).intent).toBe('FALLBACK');
  });
});
