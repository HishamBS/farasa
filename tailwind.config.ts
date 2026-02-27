import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx,css}'],
  theme: {
    extend: {
      colors: {
        bg: {
          root: 'var(--bg-root)',
          surface: 'var(--bg-surface)',
          glass: 'var(--bg-glass)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          ghost: 'var(--text-ghost)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          default: 'var(--border-default)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
}

export default config
