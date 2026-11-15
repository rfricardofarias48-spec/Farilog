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
          50: '#FFF7F4',
          100: '#FFE6D9',
          200: '#FFD9CC',
          300: '#FFD9CC',
          400: '#FF4D0C',
          500: '#FF4D0C',
          600: '#E03A00',
          700: '#C2410C',
        },
        navy: {
          950: '#0B0B0B',
          900: '#0B0B0B',
          800: '#1C1C1C',
          700: '#2A2A2A',
        },
        surface: {
          DEFAULT: '#F5F5F5',
          sunken: '#F7F7F7',
          raised: '#FFFFFF',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11, 11, 11, 0.04), 0 8px 24px -12px rgba(11, 11, 11, 0.10)',
        lift: '0 2px 4px rgba(11, 11, 11, 0.05), 0 16px 32px -12px rgba(11, 11, 11, 0.14)',
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
