'use client'

import { useState } from 'react'
import { cn, calculateICE, formatShortDate } from '@/lib/utils'
import type { DbIdea } from '@/lib/supabase/types'
import { TrendingUp, CheckCircle2, XCircle, ArrowRight, Inbox, X } from 'lucide-react'

interface IdeaCardProps {
  idea: DbIdea
  authorName?: string
  onAccept?: () => void
  onReject?: (reason: string) => void
  onPromote?: () => void
}

export function IdeaCard({ idea, authorName, onAccept, onReject, onPromote }: IdeaCardProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const computedICE = calculateICE(idea.ice_impact, idea.ice_confidence, idea.ice_ease)
  const iceScore = idea.ice_score ?? computedICE

  const statusConfig = {
    inbox: {
      icon: Inbox,
      label: 'Skrzynka',
      className: 'compass-badge-todo',
    },
    accepted: {
      icon: CheckCircle2,
      label: 'Zaakceptowana',
      className: 'compass-badge-done',
    },
    rejected: {
      icon: XCircle,
      label: 'Odrzucona',
      className: 'compass-badge-danger',
    },
    converted: {
      icon: ArrowRight,
      label: 'Przekształcona',
      className: 'compass-badge-accent',
    },
  }[idea.status]

  const StatusIcon = statusConfig.icon

  const iceColor =
    iceScore >= 7
      ? 'text-compass-success'
      : iceScore >= 5
      ? 'text-compass-warning'
      : 'text-compass-muted'

  function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectReason.trim()) return
    onReject?.(rejectReason.trim())
    setShowRejectForm(false)
    setRejectReason('')
  }

  return (
    <div
      className={cn(
        'compass-card p-4 group',
        idea.status === 'rejected' && 'opacity-60',
        idea.status !== 'rejected' && 'hover:border-compass-border-strong transition-all duration-150'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3
          className={cn(
            'text-sm font-medium text-compass-text leading-snug flex-1',
            idea.status === 'rejected' && 'line-through text-compass-muted'
          )}
        >
          {idea.title}
        </h3>
        <span className={cn('compass-badge flex-shrink-0 whitespace-nowrap', statusConfig.className)}>
          <StatusIcon size={9} />
          {statusConfig.label}
        </span>
      </div>

      {idea.description && (
        <p className="text-xs text-compass-muted leading-relaxed mb-3 line-clamp-2">
          {idea.description}
        </p>
      )}

      {idea.rejection_reason && (
        <div className="mb-3 px-2.5 py-2 bg-compass-danger-dim border border-compass-danger/20 rounded-[3px]">
          <p className="text-xs text-compass-danger/80 italic">
            {idea.rejection_reason}
          </p>
        </div>
      )}

      {/* ICE Scores */}
      <div className="flex items-center gap-0 border border-compass-border rounded-[3px] overflow-hidden mb-3">
        <IceCell label="I" value={idea.ice_impact} title="Impact" />
        <IceCell label="C" value={idea.ice_confidence} title="Confidence" />
        <IceCell label="E" value={idea.ice_ease} title="Ease" />
        <div className="flex-1 flex items-center justify-center py-2 bg-compass-surface-2 border-l border-compass-border gap-1.5">
          <TrendingUp size={11} className={iceColor} />
          <span className={cn('font-display text-base font-semibold', iceColor)}>
            {iceScore.toFixed(1)}
          </span>
          <span className="font-mono text-2xs text-compass-dim">ICE</span>
        </div>
      </div>

      {/* Akcje */}
      {(onAccept || onReject || onPromote) && !showRejectForm && (
        <div className="flex items-center gap-1.5 mb-3">
          {onAccept && (
            <button
              onClick={onAccept}
              className="compass-btn-ghost text-xs text-compass-success hover:bg-compass-success/10 px-2 py-1"
            >
              <CheckCircle2 size={11} />
              Zaakceptuj
            </button>
          )}
          {onPromote && (
            <button
              onClick={onPromote}
              className="compass-btn-ghost text-xs text-compass-accent hover:bg-compass-accent-dim px-2 py-1"
            >
              <ArrowRight size={11} />
              Przekształć w zadanie
            </button>
          )}
          {onReject && (
            <button
              onClick={() => setShowRejectForm(true)}
              className="compass-btn-ghost text-xs text-compass-danger/70 hover:bg-compass-danger-dim px-2 py-1 ml-auto"
            >
              <X size={11} />
              Odrzuć
            </button>
          )}
        </div>
      )}

      {/* Formularz odrzucenia */}
      {showRejectForm && (
        <form onSubmit={handleRejectSubmit} className="mb-3 flex flex-col gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="Powód odrzucenia…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="compass-input text-xs w-full"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={!rejectReason.trim()}
              className="compass-btn-primary text-xs px-2 py-1 disabled:opacity-40"
            >
              Potwierdź
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="compass-btn-ghost text-xs px-2 py-1"
            >
              Anuluj
            </button>
          </div>
        </form>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        {authorName && (
          <span className="font-mono text-2xs text-compass-dim">{authorName}</span>
        )}
        <span className="font-mono text-2xs text-compass-dim ml-auto">
          {formatShortDate(idea.created_at)}
        </span>
      </div>
    </div>
  )
}

function IceCell({
  label,
  value,
  title,
}: {
  label: string
  value: number
  title: string
}) {
  const color =
    value >= 7 ? 'text-compass-success' : value >= 5 ? 'text-compass-warning' : 'text-compass-muted'

  return (
    <div
      className="flex-1 flex flex-col items-center py-1.5 gap-0.5 border-r border-compass-border last:border-r-0"
      title={title}
    >
      <span className="font-mono text-2xs text-compass-dim">{label}</span>
      <span className={cn('font-display text-base font-semibold leading-tight', color)}>
        {value}
      </span>
    </div>
  )
}
