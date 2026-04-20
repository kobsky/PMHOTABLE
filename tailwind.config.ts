import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        compass: {
          bg: '#0F0F0E',
          surface: '#171715',
          'surface-2': '#1E1E1C',
          'surface-3': '#262623',
          border: '#2A2A27',
          'border-strong': '#3A3A36',
          text: '#EAE8DF',
          muted: '#A8A49A',
          dim: '#7A766E',
          accent: '#E8622A',
          'accent-hover': '#F07238',
          'accent-dim': 'rgba(232,98,42,0.12)',
          success: '#4BAF87',
          'success-dim': 'rgba(75,175,135,0.12)',
          warning: '#F5A83A',
          'warning-dim': 'rgba(245,168,58,0.12)',
          danger: '#DE4040',
          'danger-dim': 'rgba(222,64,64,0.12)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        compass: '2px',
        sm: '2px',
        DEFAULT: '3px',
        md: '3px',
        lg: '4px',
      },
      animation: {
        'wip-pulse': 'wip-pulse 2.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        'wip-pulse': {
          '0%,100%': { borderColor: 'rgba(222,64,64,0.35)' },
          '50%': { borderColor: 'rgba(222,64,64,0.85)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [animate],
}

export default config
