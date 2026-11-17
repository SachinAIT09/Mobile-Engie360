/**
 * A small PDF writer for the documents the customer downloads (invoice, payment receipt): one A4 page laid
 * out like a real energy invoice: the brand wordmark, an address block, a details box, the line items, a
 * total bar, a payment note and a footer. Built by hand so nothing is fetched or bundled for it; it uses the
 * PDF standard fonts (Helvetica), which every reader has, and draws the wordmark as vector shapes.
 */

export interface PdfPair {
  label: string;
  value: string;
}

export interface PdfDocument {
  /** Document title in the file's properties. */
  title: string;
  /** Brand name: drawn as the wordmark (bold, brand blue, with the arc above it), as in the app. */
  brand: string;
  /** Short line next to the wordmark (the portal name). */
  tagline?: string;
  /** Document type, top right ("Invoice", "Payment receipt"). */
  kind: string;
  /** Status chip under the document type ("Paid", "Scheduled", "Open"). */
  status?: { label: string; tone: 'ok' | 'info' | 'warn' };
  /** Name and address block; the first line is the name. */
  address: string[];
  /** Details box on the right: number, dates, customer number. */
  details: PdfPair[];
  /** What the document is about ("Installment invoice · November 2026"). */
  heading: string;
  /** Small lines under the heading (product, connection numbers). */
  meta?: string[];
  /** Column titles of the table. */
  columns: [string, string];
  rows: PdfPair[];
  total: PdfPair;
  /** Small print under the total (VAT). */
  totalNote?: string;
  /** Highlighted note under the table: how and when it is paid. */
  callout?: { title: string; text: string };
  /** Footer lines (company line, where to get help). */
  footer: string[];
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const RIGHT = PAGE_W - MARGIN;

// Colours as PDF RGB triples.
const BLUE = '0 0.667 1';
const NAVY = '0.043 0.133 0.251';
const INK_2 = '0.2 0.278 0.369';
const MUTED = '0.39 0.46 0.55';
const LINE = '0.89 0.91 0.94';
const PANEL = '0.957 0.969 0.98';
const BLUE_SOFT = '0.91 0.965 1';
const TONES = { ok: { fill: '0.886 0.965 0.933', text: '0.075 0.522 0.373' }, info: { fill: BLUE_SOFT, text: '0 0.435 0.659' }, warn: { fill: '1 0.953 0.878', text: '0.635 0.38 0.02' } };

/** Characters outside Latin-1 that the standard (WinAnsi) encoding does have. */
const WIN_ANSI: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };

/** Number formats use non-breaking spaces ("€ 185,00" in Dutch); in the PDF they are ordinary spaces. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');

/** Text → hex string in WinAnsi, so no escaping is needed and every byte of the file is ASCII. */
function hex(text: string): string {
  let out = '';
  for (const ch of plain(text)) {
    const code = ch.codePointAt(0)!;
    const byte = WIN_ANSI[ch] ?? (code < 256 ? code : 0x3f);
    out += byte.toString(16).padStart(2, '0');
  }
  return `<${out}>`;
}

// Helvetica advance widths (1/1000 em) for ASCII 32–126, regular and bold; used to right-align and wrap.
const W_REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

/** Width of a line of text in points. Characters outside ASCII count as a digit's width (true for €). */
export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? W_BOLD : W_REGULAR;
  let units = 0;
  for (const ch of plain(text)) {
    const code = ch.codePointAt(0)!;
    units += code >= 32 && code <= 126 ? table[code - 32]! : 556;
  }
  return (units * size) / 1000;
}

