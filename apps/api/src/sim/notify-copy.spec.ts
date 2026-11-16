import { describe, expect, it } from 'vitest';
import { NOTIFY_PRESETS, PROGRAM } from '@engie/shared';
import { MERGE_FIELDS } from '../campaigns/merge.js';
import { CAMPAIGN_COPY, EV_DETECTED_COPY, isPlainPreset, notifyCopy, type NotifyContext } from './notify-copy.js';

const nl: NotifyContext = { firstName: 'Sanne', peakWindow: '17:00–20:00', clock: '06:04', lang: 'nl' };
const en: NotifyContext = { ...nl, lang: 'en' };

describe('notifyCopy', () => {
  it('has copy in both languages for every plain preset in the catalogue', () => {
    const plain = NOTIFY_PRESETS.filter((p) => isPlainPreset(p.id));
    expect(plain.map((p) => p.id)).toEqual(['HEAT_PUMP_DETECTED', 'NIGHT_USAGE', 'CHEAP_HOURS', 'CHARGING_COMPLETE', 'ANNUAL_STATEMENT', 'METER_READING']);
    for (const p of plain) {
      if (!isPlainPreset(p.id)) continue;
      for (const ctx of [nl, en]) {
        const c = notifyCopy(p.id, ctx);
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.body.length).toBeGreaterThan(0);
        expect(c.body).not.toMatch(/\{|\}/);
      }
      expect(notifyCopy(p.id, nl).body).not.toBe(notifyCopy(p.id, en).body);
    }
  });

  it('fills in the customer name, peak window and clock', () => {
    expect(notifyCopy('HEAT_PUMP_DETECTED', nl).body).toContain('Hoi Sanne');
    expect(notifyCopy('ANNUAL_STATEMENT', en).body).toContain('Hi Sanne');
    expect(notifyCopy('CHEAP_HOURS', nl).body).toContain('17:00–20:00');
    expect(notifyCopy('CHARGING_COMPLETE', en).body).toContain('Finished at 06:04');
    expect(notifyCopy('CHARGING_COMPLETE', nl).body).toContain('Klaar om 06:04');
  });

  it('sets kind, category, route and call to action per preset', () => {
    expect(notifyCopy('HEAT_PUMP_DETECTED', en)).toMatchObject({ kind: 'HEAT_PUMP_DETECTED', category: 'Alerts', tag: 'Heat pump', cta: 'View insights', route: '/insights' });
    expect(notifyCopy('NIGHT_USAGE', nl)).toMatchObject({ kind: 'USAGE', tag: 'Verbruik', cta: 'Bekijk verbruik', route: '/usage' });
    expect(notifyCopy('CHEAP_HOURS', en)).toMatchObject({ kind: 'PRICE', cta: null });
    expect(notifyCopy('CHEAP_HOURS', en).route).toBeUndefined();
    expect(notifyCopy('CHARGING_COMPLETE', nl)).toMatchObject({ kind: 'CHARGING', tag: 'Slim Laden', cta: null, route: '/smart-charging' });
    expect(notifyCopy('ANNUAL_STATEMENT', nl)).toMatchObject({ kind: 'BILL', category: 'Billing', tag: 'Jaarnota', route: '/billing' });
    expect(notifyCopy('METER_READING', en)).toMatchObject({ kind: 'METER', category: 'Alerts', cta: null, route: '/usage' });
  });

  it('routes campaign and EV-detected presets elsewhere', () => {
    expect(isPlainPreset('FLEX_REQUEST')).toBe(false);
    expect(isPlainPreset('ENROLL_OFFER')).toBe(false);
    expect(isPlainPreset('INSTALLMENT_ADVICE')).toBe(false);
    expect(isPlainPreset('EV_DETECTED')).toBe(false);
    expect(isPlainPreset('ANNUAL_STATEMENT')).toBe(true);
  });
});

describe('CAMPAIGN_COPY', () => {
  it('has Dutch and English copy for the three campaign types, using only known merge fields', () => {
    expect(Object.keys(CAMPAIGN_COPY).sort()).toEqual(['ENROLL_OFFER', 'FLEX_REQUEST', 'INSTALLMENT_ADVICE']);
    const known: readonly string[] = MERGE_FIELDS;
    for (const byLang of Object.values(CAMPAIGN_COPY)) {
      for (const lang of ['nl', 'en'] as const) {
        const c = byLang[lang];
        expect(c.title.length).toBeGreaterThan(0);
        expect(c.cta.length).toBeGreaterThan(0);
        for (const field of `${c.title} ${c.body}`.match(/\{[a-z_]+\}/g) ?? []) expect(known).toContain(field);
      }
    }
  });

  it('uses the merge fields that belong to each type', () => {
    expect(CAMPAIGN_COPY.FLEX_REQUEST.nl.title).toContain('{event_window}');
    expect(CAMPAIGN_COPY.FLEX_REQUEST.en.body).toContain('{incentive}');
    expect(CAMPAIGN_COPY.ENROLL_OFFER.nl.body).toContain('{neighbours_enrolled}');
    expect(CAMPAIGN_COPY.ENROLL_OFFER.en.title).toContain(PROGRAM.name.en);
    for (const lang of ['nl', 'en'] as const) {
      expect(CAMPAIGN_COPY.INSTALLMENT_ADVICE[lang].body).toContain('{installment}');
      expect(CAMPAIGN_COPY.INSTALLMENT_ADVICE[lang].body).toContain('{advised_installment}');
    }
  });
});

describe('EV_DETECTED_COPY', () => {
  it('names the program and the sign-up incentive in both languages', () => {
    expect(EV_DETECTED_COPY.nl.tag).toBe('Slim Laden');
    expect(EV_DETECTED_COPY.nl.body).toContain(PROGRAM.signupIncentive.nl);
    expect(EV_DETECTED_COPY.en.body).toContain(PROGRAM.signupIncentive.en);
    expect(EV_DETECTED_COPY.nl.title).not.toBe(EV_DETECTED_COPY.en.title);
  });
});
