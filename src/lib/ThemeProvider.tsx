import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CHART, THEME_KEY, ThemeCtx, readTheme, type Theme } from './theme';

/** Light by default; the choice is remembered and applied before paint by index.html. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme, chart: CHART[theme] }), [theme, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
