/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        botanical: {
          cream: '#FFFAF5',
          chamomile: '#F9EDB2',
          sage: '#C7D9B5',
          olive: '#94AB71',
          forest: '#385723',
          midnight: '#001910',
        },
        background: {
          DEFAULT: '#001910',
          subtle: '#062016',
          card: 'rgba(7, 28, 19, 0.82)',
          glass: 'rgba(10, 36, 25, 0.65)',
          elevated: 'rgba(14, 44, 30, 0.9)',
        },
        border: {
          subtle: 'rgba(199, 217, 181, 0.12)',
          glow: 'rgba(148, 171, 113, 0.35)',
          active: 'rgba(199, 217, 181, 0.28)',
        },
        accent: {
          blue: '#94AB71',
          cyan: '#C7D9B5',
          violet: '#94AB71',
          indigo: '#385723',
          emerald: '#385723',
          amber: '#F9EDB2',
          rose: '#D97757',
        },
        text: {
          primary: '#FFFAF5',
          secondary: '#C7D9B5',
          muted: '#8A9E7A',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 25, 16, 0.65)',
        'glass-hover': '0 12px 40px 0 rgba(0, 25, 16, 0.85), 0 0 20px 0 rgba(148, 171, 113, 0.25)',
        'glow-cyan': '0 0 25px -5px rgba(199, 217, 181, 0.45)',
        'glow-violet': '0 0 25px -5px rgba(148, 171, 113, 0.45)',
        'glow-blue': '0 0 25px -5px rgba(56, 87, 35, 0.5)',
        'glow-emerald': '0 0 25px -5px rgba(56, 87, 35, 0.5)',
        'glow-gold': '0 0 25px -5px rgba(249, 237, 178, 0.4)',
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
