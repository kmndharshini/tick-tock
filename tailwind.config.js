/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        hour: {
          DEFAULT: '#E05A2B',
          dark: '#B8431B',
          soft: '#FFF0EA',
        },
        minute: {
          DEFAULT: '#1D6FA5',
          dark: '#14527C',
          soft: '#EAF5FC',
        },
        surface: {
          DEFAULT: '#FFFDF8',
          card: '#FFFFFF',
          muted: '#F3EFE6',
        },
        ink: {
          DEFAULT: '#1C2430',
          muted: '#4A5568',
        },
      },
      fontFamily: {
        sans: ['"Nunito"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

