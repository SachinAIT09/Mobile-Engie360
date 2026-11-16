import type { AssistantChannel, Lang } from '@engie/shared';
import { prng } from '../common/numbers.js';
import type { Db } from '../db/db.service.js';
import type { AssistantLogDoc } from '../db/schemas.js';
import { FIRST_NAMES, LAST_NAMES } from './seed-data.js';

/** [question, intent, matched, lang, weight]. Weights give a believable mix for an energy supplier. */
const QUESTIONS: [string, string, boolean, Lang, number][] = [
  ['Waarom is mijn energierekening hoger deze maand?', 'BILL_WHY_HIGH', true, 'nl', 9],
  ['Wat is mijn huidige termijnbedrag?', 'INSTALLMENT', true, 'nl', 8],
  ['Kan ik mijn termijnbedrag verlagen?', 'INSTALLMENT', true, 'nl', 6],
  ['Hoeveel energie heb ik deze maand verbruikt?', 'USAGE', true, 'nl', 7],
  ['Wanneer kan ik mijn auto het best laden?', 'EV', true, 'nl', 5],
  ['Wat kost stroom morgen?', 'EV', true, 'nl', 3],
  ['Kun je mijn laatste nota uitleggen?', 'INVOICE', true, 'nl', 5],
  ['Wanneer is mijn volgende betaling?', 'PAYMENT', true, 'nl', 4],
  ['Ik ga verhuizen', 'MOVING', true, 'nl', 4],
  ['Is er een storing?', 'OUTAGE', true, 'nl', 3],
  ['Ik wil de klantenservice spreken', 'HUMAN', true, 'nl', 4],
  ['Welk energiecontract past bij mij?', 'PRODUCTS', true, 'nl', 4],
  ['Hoe stap ik over naar ENGIE?', 'SWITCH', true, 'nl', 3],
  ['Hoe kan ik mijn stroomkosten verlagen?', 'SAVE', true, 'nl', 5],
  ['Moet ik meterstanden doorgeven?', 'METER', true, 'nl', 3],
  ['Lonen zonnepanelen voor mij?', 'SOLAR', true, 'nl', 3],
  ['Is jullie stroom groen?', 'GREEN', true, 'nl', 2],
  ['Why is my energy bill higher this month?', 'BILL_WHY_HIGH', true, 'en', 2],
  ['What is my monthly installment?', 'INSTALLMENT', true, 'en', 2],
  ['When should I charge my car?', 'EV', true, 'en', 1],
  ['Kan ik mijn contract opzeggen zonder boete?', 'FALLBACK', false, 'nl', 2],
  ['Wat is het teruglevertarief voor zonnepanelen?', 'FALLBACK', false, 'nl', 2],
  ['Hoe werkt de salderingsregeling na 2027?', 'FALLBACK', false, 'nl', 2],
  ['Mijn laadpaal staat op naam van mijn werkgever, kan ik toch Slim Laden?', 'FALLBACK', false, 'nl', 1],
  ['Do you offer a heat pump subsidy?', 'FALLBACK', false, 'en', 1],
];

const CHANNEL_MIX: [AssistantChannel, number][] = [
  ['APP', 0.58],
  ['WEBSITE', 0.3],
  ['WEBSITE_SIGNED_IN', 0.12],
];

const PERSONAL = new Set(['BILL_WHY_HIGH', 'INSTALLMENT', 'USAGE', 'EV', 'INVOICE', 'PAYMENT', 'METER']);

/** ~150 questions over the last 24 hours, busier in the evening, for the staff Assistant insights page. */
export async function seedAssistantLog(db: Db, now: Date): Promise<void> {
  const rnd = prng(20261117);
  const total = QUESTIONS.reduce((s, q) => s + q[4], 0);
  const pickQ = () => {
    let x = rnd() * total;
    for (const q of QUESTIONS) if ((x -= q[4]) < 0) return q;
    return QUESTIONS[0]!;
  };
  const pickChannel = (): AssistantChannel => {
    let x = rnd();
    for (const [c, share] of CHANNEL_MIX) if ((x -= share) < 0) return c;
    return 'APP';
  };
  const docs: Partial<AssistantLogDoc>[] = [];
  for (let i = 0; i < 150; i++) {
    // Skew towards the evening: square the uniform value away from "now".
    const hoursAgo = 24 * (1 - Math.sqrt(rnd()));
    const at = new Date(now.getTime() - hoursAgo * 3600000 - 60000);
    const [question, intent, matched, lang] = pickQ();
    const channel = pickChannel();
    const visitor = channel === 'WEBSITE';
    const signInPrompt = visitor && PERSONAL.has(intent);
    const named = !visitor;
    docs.push({
      at,
      channel,
      customerId: null,
      customerName: named ? `${FIRST_NAMES[Math.floor(rnd() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rnd() * LAST_NAMES.length)]}` : null,
      question,
      intent,
      matched,
      signInPrompt,
      handoff: intent === 'HUMAN' || (!matched && rnd() < 0.5),
      lang,
      synthetic: true,
    });
  }
  await db.assistantLog.insertMany(docs);
}
