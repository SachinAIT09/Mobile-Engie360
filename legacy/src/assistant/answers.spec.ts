import { describe, expect, it } from 'vitest';
import { reply } from './mockProvider';
import type { AssistantContext } from './types';

const customer: AssistantContext = { lang: 'en', route: '/', audience: 'customer' };
const nl: AssistantContext = { ...customer, lang: 'nl' };
const visitor: AssistantContext = { ...customer, audience: 'visitor', route: '/website' };

describe('customer answers', () => {
  it('this month usage comes from the demo month', () => {
    const r = reply('How much energy did I consume this month?', customer);
    expect(r.intent).toBe('USAGE');
    expect(r.text).toContain('171 kWh');
    expect(r.followUps?.length).toBeGreaterThan(0);
  });

  it('a named month uses that month', () => {
    const r = reply('How much did I use in September?', customer);
    expect(r.text).toContain('September 2026');
    expect(r.text).toContain('274 kWh');
  });

  it('"and last month?" continues the usage topic with October', () => {
    const r = reply('and last month?', { ...customer, lastIntent: 'USAGE' });
    expect(r.intent).toBe('USAGE');
    expect(r.text).toContain('October 2026');
    expect(r.text).toContain('307 kWh');
  });

  it('why-higher explains October with EV charging by default', () => {
    const r = reply('Why is my energy bill higher this month?', customer);
    expect(r.text).toContain('12% higher');
    expect(r.text).toContain('EV charging');
    expect(r.chart).toBe('breakdown');
  });

  it('why-higher for another month is data-driven', () => {
    const r = reply('Why was my bill higher in December?', customer);
    expect(r.text).toMatch(/December/);
    expect(r.text).toMatch(/gas went from 128 to 171/);
  });

  it('a cheaper month is reported as good news', () => {
    expect(reply('Why was my bill higher in May?', customer).text).toContain('cheaper');
  });

  it('invoices by month and the annual statement', () => {
    expect(reply('Show me my October invoice', customer).text).toContain('TN-202610-48283');
    expect(reply('Explain my annual statement', customer).text).toContain('JN-2026-03-10422');
    expect(reply('Can you explain my latest invoice?', customer).text).toContain('October 2026');
  });

  it('answers in Dutch', () => {
    const r = reply('Wanneer wordt mijn automatische incasso afgeschreven?', nl);
    expect(r.intent).toBe('PAYMENT');
    expect(r.text).toContain('28 november');
  });

  it('every answer carries the intent and has text', () => {
    for (const q of ['hi', 'thanks', 'solar', 'contract', 'meter', 'storing', 'verhuizen', 'agent', 'green', 'xyz']) {
      const r = reply(q, customer);
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.intent).toBeTruthy();
    }
  });
});

describe('visitor answers', () => {
  it('personal questions ask the visitor to sign in', () => {
    const r = reply('Why is my energy bill higher this month?', visitor);
    expect(r.text).toContain('signed in');
    expect(r.actions?.[0]?.signIn).toBe(true);
  });

  it('contract questions describe the products, not the demo customer', () => {
    const r = reply('I want a fixed contract', visitor);
    expect(r.text).toContain('Fixed Electricity & Gas');
    expect(r.text).not.toContain('Sanne');
  });
});
