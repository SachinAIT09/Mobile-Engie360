import { useState } from 'react';

/** Rows-per-page choices offered under every table; 10 is the default. */
export const PAGE_SIZES = [10, 15, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export interface Paged<T> {
  rows: T[];
  page: number;
  pages: number;
  total: number;
  size: number;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
}

/**
 * One page of a list, with a rows-per-page choice. The page is clamped when the list gets shorter
 * (a filter was applied) and goes back to 1 when the page size changes.
 */
export function usePaged<T>(all: T[], initialSize: number = DEFAULT_PAGE_SIZE): Paged<T> {
  const [wanted, setPage] = useState(1);
  const [size, setSizeState] = useState(initialSize);
  const pages = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(wanted, pages);
  const setSize = (next: number) => {
    setSizeState(next);
    setPage(1);
  };
  return { rows: all.slice((page - 1) * size, page * size), page, pages, total: all.length, size, setPage, setSize };
}
