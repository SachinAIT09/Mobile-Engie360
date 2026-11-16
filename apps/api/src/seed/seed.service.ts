import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { PROGRAM, type Lang, type ProductId, type UsageProfile } from '@engie/shared';
import { config } from '../config.js';
import { Db } from '../db/db.service.js';
import type {
  CustomerDoc,
  DistrictDoc,
  EnrollmentDoc,
  EvDetectionDoc,
  GridAreaDoc,
  InvoiceDoc,
  MessageDoc,
  PremiseDoc,
} from '../db/schemas.js';
import { prng } from '../common/numbers.js';
import { addMinutes } from '../common/time.js';
import { allocateDistrictEvs } from './allocate.js';
import { seedAssistantLog } from './assistant-seed.js';
import { seedAudit } from './audit-seed.js';
import { buildContract, buildInvoiceHistory, FIXED_PER_MONTH, PRODUCTS } from './contracts.js';
import { baselineForecastPct } from './forecast.js';
import {
  AREA_BY_CODE,
  DEAD_GRID_AREAS,
  DISTRICT_AREA,
  DISTRICT_NAME,
  FIRST_NAMES,
  GRID_AREAS,
  HEADLINE,
  HOME_TYPES,
  LAST_NAMES,
  LIVE_DISTRICTS,
  STREETS,
  TOWN,
} from './seed-data.js';
import { seedSmartCharging } from './smart-charging-seed.js';

const oid = () => new Types.ObjectId();
const DAY = 86400000;

export const DEMO_EMAILS = {
  unenrolled: 'sanne@demo.test',
  enrolled: 'daan@demo.test',
  staff: 'staff@demo.test',
  staff2: 'ops@demo.test',
} as const;

export const DEMO_IDS = {
  unenrolledCustomer: new Types.ObjectId('00000000000000000000a001'),
  enrolledCustomer: new Types.ObjectId('00000000000000000000a002'),
  unenrolledUser: new Types.ObjectId('00000000000000000000b001'),
  enrolledUser: new Types.ObjectId('00000000000000000000b002'),
  staffUser: new Types.ObjectId('00000000000000000000b003'),
  staffUser2: new Types.ObjectId('00000000000000000000b004'),
} as const;

const PRODUCT_MIX: [ProductId, number][] = [
  ['DYNAMIC', 0.18],
  ['DYNAMIC_FIXED_GAS', 0.22],
  ['FIXED', 0.45],
  ['VARIABLE', 0.15],
];

@Injectable()
export class SeedService {
  private readonly log = new Logger('Seed');

  constructor(private readonly db: Db) {}

  async isEmpty(): Promise<boolean> {
    return (await this.db.config.countDocuments({ key: 'main' })) === 0;
  }

  async seedIfEmpty(): Promise<boolean> {
    if (!(await this.isEmpty())) return false;
    await this.seed();
    return true;
  }

  async reset(): Promise<void> {
    await this.db.dropAll();
    await this.seed();
  }

