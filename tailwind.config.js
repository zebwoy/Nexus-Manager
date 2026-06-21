export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          950: '#031e30',
        },
        surface: {
          700: '#2d3545',
          800: '#1f2430',
          900: '#141720',
          950: '#0a0c10',
        }
      }
    }
  },
  plugins: [],
}