/** Break a long line into lines that fit `width`. */
function wrap(text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of plain(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const n = (v: number) => v.toFixed(2);

/** The PDF file as text (ASCII only), ready to be saved as bytes. */
export function buildPdf(doc: PdfDocument): string {
  const ops: string[] = [];
  const text = (s: string, x: number, y: number, size: number, bold = false, rgb = NAVY, spacing = 0) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb} rg ${spacing} Tc ${n(x)} ${n(y)} Td ${hex(s)} Tj ET`);
  };
  /** Width including letter spacing. */
  const spaced = (s: string, size: number, bold: boolean, spacing: number) => textWidth(s, size, bold) + spacing * (plain(s).length - 1);
  const textRight = (s: string, xRight: number, y: number, size: number, bold = false, rgb = NAVY, spacing = 0) => text(s, xRight - spaced(s, size, bold, spacing), y, size, bold, rgb, spacing);
  const box = (x: number, y: number, w: number, h: number, rgb: string) => ops.push(`${rgb} rg ${n(x)} ${n(y)} ${n(w)} ${n(h)} re f`);
  const line = (x1: number, y1: number, x2: number, y2: number, weight = 0.6, rgb = LINE) => ops.push(`${weight} w ${rgb} RG ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`);

  // ---- brand: a blue band along the top edge, then the wordmark with its arc
  box(0, PAGE_H - 7, PAGE_W, 7, BLUE);
  const LOGO = 33;
  const LOGO_SPACING = 1.3;
  const logoY = PAGE_H - 78;
  const logoW = spaced(doc.brand, LOGO, true, LOGO_SPACING);
  text(doc.brand, MARGIN, logoY, LOGO, true, BLUE, LOGO_SPACING);
  const arcY = logoY + LOGO * 0.74 + 5;
  const ax = MARGIN - 3;
  const aw = logoW + 6;
  ops.push(`3.1 w 1 J ${BLUE} RG ${n(ax)} ${n(arcY)} m ${n(ax + aw * 0.22)} ${n(arcY + 11)} ${n(ax + aw * 0.78)} ${n(arcY + 11)} ${n(ax + aw)} ${n(arcY)} c S 0 J`);
  if (doc.tagline) {
    const tx = MARGIN + logoW + 14;
    line(tx, logoY - 3, tx, logoY + 25, 0.8);
    text(doc.tagline, tx + 12, logoY + 6, 11.5, true, MUTED);
  }

  // ---- document type and status, top right
  textRight(doc.kind, RIGHT, logoY + 6, 20, true);
  if (doc.status) {
    const tone = TONES[doc.status.tone];
    const label = doc.status.label.toUpperCase();
    const w = spaced(label, 8.5, true, 0.6) + 16;
    box(RIGHT - w, logoY - 20, w, 16, tone.fill);
    text(label, RIGHT - w + 8, logoY - 15.2, 8.5, true, tone.text, 0.6);
  }

  // ---- address (left) and details box (right)
  const top = PAGE_H - 150;
  let y = top;
  doc.address.forEach((a, i) => {
    text(a, MARGIN, y, 10.5, i === 0);
    y -= 15;
  });
  const boxW = 236;
  const boxX = RIGHT - boxW;
  const rowH = 17;
  const boxH = doc.details.length * rowH + 16;
  const boxBottom = top + 14 - boxH;
  box(boxX, boxBottom, boxW, boxH, PANEL);
  doc.details.forEach((d, i) => {
    const ry = top - i * rowH;
    text(d.label, boxX + 12, ry, 9.5, false, MUTED);
    textRight(d.value, RIGHT - 12, ry, 9.5, true);
  });

  // ---- heading
  y = Math.min(y, boxBottom) - 34;
  text(doc.heading, MARGIN, y, 15, true);
  y -= 17;
  for (const m of doc.meta ?? []) {
    text(m, MARGIN, y, 9, false, MUTED);
    y -= 13;
  }

  // ---- table
  y -= 12;
  box(MARGIN, y - 7, RIGHT - MARGIN, 22, PANEL);
  text(doc.columns[0].toUpperCase(), MARGIN + 10, y, 8.5, true, MUTED, 0.5);
  textRight(doc.columns[1].toUpperCase(), RIGHT - 10, y, 8.5, true, MUTED, 0.5);
  y -= 7;
  for (const r of doc.rows) {
    y -= 18;
    text(r.label, MARGIN + 10, y, 10.5);
    textRight(r.value, RIGHT - 10, y, 10.5);
    y -= 9;
    line(MARGIN, y, RIGHT, y);
  }

  // ---- total bar
  y -= 34;
  box(MARGIN, y, RIGHT - MARGIN, 30, BLUE_SOFT);
  box(MARGIN, y, 3, 30, BLUE);
  text(doc.total.label, MARGIN + 13, y + 10.5, 12, true);
  textRight(doc.total.value, RIGHT - 10, y + 10, 13.5, true);
  if (doc.totalNote) {
    y -= 14;
    textRight(doc.totalNote, RIGHT - 10, y, 8.5, false, MUTED);
  }

  // ---- how it is paid
  if (doc.callout) {
    const lines = wrap(doc.callout.text, 10, RIGHT - MARGIN - 28);
    const h = 30 + lines.length * 14;
    y -= 22 + h;
    box(MARGIN, y, RIGHT - MARGIN, h, PANEL);
    let ly = y + h - 19;
    text(doc.callout.title, MARGIN + 14, ly, 10.5, true);
    for (const l of lines) {
      ly -= 14;
      text(l, MARGIN + 14, ly, 10, false, INK_2);
    }
  }

  // ---- footer
  const footTop = 40 + (doc.footer.length - 1) * 11.5;
  line(MARGIN, footTop + 14, RIGHT, footTop + 14);
  doc.footer.forEach((f, i) => text(f, MARGIN, footTop - i * 11.5, 8.5, false, MUTED));
  textRight('1 / 1', RIGHT, footTop, 8.5, false, MUTED);

  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Title ${hex(doc.title)} /Author ${hex(doc.brand)} /Producer ${hex(doc.brand)} >>`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

/** Build the document and hand it to the browser as a .pdf download. */
export function downloadPdf(filename: string, doc: PdfDocument): void {
  const url = URL.createObjectURL(new Blob([buildPdf(doc)], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
