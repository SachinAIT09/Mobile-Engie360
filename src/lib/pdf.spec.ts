import { describe, expect, it } from 'vitest';
import { buildPdf, textWidth, type PdfDocument } from './pdf';

const doc: PdfDocument = {
  title: 'TN-202611-48290',
  brand: 'ENGIE',
  tagline: 'MijnENGIE',
  kind: 'Invoice',
  status: { label: 'Scheduled', tone: 'info' },
  address: ['Olivia Carter', 'Lindelaan 24', '3581 AB Utrecht'],
  details: [
    { label: 'Invoice number', value: 'TN-202611-48290' },
    { label: 'Invoice date', value: '14 November 2026' },
    { label: 'Due date', value: '28 November 2026' },
    { label: 'Customer number', value: '2003 418 762' },
  ],
  heading: 'Installment invoice · November 2026',
  meta: ['Dynamic Electricity & Fixed Gas · Supply address: Lindelaan 24, 3581 AB Utrecht'],
  columns: ['Description', 'Amount'],
  rows: [
    { label: 'Advance payment electricity', value: '€72.15' },
    { label: 'Advance payment gas', value: '€112.85' },
  ],
  total: { label: 'Total', value: '€185.00' },
  totalNote: 'Amounts include 21% VAT (€32.11).',
  callout: { title: 'Automatic payment', text: 'We collect €185.00 on 28 November 2026 from your account NL91 ABNA 0417 •••• ••. You do not need to do anything.' },
  footer: ['ENGIE · MijnENGIE', 'Questions about this document? Ask Eva in the app, or look under Billing.'],
};

const hex = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

describe('buildPdf', () => {
  const pdf = buildPdf(doc);

  it('is a one-page PDF with the standard fonts', () => {
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('/Type /Catalog');
    expect(pdf).toContain('/Count 1');
    expect(pdf).toContain('/BaseFont /Helvetica-Bold');
    // Every byte is ASCII, so text length equals file length and the offsets below are byte offsets.
    expect([...pdf].every((c) => c.charCodeAt(0) < 128)).toBe(true);
  });

  it('has a cross-reference table that points at every object', () => {
    const start = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    const offsets = [...pdf.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(7);
    offsets.forEach((o, i) => expect(pdf.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    const length = Number(/\/Length (\d+)/.exec(pdf)![1]);
    const body = pdf.slice(pdf.indexOf('stream\n') + 7, pdf.indexOf('\nendstream'));
    expect(body.length).toBe(length);
  });

  it('draws the wordmark: the brand name in brand blue with the arc above it', () => {
    expect(pdf).toContain(`/F2 33 Tf 0 0.667 1 rg 1.3 Tc 50.00 764.00 Td <${hex('ENGIE')}> Tj`);
    expect(pdf).toMatch(/3\.1 w 1 J 0 0\.667 1 RG [\d. ]+ m [\d. ]+ c S/); // the arc is one curve
    expect(pdf).toContain(`<${hex('MijnENGIE')}>`);
  });

  it('writes every part of the invoice, with the euro sign in the PDF encoding', () => {
    for (const s of ['Invoice', 'SCHEDULED', 'Olivia Carter', 'Invoice number', 'TN-202611-48290', 'DESCRIPTION', 'AMOUNT', 'Advance payment gas', 'Total', 'Automatic payment', '1 / 1']) expect(pdf, s).toContain(`<${hex(s)}>`);
    expect(pdf).toContain(`<80${hex('185.00')}>`); // € is 0x80 in WinAnsi
    expect(pdf).toContain('95959595209595'); // the masked account number: • is 0x95
  });

  it('right-aligns amounts: digits all have the same width', () => {
    expect(textWidth('185.00', 10)).toBeCloseTo(textWidth('772.34', 10));
    expect(textWidth('€1', 10)).toBeCloseTo(11.12);
    expect(textWidth('Total', 12, true)).toBeGreaterThan(textWidth('Total', 12));
    // Dutch amounts carry a non-breaking space after the euro sign; it is written and measured as a space.
    expect(textWidth('€\u00a0185,00', 10)).toBeCloseTo(textWidth('€ 185,00', 10));
    expect(buildPdf({ ...doc, total: { label: 'Totaal', value: '€\u00a0185,00' } })).toContain(`<8020${hex('185,00')}>`);
  });
});
