import { useState } from 'react';

export interface Paged<T> {
  rows: T[];
  page: number;
  pages: number;
  total: number;
  setPage: (page: number) => void;
}

/**
 * One page of a list. The page is clamped when the list gets shorter (a filter was applied),
 * so the table never shows an empty page.
 */
export function usePaged<T>(all: T[], size: number): Paged<T> {
  const [wanted, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(wanted, pages);
  return { rows: all.slice((page - 1) * size, page * size), page, pages, total: all.length, setPage };
}
