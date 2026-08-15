import type { Config } from 'tailwindcss';

/**
 * Design tokens.
 *
 * The palette is taken from the visual world of an Egyptian clinic rather than
 * the usual medical-SaaS blue: the deep green of a pharmacy cross, the cool
 * grey-green of examination-room paper, and an amber reserved exclusively for
 * "waiting" — the one state everyone in a clinic cares about.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#10241C', muted: '#4A5C54', faint: '#7C8A83' },
        clinic: { DEFAULT: '#146B4E', deep: '#0C4633', light: '#E4EFE9' },
        paper: { DEFAULT: '#EEF0EA', card: '#FFFFFF', sunk: '#E4E7DF' },
        signal: { DEFAULT: '#B4700F', light: '#FBF0DC' },
        clay: { DEFAULT: '#A33B2A', light: '#F8E7E3' },
        edge: { DEFAULT: '#D6DAD1', strong: '#BDC4B9' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      borderRadius: { card: '0.75rem' },
      boxShadow: {
        card: '0 1px 2px rgba(16,36,28,0.04), 0 8px 24px -12px rgba(16,36,28,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
