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
  /** Page background — Cyber-Academic near-black */
  background: '#131313',
  /** Primary accent — neon yellow-green (kept the `cyan` key name for
   * call-site compatibility across /web and /extension) */
  cyan: '#D8EF00',
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
  surface: '#0E0E0E',
  /** Raised element (hovered card, popover) */
  surfaceRaised: '#201F1F',
  /** Thin geometric line work */
  line: '#464932',
  /** Muted text on dark surfaces */
  muted: '#C7C9AB',
} as const;

export const FONTS = {
  /** Headlines */
  display: 'Anton',
  /** Body copy */
  body: 'JetBrains Mono',
  /** Data, metrics, code */
  mono: 'JetBrains Mono',
} as const;

export type BrandColor = keyof typeof COLORS;
