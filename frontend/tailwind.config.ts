import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: '#F7F7F6',
          dark: '#111113',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#18181B',
        },
        border: {
          light: '#E4E4E7',
          dark: '#2A2A2E',
        },
        brand: {
          50: '#EFF6FF',
          500: '#3B6E5C',
          600: '#2F5A4A',
          700: '#24463A',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
