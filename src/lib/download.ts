/** Hand a file made in the browser (a PDF, a CSV) to the browser's download. `extension` is added if missing. */
export function saveBlob(blob: Blob, filename: string, extension: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith(extension) ? filename : `${filename}${extension}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
