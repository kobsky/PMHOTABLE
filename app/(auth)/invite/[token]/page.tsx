'use client'

import { useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { acceptInviteWithPassword } from '@/app/actions/invites'
import { Lock, Eye, EyeOff, Loader2 } from 'lucide-react'

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

export default function InviteAcceptPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      toast.error('Hasło musi mieć minimum 6 znaków')
      return
    }
    if (password !== confirm) {
      toast.error('Hasła nie są zgodne')
      return
    }

    startTransition(async () => {
      const result = await acceptInviteWithPassword({ token, password })
      if ('error' in result) {
        toast.error('Nie udało się aktywować konta', { description: result.error })
      }
      // On success, the server action calls redirect('/my-day') — no client-side redirect needed
    })
  }

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
          Aktywuj swoje konto
        </p>
      </div>

      {/* Card */}
      <div className="compass-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-compass-text">
            Ustaw hasło
          </h2>
          <p className="mt-1 text-xs text-compass-muted">
            Twoje zaproszenie jest aktywne. Ustaw hasło, aby dokończyć rejestrację.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="compass-label">
              Hasło
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 znaków"
                required
                autoComplete="new-password"
                autoFocus
                className="compass-input pl-9 pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-compass-dim hover:text-compass-muted transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="compass-label">
              Powtórz hasło
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
              />
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Powtórz hasło"
                required
                autoComplete="new-password"
                className="compass-input pl-9"
              />
            </div>
            {confirm && password !== confirm && (
              <p className="text-2xs text-compass-danger">Hasła nie są zgodne</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !password || password !== confirm}
            className="compass-btn-primary w-full"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Aktywowanie…
              </>
            ) : (
              'Aktywuj konto i zaloguj się'
            )}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center font-mono text-2xs text-compass-dim uppercase tracking-widest">
        Hotable Sp. z o.o. · Tylko dla zespołu
      </p>
    </div>
  )
}
