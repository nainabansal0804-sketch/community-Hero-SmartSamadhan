/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e2d40',
        'primary-dark': '#16212f',
        'primary-light': '#25384f',
        accent: '#c9a84c',
        'accent-light': '#d9b96a',
        'accent-dark': '#ae8f3c',
        cream: '#f8f5ee',
        'cream-dark': '#eee8d9',
        muted: '#6b7280',
        dark: '#2c2c2c',
      },
      fontFamily: {
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'fade-up': 'fadeUp 0.7s ease-out forwards',
        'slide-in': 'slideIn 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'soft': '0 4px 24px rgba(30, 45, 64, 0.08)',
        'card': '0 2px 16px rgba(30, 45, 64, 0.10)',
        'hover': '0 8px 32px rgba(30, 45, 64, 0.15)',
      },
    },
  },
  plugins: [],
}
