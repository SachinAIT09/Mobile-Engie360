/**
 * Design tokens for the customer app (and shared chart colours).
 *
 * ENGIE Netherlands look: ENGIE blue for headers and primary actions, sky-blue accent, the cyan-to-teal
 * edge gradient, the yellow call-to-action and Lato. Names are kept stable so every screen can read
 * `colors.primary` etc.
 */
export const colors = {
  // brand
  navy: '#0B2240',
  navyDeep: '#071833',
  navyMid: '#123A66',
  brandBlue: '#007ACD',
  primary: '#007ACD',
  primaryDark: '#005EA0',
  primaryTint: '#E5F2FB',
  primarySelectedBg: '#F0F7FD',
  accent: '#00AAFF',
  accentDark: '#009DE9',
  accentTint: '#E6F6FF',
  teal: '#23D2B5',
  tealDark: '#0F8F7A',
  tealTint: '#E3FAF5',
  cta: '#FFCC59',
  onCta: '#171D21',
  purple: '#7B61FF',
  // neutrals
  bg: '#F4F7FA',
  surface: '#FFFFFF',
  surfaceTint: '#F7F9FB',
  inputTint: '#EEF5FB',
  text: '#0B2240',
  textBody: '#33475E',
  textMuted: '#5F7189',
  border: '#E3E9F0',
  borderInput: '#CFDAE6',
  divider: '#EEF2F6',
  subtle: '#E3E8EE',
  headerMuted: '#CDE6F7',
  logoDash: '#8FA6C4',
  // semantic
  electricity: '#00AAFF',
  gas: '#FF8A3D',
  gasTint: '#FFF1E7',
  solar: '#FFC845',
  onSolar: '#2B1A00',
  solarTint: '#FFF6E3',
  solarText: '#5C3B00',
  ev: '#7B61FF',
  evDeep: '#2A1F66',
  evTint: '#F0EDFF',
  evTintSoft: '#F7F5FF',
  evBorder: '#D7CFFF',
  evText: '#4B36C4',
  evHeaderText: '#E4DFFA',
  knownText: '#9A5B00',
  unenrolledText: '#4A3BB0',
  grid: '#5F7189',
  gridLine: '#8A96A6',
  successText: '#13855F',
  successBg: '#E2F6EE',
  success: '#22A06B',
  warningText: '#A35A00',
  warningBg: '#FFF3DF',
  alertHeader: '#7A3E00',
  alertHeaderText: '#FFD9A8',
  dangerText: '#C22F3C',
  dangerBg: '#FDEBED',
  danger: '#E5484D',
  outageText: '#B45309',
  splitPending: '#C3CCD8',
} as const;

/** Dark-mode overrides for the customer app (same keys as `colors`). */
export const darkColors: Record<keyof typeof colors, string> = {
  ...colors,
  primary: '#33A7F0',
  primaryDark: '#5BB8F3',
  primaryTint: '#12304D',
  primarySelectedBg: '#132A42',
  accentTint: '#0F2E45',
  tealTint: '#0E3330',
  bg: '#0B1624',
  surface: '#132235',
  surfaceTint: '#18293E',
  inputTint: '#1A2D44',
  text: '#EAF1F8',
  textBody: '#C3D1E0',
  textMuted: '#8EA2B8',
  border: '#22364D',
  borderInput: '#2E4560',
  divider: '#1D3046',
  subtle: '#22364D',
  gasTint: '#3A2414',
  solarTint: '#3A2F12',
  solarText: '#FFD98A',
  evTint: '#251F4D',
  evTintSoft: '#1E1A3D',
  evBorder: '#3E3480',
  evText: '#C2B6FF',
  successText: '#4FD1A0',
  successBg: '#0F3328',
  warningText: '#FFC170',
  warningBg: '#3A2A12',
  dangerText: '#FF8A92',
  dangerBg: '#3A1A1E',
};

export type Palette = typeof darkColors;

/** Two-stop gradients (start → end): primary buttons, the ENGIE edge stripe and hero headers. */
export const gradients = {
  primary: ['#007ACD', '#009DE9'],
  accent: ['#00AAFF', '#23D2B5'],
  edge: ['#00AAFF', '#23D2B5'],
  hero: ['#007ACD', '#0A8FD8'],
} as const;

export const radii = { card: 16, cardSm: 12, button: 999, buttonSm: 999, pill: 999, input: 12 } as const;

export const fonts = {
  body: 'Lato',
  mono: 'IBM Plex Mono',
} as const;

export const shadows = {
  card: '0 1px 2px rgba(11, 34, 64, 0.05), 0 6px 20px rgba(11, 34, 64, 0.06)',
  cardHover: '0 10px 30px rgba(11, 34, 64, 0.10)',
  button: '0 8px 20px rgba(0, 122, 205, 0.28)',
} as const;

export type ColorToken = keyof typeof colors;
