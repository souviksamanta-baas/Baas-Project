/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          background: '#FAFBFA',
          border: '#DDE5EA',
          navy: '#101935',
          primary: '#0A9E56',
          soft: '#F3FBF7',
          slate: '#4B536A',
        },
      },
      boxShadow: {
        card: '0 2px 12px rgba(16, 25, 53, 0.06)',
        dock: '0 16px 40px rgba(16, 25, 53, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
