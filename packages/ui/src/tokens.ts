/**
 * Design tokens.
 *
 * Deep obsidian base, warm off-white surfaces, a refined gold used sparingly,
 * emerald for progress, an accessible coral for problems. Every pairing in the
 * light and dark palettes meets WCAG AA for body text (4.5:1) and AA-large for
 * display type; the contrast test in tests/unit keeps it that way.
 */

export const palette = {
  obsidian: {
    900: '#08090B',
    800: '#0B0C0E',
    700: '#121417',
    600: '#191C21',
    500: '#22262D',
    400: '#2E333B',
    300: '#3C424C',
  },
  bone: {
    50: '#FCFBF9',
    100: '#F6F4F0',
    200: '#EDEAE4',
    300: '#DFDAD1',
    400: '#C3BCB0',
  },
  gold: {
    600: '#8F6F2E',
    500: '#B08C41',
    400: '#C8A45C',
    300: '#DCC08A',
    200: '#F0E2C4',
  },
  emerald: {
    600: '#1B7C57',
    500: '#22996A',
    400: '#2FBF87',
    300: '#7FD9B4',
  },
  coral: {
    600: '#B33F35',
    500: '#CC5045',
    400: '#E2685C',
    300: '#F0A69E',
  },
  amber: {
    500: '#B7791F',
    400: '#D69E2E',
  },
} as const;

export const typography = {
  fontFamily:
    "'Manrope', 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  scale: {
    display: '3.25rem',
    h1: '2.25rem',
    h2: '1.625rem',
    h3: '1.25rem',
    body: '1rem',
    small: '0.875rem',
    micro: '0.75rem',
  },
} as const;

export const motion = {
  /** Page transitions: fast enough to feel instant, slow enough to read. */
  page: '220ms',
  card: '180ms',
  press: '120ms',
  ring: '900ms',
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const radii = {
  sm: '8px',
  md: '12px',
  lg: '18px',
  xl: '26px',
  pill: '999px',
} as const;

/** Chart series colours: distinguishable in both themes and for common CVD. */
export const chartSeries = [
  palette.gold[400],
  palette.emerald[400],
  '#6EA8FE',
  palette.coral[400],
  '#B79CED',
  palette.amber[400],
] as const;

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
