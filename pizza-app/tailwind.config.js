/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: '#5a1216', deep: '#3d0b0e' },
        red: { DEFAULT: '#c0161c', bright: '#e11b22' },
        gold: { DEFAULT: '#e8b53f', light: '#f6d67a', deep: '#b8842a' },
        cream: '#fdf6e9',
        charcoal: '#140809',
        ink: '#2b1416',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        oswald: ['Oswald', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      keyframes: {
        spin: { to: { transform: 'rotate(360deg)' } },
        floaty: { '0%,100%': { transform: 'translateY(0) rotate(0deg)' }, '50%': { transform: 'translateY(-16px) rotate(6deg)' } },
        raySpin: { to: { transform: 'translate(-50%,-50%) rotate(360deg)' } },
        waPulse: { '0%': { boxShadow: '0 0 0 0 rgba(37,211,102,.5)' }, '70%': { boxShadow: '0 0 0 16px rgba(37,211,102,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(37,211,102,0)' } },
      },
      animation: {
        floaty: 'floaty 6s ease-in-out infinite',
        'ray-spin': 'raySpin 60s linear infinite',
        'wa-pulse': 'waPulse 2.5s infinite',
      },
    },
  },
  plugins: [],
}
