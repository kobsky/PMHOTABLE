import type { Metadata } from 'next'
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    template: '%s — Compass',
    default: 'Hotable Compass',
  },
  description: 'Wewnętrzne narzędzie PM dla Hotable Sp. z o.o.',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="pl"
      className={`${fraunces.variable} ${jakarta.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1E1E1C',
              border: '1px solid #2A2A27',
              color: '#EAE8DF',
              borderRadius: '3px',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
            },
          }}
        />
      </body>
    </html>
  )
}
