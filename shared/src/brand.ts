/**
 * Priorbyte brand system — "Cognitive Blueprint".
 * Single source of truth for colors and type. The Tailwind config in /web
 * and the extension UI both read from here so the palette never drifts.
 */

export const BRAND = {
  name: 'Priorbyte',
  tagline: 'Predict. Protect. Perfect.',
  oneLiner:
    'The first AI that predicts your future learning mistakes — and stops them before they happen.',
} as const;

export const COLORS = {
  /** Page background — deep navy */
  background: '#0B0E14',
  /** Primary accent — cyan */
  cyan: '#00E5FF',
  /** Protective / success — shield teal */
  teal: '#00BFA5',
  /** Warning / prediction alert — amber */
  amber: '#FFAB00',
  /** Body copy — silver */
  silver: '#B0BEC5',
} as const;

/** Derived surface tones, kept here so /web and /extension stay in sync. */
export const SURFACES = {
  /** Card / panel background, one step above the page */
  surface: '#111622',
  /** Raised element (hovered card, popover) */
  surfaceRaised: '#171E2E',
  /** Thin geometric line work */
  line: '#1F2937',
  /** Muted text on dark surfaces */
  muted: '#6B7A8F',
} as const;

export const FONTS = {
  /** Headlines */
  display: 'Sora',
  /** Body copy */
  body: 'Inter',
  /** Data, metrics, code */
  mono: 'JetBrains Mono',
} as const;

export type BrandColor = keyof typeof COLORS;
