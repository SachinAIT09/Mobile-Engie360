type Cell = string | number | null | undefined;

const quote = (v: Cell) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Rows → CSV text (first row is the header). */
export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(quote).join(',')).join('\r\n');

/** Download rows as a .csv file (with a BOM so Excel reads accents and € correctly). */
export function downloadCsv(filename: string, rows: Cell[][]): void {
  const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
