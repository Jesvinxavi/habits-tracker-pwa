/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sf: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        'ios-blue': '#007AFF',
        'ios-red': '#FF3B30',
        'ios-green': '#34C759',
        'ios-orange': '#FF9500',
        'ios-purple': '#AF52DE',
        'ios-gray': '#8E8E93',
        'ios-bg': '#FFFFFF',
        'ios-bg-dark': '#000000',
        'ios-surface': '#FFFFFF',
        'ios-surface-dark': '#1C1C1E',
      },
      backdropBlur: {
        ios: '20px',
      },
      boxShadow: {
        ios: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
        'ios-lg': '0 4px 6px rgba(0, 0, 0, 0.07), 0 10px 15px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  darkMode: ['class', '[data-theme="dark"]'],
  plugins: [
    function ({ addUtilities }) {
      const newUtilities = {
        '.home-inset': {
          'margin-left': 'var(--home-inset)',
          'margin-right': 'var(--home-inset)',
        },
        '.home-inset-plus': {
          'margin-left': 'calc(var(--home-inset) + 8px)',
          'margin-right': 'calc(var(--home-inset) + 8px)',
        },
      };
      addUtilities(newUtilities);
    },
  ],
};
