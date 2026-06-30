'use client'

import { useState, useTransition } from 'react'
import { ArrowRight, Sparkles, X, Check, Scale } from 'lucide-react'
import { updateTask } from '@/app/actions/tasks'
import { logAIFeedback } from '@/app/actions/ai'
import type { WorkloadSuggestion, WorkloadImbalance } from '@/app/actions/ai'

interface Props {
  suggestions: WorkloadSuggestion[]
  imbalance: WorkloadImbalance
}

// Transparent bias-monitor banding for the Gini coefficient of active load.
// Gini is a TRANSPARENCY signal (how concentrated the work is), not an
// effectiveness/skuteczność claim — this is decision support, not ML.
function giniBand(gini: number): { label: string; cls: string } {
  if (gini >= 0.4) return { label: 'wysoka nierównowaga', cls: 'text-compass-danger' }
  if (gini >= 0.2) return { label: 'umiarkowana nierównowaga', cls: 'text-compass-warning' }
  return { label: 'obciążenie zrównoważone', cls: 'text-compass-success' }
}

export function WorkloadSuggestionsPanel({ suggestions: initial, imbalance }: Props) {
  const [suggestions, setSuggestions] = useState(initial)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Show the imbalance indicator whenever there is any active load to report,
  // even if no concrete move is suggested. Hide the whole panel only when there
  // is nothing at all to show (no suggestions AND no load spread).
  const hasLoad = imbalance.maxLoad > 0
  if (suggestions.length === 0 && !hasLoad) return null

  const band = giniBand(imbalance.gini)

  function remove(id: string) {
    setSuggestions(prev => prev.filter(s => s.suggestionId !== id))
    setConfirming(null)
  }

  function handleDismiss(s: WorkloadSuggestion) {
    startTransition(async () => {
      await logAIFeedback({
        feature: 'workload_balancing',
        taskId: s.taskId,
        suggestion: { fromUserId: s.fromUserId, toUserId: s.toUserId, taskId: s.taskId },
        accepted: false,
        overrideValue: null,
      })
    })
    remove(s.suggestionId)
  }

  function handleAccept(s: WorkloadSuggestion) {
    startTransition(async () => {
      await updateTask(s.taskId, { assignee_id: s.toUserId })
      await logAIFeedback({
        feature: 'workload_balancing',
        taskId: s.taskId,
        suggestion: { fromUserId: s.fromUserId, toUserId: s.toUserId, taskId: s.taskId },
        accepted: true,
        overrideValue: null,
      })
    })
    remove(s.suggestionId)
  }

  return (
    <div className="mb-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={13} className="text-compass-accent" />
        <span className="font-mono text-2xs text-compass-muted uppercase tracking-wider">
          Wsparcie decyzji · Obciążenie zespołu
        </span>
      </div>

      {/* Imbalance / bias monitor — Gini of active-task counts across the team.
          Transparency signal, not an effectiveness claim. */}
      {hasLoad && (
        <div className="compass-card p-3 mb-2 flex items-center gap-3">
          <Scale size={14} className={band.cls} strokeWidth={1.5} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-compass-text leading-snug">
              Rozkład obciążenia:{' '}
              <span className={`font-semibold ${band.cls}`}>{band.label}</span>
            </p>
            <div className="flex items-center gap-3 mt-1 font-mono text-2xs text-compass-dim">
              <span>Gini {imbalance.gini.toFixed(2)}</span>
              <span>wariancja {imbalance.variance.toFixed(2)}</span>
              <span>rozpiętość {imbalance.minLoad}–{imbalance.maxLoad}</span>
            </div>
          </div>
        </div>
      )}

      {suggestions.length === 0 && (
        <p className="font-mono text-2xs text-compass-dim">
          Brak propozycji przesunięć — rozkład pracy jest akceptowalny.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {suggestions.map(s => {
          const isConfirming = confirming === s.suggestionId

          return (
            <div
              key={s.suggestionId}
              className="compass-card p-3 flex flex-col gap-2 border-compass-accent/20"
            >
              {/* Main suggestion row */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-compass-text leading-snug">
                    Przesuń{' '}
                    <span className="font-semibold text-compass-accent">
                      &ldquo;{s.taskTitle}&rdquo;
                    </span>
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="font-mono text-2xs text-compass-muted">{s.fromUserName}</span>
                    <span className="font-mono text-2xs text-compass-dim">
                      ({s.fromLoad} active)
                    </span>
                    <ArrowRight size={10} className="text-compass-muted mx-0.5" />
                    <span className="font-mono text-2xs text-compass-muted">{s.toUserName}</span>
                    <span className="font-mono text-2xs text-compass-dim">
                      ({s.toLoad} active)
                    </span>
                  </div>
                </div>

                {!isConfirming && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setConfirming(s.suggestionId)}
                      disabled={isPending}
                      className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-mono
                                 bg-compass-accent/10 text-compass-accent border border-compass-accent/25
                                 hover:bg-compass-accent/20 transition-colors disabled:opacity-40"
                    >
                      <Check size={11} />
                      Zastosuj
                    </button>
                    <button
                      onClick={() => handleDismiss(s)}
                      disabled={isPending}
                      className="p-1 rounded text-compass-dim hover:text-compass-muted
                                 hover:bg-compass-surface-3 transition-colors disabled:opacity-40"
                      aria-label="Odrzuć"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Confirmation row */}
              {isConfirming && (
                <div className="flex items-center gap-2 pt-1 border-t border-compass-border">
                  <span className="font-mono text-2xs text-compass-muted flex-1">
                    Przypisać do {s.toUserName}?
                  </span>
                  <button
                    onClick={() => handleAccept(s)}
                    disabled={isPending}
                    className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-mono
                               bg-compass-accent text-white hover:bg-compass-accent/90
                               transition-colors disabled:opacity-40"
                  >
                    <Check size={11} />
                    Tak, przesuń
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    disabled={isPending}
                    className="px-2 py-1 rounded text-2xs font-mono text-compass-muted
                               hover:bg-compass-surface-3 transition-colors disabled:opacity-40"
                  >
                    Anuluj
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
