/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
    "./src/**/*.{html,js}",
    "./index.html"
  ],
  darkMode: ['class', '[class~="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        dark: {
          100: '#1f1f1f',       // Lighter background (like Supabase sidebar)
          200: '#121212',       // Main background (like Supabase main area)
          300: '#2e2e2e',       // Slightly lighter (for hover states)
          400: '#3e3e3e',       // Border colors
          accent: '#0284c7',    // Primary blue accent (from primary-600)
          accent2: '#14FFEC',   // Bright accent for highlights only
        },
        teal: {
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          bright: '#14FFEC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} 