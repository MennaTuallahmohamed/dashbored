/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        arabic: ['"Tajawal"', 'system-ui', 'ui-sans-serif', 'Segoe UI', 'Arial'],
      },
    },
  },
  plugins: [],
};


