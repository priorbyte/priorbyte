/**
 * Cyber-Academic palette, kept in exact sync with web/tailwind.config.ts and
 * shared/src/brand.ts. Plain constants (not CSS variables — React Native has
 * no equivalent) consumed via StyleSheet.create in every screen.
 */
export const COLORS = {
  background: '#131313',
  surface: '#0E0E0E',
  surfaceRaised: '#201F1F',
  line: '#464932',
  muted: '#C7C9AB',
  silver: '#E5E2E1',
  white: '#FFFFFF',
  cyan: '#D8EF00',
  teal: '#00BFA5',
  amber: '#FFAB00',
} as const;

export const FONTS = {
  display: 'Anton_400Regular',
  sans: 'JetBrainsMono_400Regular',
  sansBold: 'JetBrainsMono_700Bold',
  label: 'SpaceGrotesk_500Medium',
  labelBold: 'SpaceGrotesk_700Bold',
} as const;

export const SPACING = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
