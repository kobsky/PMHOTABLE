'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { acceptInvite } from '@/app/actions/invites'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    acceptInvite(params.token).then((result) => {
      if (result.success) {
        setState('success')
        toast.success('Witaj w zespole Hotable! 🎉')
        setTimeout(() => router.push('/my-day'), 2000)
      } else {
        setState('error')
        setErrorMessage(result.error ?? 'Nieznany błąd')
      }
    })
  }, [params.token, router])

  return (
    <div className="min-h-screen bg-compass-bg flex items-center justify-center p-4">
      <div className="compass-card p-8 max-w-sm w-full text-center">
        {state === 'loading' && (
          <>
            <Loader2 size={32} className="text-compass-accent animate-spin mx-auto mb-4" />
            <p className="text-sm font-semibold text-compass-text mb-1">Akceptowanie zaproszenia...</p>
            <p className="text-xs text-compass-dim">Proszę czekać</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 size={32} className="text-compass-success mx-auto mb-4" />
            <p className="text-sm font-semibold text-compass-text mb-1">Dołączyłeś do zespołu!</p>
            <p className="text-xs text-compass-dim">Przekierowuję do dashboardu...</p>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle size={32} className="text-compass-danger mx-auto mb-4" />
            <p className="text-sm font-semibold text-compass-text mb-2">Zaproszenie nieważne</p>
            <p className="text-xs text-compass-muted mb-5">{errorMessage}</p>
            <div className="space-y-2">
              <Link
                href="/my-day"
                className="block compass-btn-primary text-sm px-4 py-2"
              >
                Przejdź do aplikacji
              </Link>
              <Link
                href="/login"
                className="block text-xs text-compass-dim hover:text-compass-muted transition-colors"
              >
                Zaloguj się na inne konto
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
