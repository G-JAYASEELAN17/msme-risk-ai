/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#0C0A1D',
          main: '#0C0A1D',
          card: '#1C1933',
          surface: '#252141',
          elevated: '#30294D',
          border: '#383154',
          input: '#151229',
          primary: '#8B5CF6',
          hover: '#A78BFA',
          active: '#7C3AED',
          text: '#F5F3FF',
          muted: '#B7B1D1',
          focus: '#A78BFA',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#F87171',
          info: '#60A5FA',
        },
        violet: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
      },
      boxShadow: {
        'violet-sm': '0 2px 8px -2px rgba(139, 92, 246, 0.25)',
        'violet-md': '0 4px 16px -4px rgba(139, 92, 246, 0.35)',
        'violet-lg': '0 10px 25px -5px rgba(139, 92, 246, 0.40)',
      },
    },
  },
  plugins: [],
};
