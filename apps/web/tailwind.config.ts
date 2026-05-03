import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Institucional — paleta sóbria
        background: '#f7f6f3',  // off-white / parchment
        surface:    '#ffffff',
        panel:      '#fbfaf7',  // slightly warmer
        border:     '#e2dfd8',
        ink:        '#1a1a1a',  // primary text
        muted:      '#5b6166',  // secondary text
        subtle:     '#8a8e93',
        // Identidade — azul petróleo + dourado refinado (Observatório do Senado)
        primary:    '#0F3D5C',  // azul petróleo institucional
        'primary-hover': '#0a2c44',
        accent:     '#C9A24B',  // dourado refinado (selo, links de destaque)
        'accent-hover': '#a8842f',
        // Estados
        success:    '#1e7d4a',
        warning:    '#b8860b',
        danger:     '#9b2c2c',
        info:       '#1e3a5f',
      },
      fontFamily: {
        serif: ['"Source Serif 4"', '"Source Serif Pro"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        institutional: '0.18em',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
