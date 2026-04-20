'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-compass-bg px-6 animate-fade-in">
      <div className="flex flex-col items-center gap-5 max-w-sm text-center">
        <div className="font-display text-7xl font-semibold text-compass-surface-3 select-none leading-none">
          404
        </div>

        <div>
          <h1 className="font-display text-xl font-semibold text-compass-text mb-1.5">
            Strona nie istnieje
          </h1>
          <p className="text-sm text-compass-muted leading-relaxed">
            Szukana strona została usunięta, przeniesiona lub nigdy nie istniała.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/my-day" className="compass-btn-primary text-sm flex items-center gap-2">
            <Home size={13} strokeWidth={1.5} />
            Mój Dzień
          </Link>
          <button
            onClick={() => router.back()}
            className="compass-btn-outline text-sm flex items-center gap-2"
          >
            <ArrowLeft size={13} strokeWidth={1.5} />
            Wróć
          </button>
        </div>
      </div>
    </div>
  )
}