  /** Builds the whole demo dataset. Deterministic apart from timestamps. */
  async seed(): Promise<void> {
    const t0 = Date.now();
    const rnd = prng(20261116);
    const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)] as T;
    const now = new Date();

    // ---- program
    const programId = oid();
    await this.db.programs.create({ _id: programId, ...PROGRAM });

    // ---- grid areas + districts
    const gridAreas: Partial<GridAreaDoc>[] = [];
    const districts: Partial<DistrictDoc>[] = [];
    GRID_AREAS.forEach((g, i) => {
      gridAreas.push({
        code: g.code,
        name: g.name,
        operator: g.operator,
        congestion: g.congestion,
        order: i,
        region: g.region,
        seedEvs: g.evs,
        seedKnown: Math.round((g.evs * g.knownPct) / 100),
        penetrationPct: g.penetrationPct,
        districtCount: g.districts.length,
        dead: false,
        deadPremises: 0,
        interactive: g.code === 'UT-OOST',
      });
      // Live districts keep their seeded split; the remaining EVs are spread across static districts.
      allocateDistrictEvs(g.districts.map(([pc]) => pc), g.evs, LIVE_DISTRICTS).forEach((a, k) => {
        const live = LIVE_DISTRICTS[a.code];
        districts.push({
          code: a.code,
          name: DISTRICT_NAME[a.code] ?? a.code,
          gridAreaCode: g.code,
          order: k,
          live: !!live,
          premisesCount: live ? live.premises : null,
          capacityKw: 4000 + Math.round(rnd() * 2000),
          forecastLoadPct: baselineForecastPct(a.code),
          staticEvs: live ? 0 : a.evs,
          seedKnown: live ? live.known : 0,
          seedUnenrolled: live ? live.unenrolled : 0,
        });
      });
    });
    DEAD_GRID_AREAS.forEach(([code, name, operator, districtCount, premises], i) => {
      gridAreas.push({
        code, name, operator, congestion: 'NONE', order: 100 + i, region: '—', seedEvs: 0, seedKnown: 0, penetrationPct: 0,
        districtCount, dead: true, deadPremises: premises, interactive: false,
      });
      for (let k = 0; k < districtCount; k++) {
        const dc = `${code}-${k + 1}`;
        districts.push({
          code: dc, name: `${name} ${k + 1}`, gridAreaCode: code, order: k, live: false, premisesCount: null,
          capacityKw: 3000, forecastLoadPct: baselineForecastPct(dc), staticEvs: 0, seedKnown: 0, seedUnenrolled: 0,
        });
      }
    });
    await this.db.gridAreas.insertMany(gridAreas);
    await this.db.districts.insertMany(districts);

    // ---- live customers
    const premises: Partial<PremiseDoc>[] = [];
    const customers: Partial<CustomerDoc>[] = [];
    const detections: Partial<EvDetectionDoc>[] = [];
    const enrollments: Partial<EnrollmentDoc>[] = [];
    let n = 0;
    const productFor = (): ProductId => {
      let x = rnd();
      for (const [p, share] of PRODUCT_MIX) {
        if ((x -= share) < 0) return p;
      }
      return 'FIXED';
    };

    interface CustomerOver extends Partial<CustomerDoc> {
      product?: ProductId;
      installmentDelta?: number;
      startDate?: string;
    }
    const mkCustomer = (districtCode: string, over: CustomerOver = {}) => {
      n++;
      const gridAreaCode = DISTRICT_AREA[districtCode] as string;
      const area = AREA_BY_CODE[gridAreaCode]!;
      const premiseId = oid();
      const pcLetters = `${String.fromCharCode(65 + Math.floor(rnd() * 26))}${String.fromCharCode(65 + Math.floor(rnd() * 26))}`;
      const street = over.street ?? `${pick(STREETS)} ${2 + Math.floor(rnd() * 180)}`;
      const postcode = over.postcode ?? `${districtCode} ${pcLetters}`;
      const city = over.city ?? (area.code === 'UT-OOST' ? TOWN : area.name.split('-')[0]!);
      const address = `${street}, ${postcode} ${city}`;
      const hasSolar = over.hasSolar ?? rnd() < 0.32;
      const hasHeatPump = over.hasHeatPump ?? rnd() < 0.08;
      premises.push({ _id: premiseId, address, districtCode, gridAreaCode, hasSolar });
      const usage = over.usage ?? { seed: 1000 + n, elecScale: 0.75 + rnd() * 0.6, gasScale: hasHeatPump ? 0.25 : 0.7 + rnd() * 0.6 };
      const product = over.product ?? productFor();
      const def = PRODUCTS[product];
      const evSince = over.evSince === undefined ? null : over.evSince;
      const startDate = over.startDate ?? new Date(now.getTime() - (200 + Math.floor(rnd() * 1500)) * DAY).toISOString().slice(0, 8) + '01';
      const profile: UsageProfile = {
        ...usage,
        evSince: evSince ? evSince.toISOString() : null,
        elecPrice: def.elecPrice,
        gasPrice: def.gasPrice,
        fixedPerMonth: FIXED_PER_MONTH,
      };
      // ~22% pay too little (the installment-advice segment); the rest pay about right or a little more.
      const delta = over.installmentDelta ?? (rnd() < 0.22 ? -(8 + Math.floor(rnd() * 22)) : Math.floor(rnd() * 12) - 2);
      const contract = buildContract({ product, startDate, profile, now, installmentDelta: delta, digits: 4100 + n * 17 });
      const firstName = over.firstName ?? pick(FIRST_NAMES);
      const lastName = over.lastName ?? pick(LAST_NAMES);
      const c: Partial<CustomerDoc> = {
        _id: oid(),
        firstName,
        lastName,
        email: `klant${n}@synthetic.test`,
        phone: `+31 6 ${String(10000000 + Math.floor(rnd() * 89999999)).replace(/(\d{4})(\d{4})/, '$1 $2')}`,
        customerNo: String(2003000000 + Math.floor(rnd() * 899999)).replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3'),
        premiseId,
        address,
        street,
        postcode,
        city,
        districtCode,
        gridAreaCode,
        gridOperator: area.operator,
        household: { residents: 1 + Math.floor(rnd() * 5), homeType: pick(HOME_TYPES), sizeM2: 55 + Math.floor(rnd() * 110) },
        ibanMasked: `NL•• ${pick(['ABNA', 'INGB', 'RABO', 'SNSB', 'TRIO'])} •••• ••${10 + Math.floor(rnd() * 89)}`,
        memberSince: new Date(startDate),
        hasSolar,
        hasHeatPump,
        heatPumpDetectedAt: hasHeatPump ? new Date(now.getTime() - (20 + Math.floor(rnd() * 300)) * DAY) : null,
        lang: 'nl' as Lang,
        preferences: { usageAlerts: true, priceAlerts: product.startsWith('DYNAMIC'), invoiceReady: true, tips: rnd() < 0.7 },
        contract,
        usage,
        evSince,
        savingsPlan: [],
        optedOutOfMessages: rnd() < 0.03,
        lifeSupport: rnd() < 0.02,
        groundTruthValidated: false,
        channels: { push: true, sms: rnd() < 0.3, email: rnd() < 0.8 },
        autoPay: { enabled: true, method: 'DIRECT_DEBIT', since: new Date(startDate) },
        evChargingActive: false,
        smartCharging: null,
        demoRole: null,
        synthetic: true,
        ...over,
      };
      customers.push(c);
      return c;
    };
    const detect = (c: Partial<CustomerDoc>, daysAgo = 1 + Math.floor(rnd() * 90)) => {
      const at = new Date(now.getTime() - daysAgo * DAY);
      if (!c.evSince) c.evSince = new Date(at.getTime() - 5 * DAY);
      detections.push({
        _id: oid(), premiseId: c.premiseId, customerId: c._id, districtCode: c.districtCode, gridAreaCode: c.gridAreaCode,
        firstDetectedAt: at, source: 'NET2GRID', status: 'DETECTED',
      });
    };
    const enroll = (c: Partial<CustomerDoc>) =>
      enrollments.push({
        _id: oid(), customerId: c._id, programId, districtCode: c.districtCode, gridAreaCode: c.gridAreaCode,
        enrolledAt: new Date(now.getTime() - (30 + Math.floor(rnd() * 400)) * DAY), source: 'LEGACY',
        evMake: null, chargerType: 'LEVEL_2', status: 'ACTIVE',
      });

    // Fixed ids keep demo logins and socket rooms valid across resets.
    const demoUnenrolledId = DEMO_IDS.unenrolledCustomer;
    const demoEnrolledId = DEMO_IDS.enrolledCustomer;
    for (const [districtCode, spec] of Object.entries(LIVE_DISTRICTS)) {
      const evs = spec.known + spec.unenrolled;
      const confirmed = spec.confirmed ?? Math.round(spec.known * 0.78);
      let gtLeft = spec.groundTruth ?? Math.round(evs * 0.15);
      for (let k = 0; k < spec.known; k++) {
        const isDaan = districtCode === '3581' && k === 0;
        const evSince = new Date(now.getTime() - (60 + Math.floor(rnd() * 500)) * DAY);
        const c = isDaan
          ? mkCustomer(districtCode, {
              _id: demoEnrolledId, firstName: config.demoEnrolledFirstName, lastName: 'Bakker', email: DEMO_EMAILS.enrolled,
              phone: '+31 6 1872 4410', customerNo: '2003 552 018', street: 'Oudwijkerdwarsstraat 61', postcode: '3581 LK', city: TOWN,
              address: `Oudwijkerdwarsstraat 61, 3581 LK ${TOWN}`, hasSolar: true, hasHeatPump: false, heatPumpDetectedAt: null,
              optedOutOfMessages: false, lifeSupport: false, channels: { push: true, sms: true, email: true },
              household: { residents: 2, homeType: { en: 'Terraced house, 1931', nl: 'Tussenwoning, 1931' }, sizeM2: 104 },
              ibanMasked: 'NL•• INGB •••• ••52', usage: { seed: 2, elecScale: 0.92, gasScale: 0.85 }, product: 'DYNAMIC',
              installmentDelta: 2, startDate: '2024-06-01', evSince: new Date(now.getTime() - 300 * DAY),
              evChargingActive: true, demoRole: 'ENROLLED_DEMO', synthetic: false,
            })
          : mkCustomer(districtCode, { evSince });
        if (gtLeft > 0) { c.groundTruthValidated = true; gtLeft--; }
        if (k < confirmed) detect(c, Math.max(1, Math.floor((now.getTime() - (c.evSince as Date).getTime()) / DAY) - 3));
        enroll(c);
      }
      for (let k = 0; k < spec.unenrolled; k++) {
        const c = mkCustomer(districtCode);
        if (gtLeft > 0) { c.groundTruthValidated = true; gtLeft--; }
        detect(c);
      }
      for (let k = 0; k < (spec.others ?? 0); k++) mkCustomer(districtCode);
    }
    // Sanne: in 3581, Dynamische Stroom & Vast Gas, no EV detected and not in Slim Laden yet, installment below the advice.
    mkCustomer('3581', {
      _id: demoUnenrolledId, firstName: config.demoFirstName, lastName: 'de Vries', email: DEMO_EMAILS.unenrolled,
      phone: '+31 6 2345 6789', customerNo: '2003 418 762', street: 'Lindelaan 24', postcode: '3581 AB', city: TOWN,
      address: `Lindelaan 24, 3581 AB ${TOWN}`, hasSolar: false, hasHeatPump: false, heatPumpDetectedAt: null,
      optedOutOfMessages: false, lifeSupport: false, channels: { push: true, sms: true, email: true },
      household: { residents: 3, homeType: { en: 'Terraced house, 1978', nl: 'Tussenwoning, 1978' }, sizeM2: 118 },
      ibanMasked: 'NL•• ABNA •••• ••00', usage: { seed: 1, elecScale: 1, gasScale: 1 }, product: 'DYNAMIC_FIXED_GAS',
      installmentDelta: -13, startDate: '2025-03-01', evSince: null, evChargingActive: false,
      preferences: { usageAlerts: true, priceAlerts: true, invoiceReady: true, tips: true },
      demoRole: 'UNENROLLED_DEMO', synthetic: false,
    });
    await this.db.premises.insertMany(premises);
    await this.db.customers.insertMany(customers);
    await this.db.detections.insertMany(detections);
    await this.db.enrollments.insertMany(enrollments);
    await seedSmartCharging(this.db, customers);
    // ---- users
    await this.db.users.insertMany([
      { _id: DEMO_IDS.unenrolledUser, email: DEMO_EMAILS.unenrolled, role: 'CUSTOMER', firstName: config.demoFirstName, lastName: 'de Vries', customerId: demoUnenrolledId },
      { _id: DEMO_IDS.enrolledUser, email: DEMO_EMAILS.enrolled, role: 'CUSTOMER', firstName: config.demoEnrolledFirstName, lastName: 'Bakker', customerId: demoEnrolledId },
      { _id: DEMO_IDS.staffUser, email: DEMO_EMAILS.staff, role: 'STAFF', firstName: 'Demo', lastName: 'Staff', customerId: null },
      { _id: DEMO_IDS.staffUser2, email: DEMO_EMAILS.staff2, role: 'STAFF', firstName: 'Lotte', lastName: 'Visser', customerId: null },
    ]);

    // ---- invoices + inbox history for the two demo customers
    for (const customerId of [demoUnenrolledId, demoEnrolledId]) {
      const c = customers.find((x) => String(x._id) === String(customerId)) as CustomerDoc;
      // The installment was raised at the last annual statement.
      const previous = Math.max(40, c.contract.installment - 13);
      const invoices: Partial<InvoiceDoc>[] = buildInvoiceHistory(c.contract, c.customerNo, now, previous).map((i) => ({ customerId, ...i }));
      await this.db.invoices.insertMany(invoices);
      const latest = invoices.find((i) => i.kind === 'INSTALLMENT')!;
      const history: Partial<MessageDoc>[] = [
        {
          customerId, kind: 'BILL', category: 'Billing', tag: 'Nota', title: `Je termijnbedrag voor ${latest.period!.nl} staat klaar`,
          body: `€ ${latest.amount!.toFixed(2).replace('.', ',')} wordt op de 28e automatisch afgeschreven.`, cta: 'Bekijk nota',
          campaignId: null, flexEventId: null, route: '/billing',
          createdAt: addMinutes(now, -2 * 1440), deliveredAt: addMinutes(now, -2 * 1440), openedAt: addMinutes(now, -2 * 1440 + 45),
          actedAt: null, action: null, variant: null, synthetic: false,
        },
        {
          customerId, kind: 'METER', category: 'Alerts', tag: 'Meterstand', title: 'Meterstanden ontvangen',
          body: 'Je slimme meter heeft je meterstanden doorgegeven. Je hoeft niets te doen.', cta: null,
          campaignId: null, flexEventId: null, route: '/usage',
          createdAt: addMinutes(now, -16 * 1440), deliveredAt: addMinutes(now, -16 * 1440), openedAt: addMinutes(now, -16 * 1440 + 10),
          actedAt: null, action: null, variant: null, synthetic: false,
        },
      ];
      await this.db.messages.insertMany(history);
    }

    // ---- assistant questions from the last day (Assistant insights), audit history
    await seedAssistantLog(this.db, now);
    await seedAudit(this.db);

    // ---- config (last: marks the seed complete)
    await this.db.config.create({
      key: 'main',
      matchedPremises: HEADLINE.matchedPremises,
      noSignalPremises: HEADLINE.noSignalPremises,
      noLocationPremises: HEADLINE.noLocationPremises,
      partiallyDeadGridAreas: HEADLINE.partiallyDeadGridAreas,
      deadDistricts: HEADLINE.deadDistricts,
      deadDistrictPremises: HEADLINE.deadDistrictPremises,
      dataSourceNote: HEADLINE.dataSourceNote,
      lastReset: now,
    });

    this.log.log(`Seeded ${customers.length} customers, ${districts.length} districts in ${Date.now() - t0} ms`);
  }
}
