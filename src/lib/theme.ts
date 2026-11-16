import { createContext, useContext } from 'react';

export type Theme = 'light' | 'dark';
/** What the user picked; "system" follows the device setting. */
export type ThemePref = Theme | 'system';
export const THEME_KEY = 'engie-demo-theme';

/**
 * Chart colours per theme. Recharts writes SVG attributes, which can't read CSS variables reliably,
 * so charts take these instead. Keep them in step with the tokens in styles/global.css.
 */
export const CHART = {
  light: { tick: '#64758b', grid: '#eef2f6', ink: '#0b2240', track: '#dfe6ee', cursor: 'rgba(0,170,255,0.06)', soft: '#bfe6fb' },
  dark: { tick: '#8fa1b8', grid: '#1f3149', ink: '#e8eef6', track: '#2a3d57', cursor: 'rgba(0,170,255,0.10)', soft: '#1d4a6e' },
} as const;

export type ChartColors = (typeof CHART)[Theme];

export function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* storage unavailable */
  }
  return 'light';
}

export const systemPrefersDark = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export interface ThemeState {
  /** The theme in effect (system resolved). */
  theme: Theme;
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  /** Shorthand for setPref with an explicit light/dark choice. */
  setTheme: (t: Theme) => void;
  chart: ChartColors;
}

export const ThemeCtx = createContext<ThemeState>({ theme: 'light', pref: 'light', setPref: () => {}, setTheme: () => {}, chart: CHART.light });

export const useTheme = () => useContext(ThemeCtx);
