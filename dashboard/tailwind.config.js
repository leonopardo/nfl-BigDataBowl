/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marino: '#013369',
        rojo: '#D50A0A',
        gris: '#777777',
      },
    },
  },
  plugins: [],
}