'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changePassword } from '@/app/actions/auth'
import { Lock, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

export default function AccountSettingsPage() {
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
      const result = await changePassword({ password })
      if ('error' in result) {
        toast.error('Nie udało się zmienić hasła', { description: result.error })
        return
      }
      toast.success('Hasło zostało zmienione')
      setPassword('')
      setConfirm('')
    })
  }

  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h1 className="font-display text-2xl font-bold text-compass-text">Konto</h1>
        <p className="text-sm text-compass-muted mt-1">
          Zarządzaj swoim kontem i hasłem
        </p>
      </div>

      <div className="compass-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-compass-text flex items-center gap-2">
          <KeyRound size={14} className="text-compass-accent" />
          Zmień hasło
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="compass-label">
              Nowe hasło
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
              />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 znaków"
                required
                autoComplete="new-password"
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
            <label htmlFor="confirm-password" className="compass-label">
              Powtórz hasło
            </label>
            <div className="relative">
              <Lock
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
              />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Powtórz hasło"
                required
                autoComplete="new-password"
                className="compass-input pl-9"
              />
            </div>
            {mismatch && (
              <p className="text-2xs text-compass-danger">Hasła nie są zgodne</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending || !password || mismatch}
            className="compass-btn-primary"
          >
            {isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Zapisywanie…
              </>
            ) : (
              'Zmień hasło'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
