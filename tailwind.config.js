/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-subtle': 'bounceSubtle 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        bounceSubtle: {
          '0%, 20%, 53%, 100%': { transform: 'translateY(0)' },
          '40%, 43%': { transform: 'translateY(-6px)' },
          '70%': { transform: 'translateY(-3px)' },
          '90%': { transform: 'translateY(-1px)' },
        },
      },
      colors: {
        gray: {
          850: '#1f2937',
          950: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
