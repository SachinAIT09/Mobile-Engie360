import { colors, gradients } from '@engie/shared';

export { colors, gradients };

/** Font family names registered by useFonts in the root layout (Lato, IBM Plex Mono for IDs). Lato has no 500/600, so those map to regular/bold. */
export const font = {
  regular: 'Lato_400Regular',
  medium: 'Lato_400Regular',
  semibold: 'Lato_700Bold',
  bold: 'Lato_700Bold',
  extrabold: 'Lato_900Black',
  mono: 'IBMPlexMono_500Medium',
} as const;

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/** Soft card shadow used on white cards over the grey page background. */
export const shadowCard = {
  shadowColor: '#0B2240',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

/** Stronger shadow for floating elements (sheets, the tab-bar action button, primary buttons). */
export const shadowFloat = {
  shadowColor: '#0B2240',
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
} as const;

/** react-native-web's Switch reads activeThumbColor (not in RN's types); keeps the thumb white on web. */
export const webSwitchProps = { activeThumbColor: '#FFFFFF' } as object;

/** Gradient props shared by primary buttons and hero headers. */
export const gradientProps = {
  primary: { colors: [...gradients.primary] as [string, string], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  accent: { colors: [...gradients.accent] as [string, string], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  hero: { colors: [...gradients.hero] as [string, string], start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
} as const;
