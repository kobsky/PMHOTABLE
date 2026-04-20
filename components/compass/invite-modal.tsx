'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { generateInviteToken } from '@/app/actions/invites'
import { X, Mail, Link2, Copy, Check, Loader2 } from 'lucide-react'

interface InviteModalProps {
  onClose: () => void
}

export function InviteModal({ onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [invitedEmail, setInvitedEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await generateInviteToken({ email })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setInviteLink(result.inviteLink)
      setInvitedEmail(result.email)
      setEmail('')
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Skopiowano do schowka')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-compass-surface border border-compass-border rounded-[4px] w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
          <div>
            <h2 className="text-sm font-semibold text-compass-text">Zaproś członka</h2>
            <p className="text-2xs text-compass-dim mt-0.5">Link ważny 7 dni, jednorazowy</p>
          </div>
          <button onClick={onClose} className="compass-btn-ghost p-1">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Form */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div>
              <label className="compass-label block mb-1.5">Email nowego członka</label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  className="compass-input w-full pl-8"
                  required
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="compass-btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isPending
                ? <><Loader2 size={13} className="animate-spin" /> Generowanie…</>
                : <><Link2 size={13} /> Generuj link zaproszenia</>
              }
            </button>
          </form>

          {/* Generated link */}
          {inviteLink && (
            <div className="rounded-[3px] border border-compass-success/30 bg-compass-success/5 p-3 space-y-2">
              <p className="text-xs font-medium text-compass-text flex items-center gap-1.5">
                <Check size={12} className="text-compass-success flex-shrink-0" />
                Email wysłany do <span className="text-compass-accent">{invitedEmail}</span>
              </p>
              <div className="flex gap-2">
                <code className="flex-1 bg-compass-surface-2 border border-compass-border rounded-[3px] px-2.5 py-1.5 text-2xs font-mono text-compass-text overflow-auto whitespace-nowrap">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 compass-btn-primary p-2"
                  title="Kopiuj"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <ul className="text-2xs text-compass-dim space-y-0.5 px-0.5">
            <li>• Link jest jednorazowy — wygasa po użyciu lub po 7 dniach</li>
            <li>• Zaproszony użytkownik ustawi własne hasło przy rejestracji</li>
            <li>• Wszyscy członkowie mają równe uprawnienia</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
