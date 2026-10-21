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
        // Matxxa Modern Wellness Theme
        primary: {
          DEFAULT: '#2E7D4A',
          hover: '#256A3E',
          soft: '#EAF5EC',
          light: '#F0F8F2',
          dark: '#1C5430',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F6F8F4',
          muted: '#EEF2EC',
          border: '#E5EBE5',
          borderSubtle: '#EDF2EC',
        },
        content: {
          primary: '#1C2B20',
          secondary: '#66756B',
          tertiary: '#94A399',
          inverse: '#FFFFFF',
        },
        status: {
          success: '#2E9B62',
          successBg: '#EBF8F1',
          warning: '#F2A93B',
          warningBg: '#FEF6E9',
          danger: '#E05B55',
          dangerBg: '#FDF0EF',
          info: '#4285D4',
          infoBg: '#EDF4FC',
        },
        // Botanical accents
        botanical: {
          cream: '#FCFBF7',
          sage: '#D2E3CD',
          mint: '#B4DFC4',
          forest: '#2E7D4A',
          leaf: '#41955F',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', '"Inter"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(28, 43, 32, 0.04)',
        'card': '0 4px 20px -2px rgba(28, 43, 32, 0.05), 0 2px 6px -1px rgba(28, 43, 32, 0.03)',
        'card-hover': '0 12px 28px -4px rgba(46, 125, 74, 0.10), 0 4px 10px -2px rgba(28, 43, 32, 0.04)',
        'dropdown': '0 10px 32px -4px rgba(28, 43, 32, 0.12), 0 0 0 1px rgba(229, 235, 229, 0.8)',
        'modal': '0 24px 60px -12px rgba(28, 43, 32, 0.20), 0 0 0 1px rgba(229, 235, 229, 0.6)',
        'drawer': '-10px 0 35px -5px rgba(28, 43, 32, 0.12)',
        'primary-glow': '0 4px 14px 0 rgba(46, 125, 74, 0.25)',
      },
      borderRadius: {
        'xl': '14px',
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
