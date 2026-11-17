/**
 * The customer base behind the staff app: about 1,250 sample customers, generated the same way on
 * every start (seeded), all with US names. The one live customer (data/customer.ts, the phone in
 * the demo) is not in this list; the server adds them in front.
 */
import type { AttentionFlag } from '../../shared/contract';
import type { Text } from '../lib/i18n';
import { contract } from './customer';

export interface PopCustomer {
  id: string;
  customerNo: string;
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  street: string;
  postcode: string;
  city: string;
  /** Index into PRODUCTS. */
  product: number;
  installment: number;
  advised: number;
  hasEv: boolean;
  flags: AttentionFlag[];
  /** Uses the customer app (the rest only get paper/email). */
  appUser: boolean;
  pushOn: boolean;
  /** Yearly usage relative to the live customer's (1 = the same). */
  usageScale: number;
  /** Minutes since they were last in the app when the server started; null = never. */
  seenMinAgo: number | null;
}

export const PRODUCTS: Text[] = [contract.product, { en: 'Fixed Electricity & Gas, 1 year', nl: 'Vaste Stroom & Gas, 1 jaar' }, { en: 'Variable Electricity & Gas', nl: 'Variabele Stroom & Gas' }];

const FIRST = [
  'James', 'Mary', 'Michael', 'Jennifer', 'Robert', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah',
  'Christopher', 'Karen', 'Daniel', 'Nancy', 'Matthew', 'Lisa', 'Anthony', 'Ashley', 'Mark', 'Emily', 'Steven', 'Michelle', 'Andrew', 'Amanda', 'Joshua', 'Melissa',
  'Kevin', 'Stephanie', 'Brian', 'Rebecca', 'Ryan', 'Laura', 'Jason', 'Hannah', 'Justin', 'Megan', 'Brandon', 'Rachel', 'Tyler', 'Samantha', 'Nathan', 'Grace',
];
const LAST = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Thompson', 'White',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Hill', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall',
  'Campbell', 'Mitchell', 'Roberts', 'Phillips', 'Evans', 'Turner', 'Parker', 'Collins', 'Edwards', 'Stewart', 'Morris', 'Murphy', 'Cook', 'Rogers', 'Morgan', 'Cooper',
];
const CITIES: [string, string][] = [
  ['Utrecht', '35'], ['Amsterdam', '10'], ['Rotterdam', '30'], ['The Hague', '25'], ['Eindhoven', '56'], ['Groningen', '97'], ['Haarlem', '20'], ['Leiden', '23'],
  ['Amersfoort', '38'], ['Delft', '26'], ['Arnhem', '68'], ['Zwolle', '80'],
];
const STREETS = ['Lindelaan', 'Kerkstraat', 'Dorpsstraat', 'Molenweg', 'Stationsweg', 'Parklaan', 'Beatrixlaan', 'Julianastraat', 'Wilhelminalaan', 'Schoolstraat', 'Nieuwstraat', 'Oranjelaan'];

/** Small seeded generator (mulberry32), so the same customers come out every time. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POPULATION_SIZE = 1247;

export const POPULATION: PopCustomer[] = (() => {
  const r = rng(360);
  const pick = <T>(list: T[]) => list[Math.floor(r() * list.length)]!;
  const used = new Set<string>();
  const out: PopCustomer[] = [];
  while (out.length < POPULATION_SIZE) {
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    const key = `${firstName} ${lastName}`;
    if (used.has(key)) continue;
    used.add(key);
    const n = out.length + 1;
    const [city, pc] = pick(CITIES);
    const usageScale = 0.55 + r() * 1.1;
    const advised = Math.round((contract.advisedInstallment * usageScale) / 5) * 5;
    const low = r() < 0.17;
    const installment = low ? advised - 5 * (1 + Math.floor(r() * 5)) : advised + 5 * Math.floor(r() * 3);
    const hasEv = r() < 0.22;
    const appUser = r() < 0.7;
    const flags: AttentionFlag[] = [];
    if (low) flags.push('installment');
    if (hasEv && r() < 0.45) flags.push('ev-peak');
    if (r() < 0.012) flags.push('night-use');
    // Most app users were in the app in the last few days; a few are in it right now.
    const u = r();
    const seenMinAgo = !appUser ? null : u < 0.025 ? Math.floor(r() * 4) : u < 0.3 ? 5 + Math.floor(r() * 600) : Math.floor(600 + r() * 60 * 24 * 30);
    out.push({
      id: `C-${2003500000 + n * 37}`,
      customerNo: `2003 ${String(500 + Math.floor((n * 37) / 1000)).padStart(3, '0')} ${String((n * 37) % 1000).padStart(3, '0')}`,
      firstName,
      lastName,
      initials: `${firstName[0]}${lastName[0]}`,
      email: `${firstName}.${lastName}`.toLowerCase() + '@example.com',
      street: `${pick(STREETS)} ${1 + Math.floor(r() * 180)}`,
      postcode: `${pc}${String(10 + Math.floor(r() * 89))} ${String.fromCharCode(65 + Math.floor(r() * 26))}${String.fromCharCode(65 + Math.floor(r() * 26))}`,
      city,
      product: r() < 0.4 ? 0 : r() < 0.6 ? 1 : 2,
      installment,
      advised,
      hasEv,
      flags,
      appUser,
      pushOn: appUser && r() < 0.6,
      usageScale,
      seenMinAgo,
    });
  }
  return out;
})();
