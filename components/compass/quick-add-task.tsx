'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Plus, X, Loader2, Sparkles } from 'lucide-react'
import { cn, inferTaskType, getTaskTypeLabel, getTaskTypeIcon } from '@/lib/utils'
import { createTask } from '@/app/actions/tasks'
import type { DbProject, TaskType } from '@/lib/supabase/types'

interface QuickAddTaskProps {
  projects: DbProject[]
  assigneeId: string | null
  cycleId?: string | null
  onClose?: () => void
}

export function QuickAddTask({ projects, assigneeId, cycleId, onClose }: QuickAddTaskProps) {
  // Jeśli onClose jest przekazane (embedded w kolumnie), start w trybie otwartym
  const [open, setOpen] = useState(onClose !== undefined)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [isPending, startTransition] = useTransition()

  // Derived: infer type from title (no extra state — computed on render)
  const inference = title.trim().length >= 3 ? inferTaskType(title) : null
  const inferredType: TaskType | undefined = inference?.type

  function handleOpen() {
    setOpen(true)
    setTitle('')
    setProjectId(projects[0]?.id ?? '')
  }

  function handleClose() {
    setOpen(false)
    onClose?.()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !projectId) return

    startTransition(async () => {
      const { error } = await createTask({
        title: title.trim(),
        projectId,
        status: 'todo',
        priority: 'medium',
        type: inferredType,
        cycleId: cycleId ?? null,
        assigneeId,
      })

      if (error) {
        toast.error('Nie udało się dodać zadania', { description: error })
      } else {
        toast.success('Zadanie dodane')
        setOpen(false)
        setTitle('')
        onClose?.()
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-[3px]',
          'border border-dashed border-compass-border',
          'text-compass-dim hover:text-compass-muted hover:border-compass-border-strong',
          'transition-colors duration-150 text-sm'
        )}
      >
        <Plus size={13} strokeWidth={1.5} />
        <span>Szybkie zadanie</span>
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="compass-card p-3 border-compass-accent/40"
    >
      <input
        autoFocus
        type="text"
        placeholder="Tytuł zadania…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="compass-input w-full text-sm mb-1.5"
        disabled={isPending}
      />

      {/* AI type badge */}
      {inferredType ? (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Sparkles size={9} className="text-compass-accent flex-shrink-0" />
          <span className="font-mono text-2xs text-compass-accent">
            {getTaskTypeIcon(inferredType)} {getTaskTypeLabel(inferredType)} wykryty
          </span>
        </div>
      ) : (
        <div className="mb-2" />
      )}

      <div className="flex items-center gap-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={isPending}
          className={cn(
            'flex-1 appearance-none',
            'bg-compass-surface-2 border border-compass-border',
            'text-compass-muted text-xs',
            'px-2.5 py-1.5 rounded-[3px]',
            'focus:outline-none focus:border-compass-accent/60'
          )}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          type="submit"
          disabled={!title.trim() || isPending}
          className="compass-btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Dodaj
        </button>

        <button
          type="button"
          onClick={handleClose}
          disabled={isPending}
          className="compass-btn-ghost p-1.5"
        >
          <X size={13} />
        </button>
      </div>
    </form>
  )
}
