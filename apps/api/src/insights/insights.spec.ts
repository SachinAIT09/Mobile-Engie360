import { describe, expect, it } from 'vitest';
import { fmtEur, type EvStatus, type ProductId, type UsageProfile } from '@engie/shared';
import { buildContract } from '../seed/contracts.js';
import { buildInsights, type InsightInput } from './insights.js';

const NOW = new Date('2026-11-16T13:20:00Z');
const PROFILE: UsageProfile = { seed: 1, elecScale: 1, gasScale: 1, evSince: '2026-08-25T00:00:00Z', elecPrice: 0.25, gasPrice: 1.25, fixedPerMonth: 22.8 };

interface Opts {
  evStatus?: EvStatus;
  expectedSettlement?: number;
  hasSolar?: boolean;
  hasHeatPump?: boolean;
  product?: ProductId;
  evSince?: string | null;
}

function input(o: Opts = {}): InsightInput {
  const evSince = o.evSince === undefined ? PROFILE.evSince : o.evSince;
  const profile = { ...PROFILE, evSince };
  const contract = buildContract({ product: o.product ?? 'DYNAMIC_FIXED_GAS', startDate: '2025-03-01', profile, now: NOW, installmentDelta: -25, digits: 48213 });
  return {
    c: { contract, hasSolar: o.hasSolar ?? false, hasHeatPump: o.hasHeatPump ?? false, evSince: evSince ? new Date(evSince) : null } as InsightInput['c'],
    profile,
    evStatus: o.evStatus ?? 'DETECTED_NOT_ENROLLED',
    expectedSettlement: o.expectedSettlement ?? 300,
    now: NOW,
  };
}
const ids = (o: Opts = {}) => buildInsights(input(o)).map((i) => i.id);

describe('buildInsights', () => {
  it('shows the installment insight only when more than €60 is expected at the annual statement', () => {
    expect(ids({ expectedSettlement: 61 })).toContain('installment');
    expect(ids({ expectedSettlement: 60 })).not.toContain('installment');
    expect(ids({ expectedSettlement: 0 })).not.toContain('installment');
    expect(ids({ expectedSettlement: -120 })).not.toContain('installment');
  });

  it('the installment insight quotes the expected amount and the advised installment', () => {
    const inp = input({ expectedSettlement: 300 });
    const i = buildInsights(inp).find((x) => x.id === 'installment')!;
    expect(i).toMatchObject({ kind: 'billing', source: 'engie', saving: null, route: '/billing?adjust=1' });
    expect(i.body.en).toContain(fmtEur(300, 'en', 0));
    expect(i.body.en).toContain(fmtEur(inp.c.contract.advisedInstallment, 'en', 0));
    expect(i.body.nl).toContain(fmtEur(inp.c.contract.advisedInstallment, 'nl', 0));
    expect(i.cta).toEqual({ en: 'Adjust installment', nl: 'Termijnbedrag aanpassen' });
  });

  it('shows EV insights only when the home has an EV', () => {
    expect(ids({ evStatus: 'DETECTED_NOT_ENROLLED' })).toEqual(expect.arrayContaining(['slim-laden', 'ev-peak']));
    expect(ids({ evStatus: 'ENROLLED' })).toContain('ev-peak');
    const none = ids({ evStatus: 'NONE', evSince: null });
    expect(none).not.toContain('ev-peak');
    expect(none).not.toContain('slim-laden');
    // No EV status, whatever the usage profile says.
    expect(ids({ evStatus: 'NONE' })).not.toContain('ev-peak');
  });

  it('offers Slim Laden only to detected EVs that are not enrolled', () => {
    expect(ids({ evStatus: 'DETECTED_NOT_ENROLLED' })[0]).toBe('slim-laden');
    expect(ids({ evStatus: 'ENROLLED' })).not.toContain('slim-laden');
    expect(ids({ evStatus: 'NONE', evSince: null })).not.toContain('slim-laden');
    const offer = buildInsights(input()).find((i) => i.id === 'slim-laden')!;
    expect(offer).toMatchObject({ route: '/program', source: 'net2grid', kind: 'saving' });
    expect(buildInsights(input({ evStatus: 'ENROLLED' })).find((i) => i.id === 'ev-peak')?.route).toBe('/smart-charging');
  });

  it('leaves the solar insight out for homes that already have panels', () => {
    expect(ids({ hasSolar: false })).toContain('solar');
    expect(ids({ hasSolar: true })).not.toContain('solar');
    const withEv = buildInsights(input()).find((i) => i.id === 'solar')!;
    expect(withEv.body.en).toContain('With your EV');
    const noEv = buildInsights(input({ evStatus: 'NONE', evSince: null })).find((i) => i.id === 'solar')!;
    expect(noEv.body.en).not.toContain('With your EV');
    expect(noEv.saving).toBe(610);
  });

  it('gives a heat-pump tip or a thermostat tip, never both; the laundry tip only on dynamic prices', () => {
    expect(ids({ hasHeatPump: true })).toContain('heatpump');
    expect(ids({ hasHeatPump: true })).not.toContain('thermostat');
    expect(ids({ hasHeatPump: false })).toContain('thermostat');
    expect(ids({ hasHeatPump: false })).not.toContain('heatpump');
    expect(ids({ product: 'DYNAMIC' })).toContain('laundry');
    expect(ids({ product: 'DYNAMIC_FIXED_GAS' })).toContain('laundry');
    expect(ids({ product: 'FIXED' })).not.toContain('laundry');
    expect(ids({ product: 'VARIABLE' })).not.toContain('laundry');
    expect(buildInsights(input({ product: 'FIXED' })).find((i) => i.id === 'ev-peak')?.body.en).not.toContain('dynamic tariff');
  });

  it('every insight has English and Dutch text, a unique id and a sensible saving', () => {
    const variants: Opts[] = [
      {},
      { evStatus: 'ENROLLED', hasSolar: true, hasHeatPump: true, product: 'FIXED', expectedSettlement: 0 },
      { evStatus: 'NONE', evSince: null, product: 'VARIABLE', expectedSettlement: 500 },
    ];
    for (const v of variants) {
      const list = buildInsights(input(v));
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
      for (const i of list) {
        for (const text of [i.title, i.body, ...(i.cta ? [i.cta] : []), ...(i.detail ? [i.detail] : [])]) {
          expect(text.en.trim().length).toBeGreaterThan(0);
          expect(text.nl.trim().length).toBeGreaterThan(0);
        }
        expect(i.title.en).not.toBe(i.title.nl);
        expect(i.body.en).not.toBe(i.body.nl);
        expect(i.saving === null || i.saving > 0).toBe(true);
        if (i.route !== null) expect(i.route.startsWith('/')).toBe(true);
        expect(`${i.title.en}${i.body.en}${i.title.nl}${i.body.nl}`).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('is deterministic for the same input', () => {
    expect(buildInsights(input())).toEqual(buildInsights(input()));
  });
});
