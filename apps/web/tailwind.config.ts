import type { Config } from 'tailwindcss';

/**
 * Design system của website Phước Hải.
 * Bảng màu lấy cảm hứng từ biển: xanh ngọc (primary), cát (sand), san hô (coral).
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    './src/generated/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sand: {
          50: '#fdfaf5',
          100: '#f9f2e5',
          200: '#f2e3c9',
          300: '#e8cea4',
          400: '#dbb276',
          500: '#d09a55',
        },
        coral: {
          50: '#fff4f2',
          100: '#ffe3de',
          200: '#ffc7bd',
          300: '#ff9f8f',
          400: '#f9705a',
          500: '#e5503a',
        },
        sea: {
          50: '#eefbfa',
          100: '#d3f5f2',
          200: '#a9e9e5',
          300: '#74d6d3',
          400: '#3fbcbb',
          500: '#23a0a1',
          600: '#1a8082',
          700: '#196668',
          800: '#195254',
          900: '#184546',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px -12px rgba(16, 24, 40, 0.18)',
        card: '0 1px 3px rgba(16, 24, 40, 0.06), 0 12px 32px -16px rgba(16, 24, 40, 0.24)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-up': 'fade-up 0.4s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, hsl(var(--primary)) 0%, #1a8082 45%, #0f4c4d 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
