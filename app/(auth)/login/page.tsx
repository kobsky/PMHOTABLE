import type { Metadata } from 'next'
import { LoginForm } from '@/components/compass/login-form'

export const metadata: Metadata = { title: 'Zaloguj się' }

export default function LoginPage() {
  return (
    <div className="animate-slide-up">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 border border-compass-border rounded-[3px] mb-4 bg-compass-surface">
          <CompassIcon />
        </div>
        <h1 className="font-display text-2xl font-semibold text-compass-text tracking-tight">
          Hotable Compass
        </h1>
        <p className="mt-1 text-sm text-compass-muted font-body">
          Narzędzie PM dla zespołu
        </p>
      </div>

      {/* Karta logowania */}
      <div className="compass-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-compass-text">
            Zaloguj się
          </h2>
          <p className="mt-1 text-xs text-compass-muted">
            Wprowadź email i hasło przypisane do Twojego konta.
          </p>
        </div>
        <LoginForm />
      </div>

      <p className="mt-4 text-center font-mono text-2xs text-compass-dim uppercase tracking-widest">
        Hotable Sp. z o.o. · Tylko dla zespołu
      </p>
    </div>
  )
}

function CompassIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#E8622A"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}
