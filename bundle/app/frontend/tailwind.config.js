/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Severity palette — Datadog/Honeycomb inspired
        severity: {
          fatal: '#e11d48',
          error: '#ef4444',
          warn: '#f59e0b',
          info: '#3b82f6',
          unclassified: '#6b7280',
          trace: '#8b5cf6',
        },
        // Surface palette
        surface: {
          0: '#0a0d14', // app background
          1: '#0f1320', // panel
          2: '#161b2c', // raised panel
          3: '#1f2538', // border / divider
        },
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'genie-pulse': {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        'live-ping': {
          '0%, 100%': { opacity: '0.75', transform: 'scale(1)' },
          '50%': { opacity: '0.15', transform: 'scale(2.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'pulse-soft': 'pulse 1.6s ease-in-out infinite',
        'genie-pulse': 'genie-pulse 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'live-ping': 'live-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
};
