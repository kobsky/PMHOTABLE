'use client'

// ---------------------------------------------------------------------------
// U3 (FUNC-003) — Assignee suggestion panel (DECISION SUPPORT, deterministic).
//
// This component only RENDERS a recommendation result that the parent already
// fetched (behind an explicit "Zasugeruj" button + cached by task.id in the
// modal). It does not fetch anything itself and does not auto-fire.
//
// It surfaces, transparently: each candidate's total score, the four
// deterministic sub-scores (skill / load / history / explore) and the Polish
// reason, plus a team-load Gini coefficient as a bias monitor so the human can
// see concentration, not just the top pick. No LLM, no learning.
// ---------------------------------------------------------------------------

import { Sparkles, X, Check } from 'lucide-react'
import { logAIFeedback } from '@/app/actions/ai'
import type { AssigneeSuggestion, AssigneeSubScores } from '@/app/actions/ai'

interface Props {
  suggestions: AssigneeSuggestion[]
  loadGini: number
  taskId: string
  currentAssigneeId: string | null
  onAccept: (assigneeId: string) => void
  onDismissAll: () => void
}

const SUBSCORE_LABELS: { key: keyof AssigneeSubScores; label: string }[] = [
  { key: 'skill', label: 'komp.' },
  { key: 'load', label: 'obc.' },
  { key: 'history', label: 'dośw.' },
  { key: 'explore', label: 'ekspl.' },
]

export function AssigneeSuggestions({
  suggestions,
  loadGini,
  taskId,
  currentAssigneeId,
  onAccept,
  onDismissAll,
}: Props) {
  // Filter out whichever suggestion is already the current assignee
  const visible = suggestions.filter((s) => s.assignee_id !== currentAssigneeId)
  if (visible.length === 0) return null

  function handleAccept(s: AssigneeSuggestion) {
    onAccept(s.assignee_id)
    // Raw interaction logging only (accept) — adoption, not effectiveness.
    void logAIFeedback({
      feature: 'assignee_recommender',
      taskId,
      suggestion: { assignee_id: s.assignee_id, score: s.score, reason: s.reason, subScores: s.subScores },
      accepted: true,
    })
    onDismissAll()
  }

  function handleDismissAll() {
    const top = visible[0]
    // Raw interaction logging only (reject).
    void logAIFeedback({
      feature: 'assignee_recommender',
      taskId,
      suggestion: { assignee_id: top.assignee_id, score: top.score, reason: top.reason, subScores: top.subScores },
      accepted: false,
      overrideValue: currentAssigneeId ? { assignee_id: currentAssigneeId } : null,
    })
    onDismissAll()
  }

  // Gini bias note: 0 = even load, →1 = concentrated on one person.
  const giniPct = Math.round(loadGini * 100)
  const giniHigh = loadGini >= 0.4

  return (
    <div className="pb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-compass-accent flex-shrink-0" />
          <span className="text-compass-dim text-xs">Sugestia przydziału (wsparcie decyzji):</span>
        </div>
        <button
          type="button"
          onClick={handleDismissAll}
          className="p-0.5 rounded-[3px] text-compass-dim hover:text-compass-muted transition-colors"
          aria-label="Odrzuć sugestie przydziału"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {visible.map((s) => (
          <button
            key={s.assignee_id}
            type="button"
            title={s.reason}
            onClick={() => handleAccept(s)}
            className="w-full text-left px-2.5 py-2 rounded-[3px] bg-compass-surface-2 border border-compass-accent/30 hover:bg-compass-surface-3 transition-colors group"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Check size={10} className="text-compass-accent flex-shrink-0" />
              <span className="text-compass-text font-medium text-xs">{s.assignee_name}</span>
              <span className="text-compass-dim font-mono text-2xs">{Math.round(s.score * 100)}%</span>
              <span className="ml-auto text-compass-dim text-2xs truncate max-w-[55%]">{s.reason}</span>
            </div>
            {/* Transparent sub-score breakdown */}
            <div className="flex items-center gap-2 flex-wrap">
              {SUBSCORE_LABELS.map(({ key, label }) => (
                <span key={key} className="font-mono text-2xs text-compass-dim">
                  {label} {Math.round(s.subScores[key] * 100)}%
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Gini bias monitor — transparent imbalance signal, not a score. */}
      <p className={`font-mono text-2xs mt-1.5 ${giniHigh ? 'text-compass-warning' : 'text-compass-dim/70'}`}>
        Bias (Gini obciążenia): {giniPct}%
        {giniHigh ? ' — uwaga: praca skupiona na nielicznych' : ' — rozkład w miarę równomierny'}
      </p>
    </div>
  )
}
