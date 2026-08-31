/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#FF4D0C',
          50: '#FFF4EF',
          100: '#FFE6D9',
          200: '#FFC9AD',
          300: '#FFA573',
          400: '#FF7A38',
          500: '#FF4D0C',
          600: '#E03A00',
          700: '#B82F00',
        },
        navy: {
          950: '#060F1E',
          900: '#0C1927',
          800: '#112237',
          700: '#1A3350',
        },
        surface: {
          DEFAULT: '#F4F5F7',
          sunken: '#F8FAFC',
          raised: '#FFFFFF',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px -12px rgba(15, 23, 42, 0.10)',
        lift: '0 2px 4px rgba(15, 23, 42, 0.05), 0 16px 32px -12px rgba(15, 23, 42, 0.14)',
        glow: '0 0 0 3.5px rgba(255, 77, 12, 0.12)',
        'glow-lg': '0 8px 24px -6px rgba(255, 77, 12, 0.45)',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-slow': 'pulseSlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}
