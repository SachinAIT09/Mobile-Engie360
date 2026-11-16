import { describe, expect, it } from 'vitest';
import { MERGE_FIELDS, mergeFields, type MergeContext } from './merge.js';

const ctx: MergeContext = { firstName: 'Manny', incentive: '€25', eventWindow: '17:00–20:00', neighboursEnrolled: 69, installment: '€ 185', advisedInstallment: '€ 210' };

describe('mergeFields', () => {
  it('substitutes every supported field', () => {
    const text = 'Hi {first_name}, earn {incentive} by pausing {event_window}. {neighbours_enrolled} neighbours already joined.';
    expect(mergeFields(text, ctx)).toBe('Hi Manny, earn €25 by pausing 17:00–20:00. 69 neighbours already joined.');
  });

  it('replaces repeated occurrences of the same field', () => {
    expect(mergeFields('{first_name} {first_name}', ctx)).toBe('Manny Manny');
  });

  it('leaves unknown placeholders and plain text untouched', () => {
    expect(mergeFields('Hello {last_name}', ctx)).toBe('Hello {last_name}');
    expect(mergeFields('No fields here', ctx)).toBe('No fields here');
    expect(mergeFields('', ctx)).toBe('');
  });

  it('renders zero neighbours as "0"', () => {
    expect(mergeFields('{neighbours_enrolled}', { ...ctx, neighboursEnrolled: 0 })).toBe('0');
  });

  it('covers exactly the six documented merge fields', () => {
    expect([...MERGE_FIELDS]).toEqual(['{first_name}', '{incentive}', '{event_window}', '{neighbours_enrolled}', '{installment}', '{advised_installment}']);
    const all = MERGE_FIELDS.join(' ');
    expect(mergeFields(all, ctx)).toBe('Manny €25 17:00–20:00 69 € 185 € 210');
  });

  it('substitutes the installment fields and blanks them when absent', () => {
    expect(mergeFields('From {installment} to {advised_installment}', ctx)).toBe('From € 185 to € 210');
    const { installment: _i, advisedInstallment: _a, ...bare } = ctx;
    expect(mergeFields('[{installment}|{advised_installment}]', bare)).toBe('[|]');
  });
});
