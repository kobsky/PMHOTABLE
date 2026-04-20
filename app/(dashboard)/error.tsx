'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[Compass Error]', error)
  }, [error])

  const isAuthError =
    error.message?.toLowerCase().includes('auth') ||
    error.message?.toLowerCase().includes('unauthorized') ||
    error.message?.toLowerCase().includes('not authenticated')

  const isNetworkError =
    error.message?.toLowerCase().includes('fetch') ||
    error.message?.toLowerCase().includes('network') ||
    error.message?.toLowerCase().includes('connection')

  function getTitle() {
    if (isAuthError) return 'Brak dostępu'
    if (isNetworkError) return 'Problem z połączeniem'
    return 'Coś poszło nie tak'
  }

  function getDescription() {
    if (isAuthError) return 'Twoja sesja wygasła lub nie masz uprawnień do tej strony.'
    if (isNetworkError) return 'Nie można połączyć się z serwerem. Sprawdź połączenie internetowe.'
    return error.message || 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.'
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-24 px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-compass-danger-dim border border-compass-danger/30 flex items-center justify-center">
          <AlertTriangle size={20} className="text-compass-danger" strokeWidth={1.5} />
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-compass-text mb-1.5">
            {getTitle()}
          </h2>
          <p className="text-sm text-compass-muted leading-relaxed">
            {getDescription()}
          </p>
          {error.digest && (
            <p className="font-mono text-2xs text-compass-dim mt-2 uppercase tracking-wide">
              kod: {error.digest}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="compass-btn-primary text-sm flex items-center gap-2"
          >
            <RefreshCw size={13} strokeWidth={1.5} />
            Spróbuj ponownie
          </button>

          {isAuthError ? (
            <Link href="/login" className="compass-btn-outline text-sm flex items-center gap-2">
              Zaloguj się
            </Link>
          ) : (
            <Link href="/my-day" className="compass-btn-outline text-sm flex items-center gap-2">
              <Home size={13} strokeWidth={1.5} />
              Strona główna
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
