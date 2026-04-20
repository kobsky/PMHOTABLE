'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { generateInviteToken } from '@/app/actions/invites'
import { PageHeader } from '@/components/compass/page-header'
import { Copy, Check, Link2, Mail } from 'lucide-react'

export default function InvitePage() {
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
      toast.success(`Link zaproszenia wygenerowany dla ${result.email}`)
    })
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    toast.success('Skopiowano do schowka')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Zaproś członka"
        subtitle="Wygeneruj link zaproszenia ważny przez 7 dni"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-lg space-y-6">

          {/* Form */}
          <div className="compass-card p-5">
            <h2 className="text-sm font-semibold text-compass-text mb-4 flex items-center gap-2">
              <Mail size={14} className="text-compass-accent" />
              Nowe zaproszenie
            </h2>
            <form onSubmit={handleGenerate} className="space-y-3">
              <div>
                <label className="compass-label mb-1.5 block">Email nowego członka</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  className="compass-input w-full"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="compass-btn-primary w-full flex items-center justify-center gap-2 text-sm py-2"
              >
                <Link2 size={13} />
                {isPending ? 'Generowanie...' : 'Generuj link zaproszenia'}
              </button>
            </form>
          </div>

          {/* Generated link */}
          {inviteLink && (
            <div className="compass-card p-5 border-compass-success/30 bg-compass-success/5">
              <div className="flex items-center gap-2 mb-3">
                <Check size={14} className="text-compass-success" />
                <p className="text-sm font-semibold text-compass-text">
                  Link wygenerowany dla <span className="text-compass-accent">{invitedEmail}</span>
                </p>
              </div>
              <p className="font-mono text-2xs text-compass-dim mb-2">
                Udostępnij ten link — wygaśnie za 7 dni
              </p>
              <div className="flex gap-2">
                <code className="flex-1 bg-compass-surface-2 border border-compass-border rounded-[3px] px-3 py-2 text-xs font-mono text-compass-text overflow-auto whitespace-nowrap">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 compass-btn-primary p-2 text-sm"
                  title="Kopiuj link"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-compass-dim space-y-1 px-1">
            <p>• Link jest jednorazowy — wygasa po użyciu lub po 7 dniach</p>
            <p>• Zaproszony użytkownik otworzy link i ustawi własne hasło</p>
            <p>• Wszyscy członkowie mają równe uprawnienia (brak ról admina)</p>
          </div>
        </div>
      </div>
    </div>
  )
}
