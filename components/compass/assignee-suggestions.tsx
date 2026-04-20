'use client'

import { Sparkles, X, Check } from 'lucide-react'
import { logAIFeedback } from '@/app/actions/ai'
import type { AssigneeSuggestion } from '@/app/actions/ai'

interface Props {
  suggestions: AssigneeSuggestion[]
  taskId: string
  currentAssigneeId: string | null
  onAccept: (assigneeId: string) => void
  onDismissAll: () => void
}

export function AssigneeSuggestions({
  suggestions,
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
    void logAIFeedback({
      feature: 'assignee_recommender',
      taskId,
      suggestion: { assignee_id: s.assignee_id, score: s.score, reason: s.reason },
      accepted: true,
    })
    onDismissAll()
  }

  function handleDismissAll() {
    const top = visible[0]
    void logAIFeedback({
      feature: 'assignee_recommender',
      taskId,
      suggestion: { assignee_id: top.assignee_id, score: top.score, reason: top.reason },
      accepted: false,
      overrideValue: currentAssigneeId ? { assignee_id: currentAssigneeId } : null,
    })
    onDismissAll()
  }

  return (
    <div className="flex items-center gap-2 pb-3 flex-wrap">
      <div className="flex items-center gap-1">
        <Sparkles size={10} className="text-compass-accent flex-shrink-0" />
        <span className="text-compass-dim text-xs">AI sugeruje assignee:</span>
      </div>

      {visible.map((s) => (
        <button
          key={s.assignee_id}
          type="button"
          title={s.reason}
          onClick={() => handleAccept(s)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-compass-surface-2 border border-compass-accent/30 text-xs hover:bg-compass-surface-3 transition-colors"
        >
          <Check size={9} className="text-compass-accent flex-shrink-0" />
          <span className="text-compass-text font-medium">{s.assignee_name}</span>
          <span className="text-compass-dim font-mono">({Math.round(s.score * 100)}%)</span>
        </button>
      ))}

      <button
        type="button"
        onClick={handleDismissAll}
        className="p-0.5 rounded-[3px] text-compass-dim hover:text-compass-muted transition-colors"
        aria-label="Odrzuć sugestie assignee"
      >
        <X size={11} />
      </button>
    </div>
  )
}
