'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Eye, EyeOff, Compass } from 'lucide-react'
import { toast } from 'sonner'
import { changePassword } from '@/app/actions/auth'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Hasła nie są identyczne')
      return
    }
    startTransition(async () => {
      const result = await changePassword({ password })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Hasło zostało zmienione')
      router.push('/my-day')
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-compass-border flex items-center justify-center">
          <Compass size={18} className="text-compass-accent" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-display text-compass-text">Hotable Compass</h1>
          <p className="text-sm text-compass-muted mt-1">Narzędzie PM dla zespołu</p>
        </div>
      </div>

      <div className="w-full max-w-sm bg-compass-surface border border-compass-border rounded-[4px] p-6 shadow-xl">
        <h2 className="text-base font-semibold text-compass-text mb-1">Ustaw nowe hasło</h2>
        <p className="text-xs text-compass-muted mb-5">Hasło musi mieć minimum 6 znaków.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="compass-label block mb-1.5">Nowe hasło</label>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-muted pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="compass-input w-full pl-8 pr-9"
                required
                minLength={6}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-compass-muted hover:text-compass-text transition-colors"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>

          <div>
            <label className="compass-label block mb-1.5">Powtórz hasło</label>
            <div className="relative">
              <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-muted pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="compass-input w-full pl-8"
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending || !password || !confirm}
            className="compass-btn-primary w-full disabled:opacity-40"
          >
            {isPending ? 'Zapisywanie…' : 'Ustaw hasło'}
          </button>
        </form>
      </div>

      <p className="mt-6 text-2xs text-compass-muted">
        HOTABLE SP. Z O.O. · TYLKO DLA ZESPOŁU
      </p>
    </div>
  )
}
