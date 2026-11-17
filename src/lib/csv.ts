import { saveBlob } from './download';

type Cell = string | number | null | undefined;

const quote = (v: Cell) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows → CSV text (first row is the header). */
export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(quote).join(',')).join('\r\n');

/** Download rows as a .csv file (with a BOM so Excel reads accents and € correctly). */
export function downloadCsv(filename: string, rows: Cell[][]): void {
  saveBlob(new Blob([String.fromCharCode(0xfeff) + toCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename, '.csv');
}
