'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { requestPasswordReset } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetSent, setResetSent] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)

    if (error) {
      toast.error('Nieprawidłowe dane logowania', {
        description: error.message,
      })
      return
    }

    router.push('/my-day')
    router.refresh()
  }

  function handleResetRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    startTransition(async () => {
      const result = await requestPasswordReset({ email: email.trim().toLowerCase() })
      if ('error' in result) {
        toast.error('Nie udało się wysłać linku', { description: result.error })
        return
      }
      setResetSent(true)
    })
  }

  if (mode === 'reset') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setMode('login'); setResetSent(false) }}
          className="flex items-center gap-1.5 text-xs text-compass-muted hover:text-compass-text transition-colors"
        >
          <ArrowLeft size={12} />
          Wróć do logowania
        </button>

        {resetSent ? (
          <div className="rounded border border-compass-success/30 bg-compass-success/5 px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-compass-text">Sprawdź skrzynkę</p>
            <p className="text-xs text-compass-muted">
              Wysłaliśmy link do zmiany hasła na <span className="text-compass-text">{email}</span>.
              Link jest ważny przez 1 godzinę.
            </p>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="compass-label">
                Adres e-mail
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
                />
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="twoj@email.com"
                  required
                  autoComplete="email"
                  autoFocus
                  className="compass-input pl-9"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="compass-btn-primary w-full"
            >
              {isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Wysyłanie…
                </>
              ) : (
                'Wyślij link do zmiany hasła'
              )}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="email" className="compass-label">
          Adres e-mail
        </label>
        <div className="relative">
          <Mail
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
          />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.com"
            required
            autoComplete="email"
            autoFocus
            className="compass-input pl-9"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="compass-label">
            Hasło
          </label>
          <button
            type="button"
            onClick={() => setMode('reset')}
            className="text-2xs text-compass-dim hover:text-compass-muted transition-colors"
          >
            Zapomniałem hasła
          </button>
        </div>
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
            placeholder="••••••••"
            required
            autoComplete="current-password"
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

      {/* Remember me */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-3.5 h-3.5 rounded-[2px] accent-compass-accent cursor-pointer"
        />
        <span className="text-xs text-compass-muted">Zapamiętaj mnie przez 30 dni</span>
      </label>

      <button
        type="submit"
        disabled={loading || !email.trim() || !password}
        className="compass-btn-primary w-full"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Logowanie…
          </>
        ) : (
          'Zaloguj się'
        )}
      </button>

      <p className="text-center text-xs text-compass-dim leading-relaxed">
        Nie masz konta? Użyj linku<br />zaproszenia od swojego zespołu.
      </p>
    </form>
  )
}
