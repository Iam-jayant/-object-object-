/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pharmaceutical-inspired palette: clean whites + clinical blues + trust greens
        brand: {
          navy:    '#083B66',
          blue:    '#0E5E9C',
          sky:     '#34A3DC',
          mint:    '#19A974',
          cloud:   '#F4F8FC',
        },
        primary: {
          50:  '#F2F8FD',
          100: '#E4F0FA',
          200: '#C8E1F5',
          300: '#9BCBEA',
          400: '#5FAEDB',
          500: '#2E86C1',
          600: '#0E5E9C',
          700: '#0A4A7A',
          800: '#083B66',
          900: '#072E4F',
          950: '#041D31',
        },
        surface: {
          50:  '#FFFFFF',
          100: '#F7FAFC',
          200: '#EEF3F8',
          300: '#E1EAF2',
          400: '#C7D6E4',
          500: '#9DB3C8',
          600: '#70899F',
          700: '#4C6478',
          800: '#2F4355',
          900: '#1A2C3C',
          950: '#0E1D2B',
        },
        success: '#199B6A',
        warning: '#C27B1B',
        danger:  '#B64040',
        cream:   '#F4F8FC',
      },
      fontFamily: {
        sans: ['Manrope', 'IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.6s ease-out forwards',
        'slide-up':   'slideUp 0.6s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(24px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:   {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  plugins: [],
}
