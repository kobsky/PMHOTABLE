'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { cn, formatDate, scopeColor, inferTaskType, getTaskTypeLabel, getTaskTypeIcon } from '@/lib/utils'
import { updateTask, deleteTask, createSubtask, updateSubtaskStatus, removeSubtask, moveTaskToCycle, updateTaskStoryPoints } from '@/app/actions/tasks'
import { logAIFeedback, getAssigneeRecommendation } from '@/app/actions/ai'
import type { AssigneeSuggestion } from '@/app/actions/ai'
import { AssigneeSuggestions } from '@/components/compass/assignee-suggestions'
import type { TaskWithRelations, DbTask, DbProject, DbUser, DbCycle, TaskStatus, TaskPriority, TaskType, RaciMatrix } from '@/lib/supabase/types'
import { STORY_POINTS_VALUES, STORY_POINTS_LIMIT } from '@/lib/capacity'
import { getZone } from '@/lib/velocity/tolerance'
import {
  X, Trash2, ExternalLink, Plus, Link2, Calendar,
  Circle, Clock4, CheckCircle2, Ban, Loader2, ChevronDown,
  ArrowUp, ArrowDown, FileText, Sparkles, MoveRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Link helpers — storage format: <!--links:["url1","url2"]--> appended to description
// ---------------------------------------------------------------------------

function parseLinks(description: string | null): string[] {
  if (!description) return []
  const match = description.match(/<!--links:(.*?)-->$/)
  if (!match) return []
  try { return JSON.parse(match[1]) } catch { return [] }
}

function stripLinks(description: string | null): string {
  if (!description) return ''
  return description.replace(/\n*<!--links:.*?-->$/, '').trimEnd()
}

function serializeLinks(text: string, links: string[]): string {
  const base = text.trimEnd()
  if (links.length === 0) return base
  return `${base}\n<!--links:${JSON.stringify(links)}-->`
}

// ---------------------------------------------------------------------------
// Task templates
// ---------------------------------------------------------------------------

const TASK_TEMPLATES = [
  {
    name: 'Bug Report',
    titlePrefix: 'Bug: ',
    description: '## Problem\n\n## Kroki do reprodukcji\n1. \n\n## Oczekiwane zachowanie\n\n## Aktualne zachowanie',
  },
  {
    name: 'Feature',
    titlePrefix: 'Feature: ',
    description: '## Cel\n\n## Kryteria akceptacji\n- [ ] \n\n## Notatki techniczne',
  },
  {
    name: 'Research',
    titlePrefix: 'Research: ',
    description: '## Pytanie badawcze\n\n## Hipoteza\n\n## Wnioski',
  },
  {
    name: 'Design Review',
    titlePrefix: 'Design: ',
    description: '## Brief\n\n## Deliverables\n- [ ] Makiety\n- [ ] Specyfikacja',
  },
  {
    name: 'Chore',
    titlePrefix: '',
    description: '## Co zrobić\n\n## Definition of Done\n- [ ] ',
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskDetailModalProps {
  task: TaskWithRelations
  projects: DbProject[]
  profiles: DbUser[]
  cycles: DbCycle[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: (taskId: string) => void
  onUpdated?: (taskId: string, patch: Partial<TaskWithRelations>) => void
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function TaskDetailModal({
  task,
  projects,
  profiles,
  cycles,
  open,
  onOpenChange,
  onDeleted,
  onUpdated,
}: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(stripLinks(task.description))
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [type, setType] = useState<TaskType>(task.type)
  const [projectId, setProjectId] = useState(task.project_id)
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assignee_id)
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [cycleId, setCycleId] = useState<string | null>(task.cycle_id)
  const [links, setLinks] = useState<string[]>(parseLinks(task.description))
  const [linkInput, setLinkInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // AI type suggestion — derived from title, shown when differs from current type
  const [typeSuggestion, setTypeSuggestion] = useState<{ type: TaskType; confidence: number } | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

  // AI assignee suggestion — fetched from Claude when modal opens
  const [assigneeSuggestions, setAssigneeSuggestions] = useState<AssigneeSuggestion[]>([])
  const [assigneeSuggestionsDismissed, setAssigneeSuggestionsDismissed] = useState(false)

  // Subtask state
  const [localSubtasks, setLocalSubtasks] = useState<DbTask[]>(task.subtasks ?? [])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // Story Points
  const [storyPoints, setStoryPoints] = useState<number>(task.story_points ?? 3)
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null)

  // RACI
  const [raci, setRaci] = useState<RaciMatrix>(
    task.raci ?? { responsible: null, accountable: [], consulted: [], informed: [] }
  )

  // Move to sprint
  const [showMoveToSprint, setShowMoveToSprint] = useState(false)

  // Templates
  const [showTemplates, setShowTemplates] = useState(false)

  // Sync state when task prop changes (e.g. modal reused for another task)
  useEffect(() => {
    setTitle(task.title)
    setDescription(stripLinks(task.description))
    setStatus(task.status)
    setPriority(task.priority)
    setType(task.type)
    setProjectId(task.project_id)
    setAssigneeId(task.assignee_id)
    setDueDate(task.due_date ?? '')
    setCycleId(task.cycle_id)
    setLinks(parseLinks(task.description))
    setLinkInput('')
    setConfirmDelete(false)
    setLocalSubtasks(task.subtasks ?? [])
    setNewSubtaskTitle('')
    setShowTemplates(false)
    setTypeSuggestion(null)
    setSuggestionDismissed(false)
    setAssigneeSuggestions([])
    setAssigneeSuggestionsDismissed(false)
    setRaci(task.raci ?? { responsible: null, accountable: [], consulted: [], informed: [] })
    setStoryPoints(task.story_points ?? 3)
    setCapacityWarning(null)
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch assignee suggestions from Claude when modal opens
  useEffect(() => {
    if (!open || assigneeSuggestionsDismissed || assigneeSuggestions.length > 0) return
    void getAssigneeRecommendation(task.title, task.description, task.id).then(({ suggestions }) => {
      setAssigneeSuggestions(suggestions)
    })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute AI suggestion when title changes
  useEffect(() => {
    if (suggestionDismissed) return
    const inf = inferTaskType(title)
    if (inf && inf.type !== type) {
      setTypeSuggestion(inf)
    } else {
      setTypeSuggestion(null)
    }
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddLink() {
    const url = linkInput.trim()
    if (!url || links.includes(url)) return
    setLinks((prev) => [...prev, url])
    setLinkInput('')
  }

  function handleRemoveLink(url: string) {
    setLinks((prev) => prev.filter((l) => l !== url))
  }

  function handleAcceptSuggestion() {
    if (!typeSuggestion) return
    const suggested = typeSuggestion
    setType(suggested.type)
    setTypeSuggestion(null)
    setSuggestionDismissed(true)
    // Log acceptance — fire and forget
    void logAIFeedback({
      feature: 'auto_categorization',
      taskId: task.id,
      suggestion: { type: suggested.type, confidence: suggested.confidence },
      accepted: true,
    })
  }

  function handleDismissSuggestion() {
    if (!typeSuggestion) return
    const suggested = typeSuggestion
    setTypeSuggestion(null)
    setSuggestionDismissed(true)
    void logAIFeedback({
      feature: 'auto_categorization',
      taskId: task.id,
      suggestion: { type: suggested.type, confidence: suggested.confidence },
      accepted: false,
      overrideValue: { type },
    })
  }

  function handleSave() {
    if (!title.trim()) return
    const fullDescription = serializeLinks(description, links) || null

    startTransition(async () => {
      const patch = {
        title: title.trim(),
        description: fullDescription,
        status,
        priority,
        type,
        project_id: projectId,
        assignee_id: assigneeId,
        due_date: dueDate || null,
        cycle_id: cycleId,
        story_points: storyPoints,
        raci: (raci.responsible || raci.accountable.length || raci.consulted.length || raci.informed.length)
          ? raci
          : null,
      }

      const { error } = await updateTask(task.id, patch)
      if (error) {
        toast.error('Nie udało się zapisać', { description: error })
      } else {
        toast.success('Zapisano')
        onUpdated?.(task.id, patch as Partial<TaskWithRelations>)
        onOpenChange(false)
      }
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const { error } = await deleteTask(task.id)
      if (error) {
        toast.error('Nie udało się usunąć', { description: error })
      } else {
        toast.success('Zadanie usunięte')
        onDeleted?.(task.id)
        onOpenChange(false)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Subtask handlers
  // ---------------------------------------------------------------------------

  function handleAddSubtask() {
    const t = newSubtaskTitle.trim()
    if (!t) return
    setNewSubtaskTitle('')
    const tempId = `temp-${Date.now()}`
    const newSub: DbTask = {
      id: tempId,
      title: t,
      status: 'todo',
      priority: 'medium',
      type: task.type,
      project_id: task.project_id,
      parent_task_id: task.id,
      assignee_id: null,
      cycle_id: null,
      due_date: null,
      position: localSubtasks.length,
      ai_suggested: false,
      deleted_at: null,
      description: null,
      size: null,
      raci: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setLocalSubtasks((prev) => [...prev, newSub])

    startTransition(async () => {
      const { error, id } = await createSubtask(task.id, t, task.project_id, task.type)
      if (error) {
        toast.error('Nie udało się dodać podzadania')
        setLocalSubtasks((prev) => prev.filter((s) => s.id !== tempId))
      } else if (id) {
        setLocalSubtasks((prev) => prev.map((s) => s.id === tempId ? { ...s, id } : s))
      }
    })
  }

  function handleToggleSubtask(subId: string, done: boolean) {
    setLocalSubtasks((prev) =>
      prev.map((s) => s.id === subId ? { ...s, status: done ? 'done' : 'todo' } : s)
    )
    startTransition(async () => {
      const { error } = await updateSubtaskStatus(subId, done)
      if (error) {
        setLocalSubtasks((prev) =>
          prev.map((s) => s.id === subId ? { ...s, status: done ? 'todo' : 'done' } : s)
        )
        toast.error('Nie udało się zaktualizować podzadania')
      }
    })
  }

  function handleDeleteSubtask(subId: string) {
    const sub = localSubtasks.find((s) => s.id === subId)
    setLocalSubtasks((prev) => prev.filter((s) => s.id !== subId))
    startTransition(async () => {
      const { error } = await removeSubtask(subId)
      if (error) {
        if (sub) setLocalSubtasks((prev) => [...prev, sub])
        toast.error('Nie udało się usunąć podzadania')
      }
    })
  }

  function handleMoveSubtask(subId: string, dir: 'up' | 'down') {
    const idx = localSubtasks.findIndex((s) => s.id === subId)
    if (idx === -1) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= localSubtasks.length) return
    const newList = [...localSubtasks]
    ;[newList[idx], newList[newIdx]] = [newList[newIdx], newList[idx]]
    setLocalSubtasks(newList)
  }

  // ---------------------------------------------------------------------------
  // Template handler
  // ---------------------------------------------------------------------------

  function applyTemplate(tpl: typeof TASK_TEMPLATES[0]) {
    if (tpl.titlePrefix && !title.startsWith(tpl.titlePrefix)) {
      setTitle(tpl.titlePrefix + (title.startsWith(tpl.titlePrefix) ? title.slice(tpl.titlePrefix.length) : title))
    }
    setDescription(tpl.description)
    setShowTemplates(false)
  }

  const project = projects.find((p) => p.id === projectId)
  const doneCount = localSubtasks.filter((s) => s.status === 'done').length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-2xl max-h-[90vh] overflow-y-auto',
            'bg-compass-bg border border-compass-border rounded-[4px] shadow-xl',
            'animate-slide-up'
          )}
          onOpenAutoFocus={(e) => { e.preventDefault(); titleRef.current?.focus() }}
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-0 border-b border-compass-border">
            <Dialog.Title className="sr-only">Edycja zadania</Dialog.Title>
            <div className="flex items-start gap-3 pb-3">
              <textarea
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                rows={title.length > 60 ? 2 : 1}
                className={cn(
                  'flex-1 bg-transparent resize-none text-base font-semibold text-compass-text',
                  'placeholder:text-compass-dim focus:outline-none leading-snug'
                )}
                placeholder="Tytuł zadania…"
              />
              <Dialog.Close asChild>
                <button className="compass-btn-ghost p-1 flex-shrink-0 mt-0.5">
                  <X size={15} />
                </button>
              </Dialog.Close>
            </div>

            {/* AI type suggestion chip */}
            {typeSuggestion && (
              <div className="flex items-center gap-2 pb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-compass-surface-2 border border-compass-accent/30 text-xs">
                  <Sparkles size={10} className="text-compass-accent flex-shrink-0" />
                  <span className="text-compass-dim">AI sugeruje:</span>
                  <span className="text-compass-accent font-medium font-mono">
                    {getTaskTypeIcon(typeSuggestion.type)} {getTaskTypeLabel(typeSuggestion.type)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAcceptSuggestion}
                  className="px-2 py-1 rounded-[3px] text-xs font-medium bg-compass-accent/15 text-compass-accent hover:bg-compass-accent/25 transition-colors border border-compass-accent/30"
                >
                  Zastosuj
                </button>
                <button
                  type="button"
                  onClick={handleDismissSuggestion}
                  className="p-1 rounded-[3px] text-compass-dim hover:text-compass-muted transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {/* AI assignee suggestion chips */}
            {!assigneeSuggestionsDismissed && assigneeSuggestions.length > 0 && (
              <AssigneeSuggestions
                suggestions={assigneeSuggestions}
                taskId={task.id}
                currentAssigneeId={assigneeId}
                onAccept={(id) => setAssigneeId(id)}
                onDismissAll={() => setAssigneeSuggestionsDismissed(true)}
              />
            )}
          </div>

          {/* Meta strip */}
          <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-compass-border bg-compass-surface/40">
            {/* Status */}
            <MetaSelect
              value={status}
              onChange={(v) => setStatus(v as TaskStatus)}
              options={[
                { value: 'todo',        label: 'Do zrobienia', icon: Circle,       color: 'text-compass-dim' },
                { value: 'in_progress', label: 'W toku',       icon: Clock4,       color: 'text-compass-warning' },
                { value: 'done',        label: 'Gotowe',       icon: CheckCircle2, color: 'text-compass-success' },
                { value: 'cancelled',   label: 'Anulowane',    icon: Ban,          color: 'text-compass-danger' },
              ]}
            />

            {/* Priority */}
            <SelectPill
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              label={PRIORITY_LABELS[priority]}
              colorClass={PRIORITY_COLORS[priority]}
              options={[
                { value: 'urgent', label: 'Pilny' },
                { value: 'high',   label: 'Wysoki' },
                { value: 'medium', label: 'Średni' },
                { value: 'low',    label: 'Niski' },
              ]}
            />

            {/* Type */}
            <SelectPill
              value={type}
              onChange={(v) => {
                setType(v as TaskType)
                // If user manually changes type, dismiss the suggestion
                setTypeSuggestion(null)
                setSuggestionDismissed(true)
              }}
              label={`${getTaskTypeIcon(type)} ${getTaskTypeLabel(type)}`}
              colorClass="text-compass-muted font-mono"
              options={[
                { value: 'research',    label: '◆ Research & Analizy' },
                { value: 'development', label: '⚙ Development' },
                { value: 'outreach',    label: '◎ Outreach & Growth' },
                { value: 'design',      label: '△ Design & Content' },
                { value: 'marketing',   label: '◈ PR i Marketing' },
                { value: 'support',     label: '○ Support & Feedback' },
                { value: 'ops',         label: '▣ Operations & Admin' },
              ]}
            />

            {/* Project */}
            <SelectPill
              value={projectId}
              onChange={setProjectId}
              label={project?.name ?? 'Projekt'}
              colorClass="text-compass-muted"
              dotColor={project ? scopeColor(project.scope_tag) : undefined}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
            />

            {/* Assignee */}
            <SelectPill
              value={assigneeId ?? ''}
              onChange={(v) => setAssigneeId(v || null)}
              label={profiles.find((p) => p.id === assigneeId)?.full_name?.split(' ')[0] ?? 'Brak'}
              colorClass="text-compass-muted"
              options={[
                { value: '', label: '— Brak' },
                ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email ?? p.id })),
              ]}
            />

            {/* Due date */}
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker()}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] cursor-pointer',
                'border border-compass-border bg-compass-surface text-compass-muted',
                'hover:border-compass-border-strong text-xs transition-colors'
              )}
            >
              <Calendar size={11} strokeWidth={1.5} className={dueDate ? 'text-compass-accent' : ''} />
              <span>{dueDate ? formatDate(new Date(dueDate)) : 'Termin'}</span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="sr-only"
            />

            {/* Sprint */}
            <SelectPill
              value={cycleId ?? ''}
              onChange={(v) => setCycleId(v || null)}
              label={cycles.find((c) => c.id === cycleId)?.name ?? 'Brak sprintu'}
              colorClass={cycleId ? 'text-compass-accent' : 'text-compass-dim'}
              options={[
                { value: '', label: '— Brak sprintu' },
                ...cycles.map((c) => ({ value: c.id, label: c.name + (c.is_active ? ' ✦' : '') })),
              ]}
            />

            {/* Story Points */}
            <div className="flex items-center gap-1">
              {STORY_POINTS_VALUES.map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={async () => {
                    setStoryPoints(pts)
                    if (task.id && !task.id.startsWith('temp-')) {
                      const { warning } = await updateTaskStoryPoints(task.id, pts)
                      setCapacityWarning(warning ?? null)
                    }
                  }}
                  className={cn(
                    'w-7 h-6 rounded-[3px] font-mono text-xs border transition-colors',
                    storyPoints === pts
                      ? 'bg-compass-accent/20 border-compass-accent text-compass-accent font-semibold'
                      : 'bg-compass-surface border-compass-border text-compass-dim hover:text-compass-muted hover:border-compass-border-strong'
                  )}
                >
                  {pts}
                </button>
              ))}
              {(() => {
                const activeCycle = cycles.find((c) => c.id === cycleId)
                const target = activeCycle?.velocity_planned ?? STORY_POINTS_LIMIT
                const tol = activeCycle?.tolerance_percent ?? 20
                const zone = getZone(storyPoints, target, tol)
                if (zone === 'green') return null
                return (
                  <span className={`font-mono text-2xs ml-1 ${zone === 'yellow' ? 'text-compass-warning' : 'text-compass-danger'}`}>
                    ⚠ {zone === 'yellow' ? 'Na granicy' : 'Poza widełkami'}
                  </span>
                )
              })()}
            </div>
          </div>

          {/* Capacity warning */}
          {capacityWarning && (
            <div className="flex items-center gap-2 px-6 py-2 bg-compass-warning/10 border-b border-compass-warning/30">
              <span className="text-xs text-compass-warning">{capacityWarning}</span>
              <button type="button" onClick={() => setCapacityWarning(null)} className="ml-auto text-compass-warning/60 hover:text-compass-warning">
                <X size={11} />
              </button>
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-4 space-y-5">
            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="compass-label">Opis / Instrukcje</p>
                {/* Templates dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplates((v) => !v)}
                    className="flex items-center gap-1 text-2xs font-mono text-compass-dim hover:text-compass-muted transition-colors px-1.5 py-0.5 rounded-[3px] hover:bg-compass-surface border border-transparent hover:border-compass-border"
                  >
                    <FileText size={10} />
                    Szablon
                    <ChevronDown size={9} />
                  </button>
                  {showTemplates && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-compass-surface-2 border border-compass-border rounded-[4px] shadow-xl z-20 overflow-hidden">
                      {TASK_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => applyTemplate(tpl)}
                          className="w-full text-left px-3 py-2 text-xs text-compass-muted hover:bg-compass-surface hover:text-compass-text transition-colors"
                        >
                          {tpl.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Dodaj opis, instrukcje, kontekst… (obsługuje Markdown)"
                className={cn(
                  'w-full compass-input text-sm leading-relaxed resize-y',
                  'placeholder:text-compass-dim/60 min-h-[100px]'
                )}
              />
            </div>

            {/* Links */}
            <div>
              <p className="compass-label mb-1.5">Linki zewnętrzne</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                  placeholder="https://…"
                  className="flex-1 compass-input text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={!linkInput.trim()}
                  className="compass-btn-outline text-xs px-3 flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus size={12} />
                  Dodaj
                </button>
              </div>
              {links.length > 0 && (
                <div className="flex flex-col gap-1">
                  {links.map((url) => (
                    <div key={url} className="flex items-center gap-2 group px-2.5 py-1.5 rounded-[3px] bg-compass-surface border border-compass-border">
                      <Link2 size={11} className="text-compass-dim flex-shrink-0" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-xs text-compass-accent hover:underline truncate"
                      >
                        {url}
                      </a>
                      <ExternalLink size={10} className="text-compass-dim flex-shrink-0 opacity-0 group-hover:opacity-100" />
                      <button
                        onClick={() => handleRemoveLink(url)}
                        className="text-compass-dim hover:text-compass-danger flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {links.length === 0 && (
                <p className="font-mono text-2xs text-compass-dim/60">Brak linków</p>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="compass-label">
                  Podzadania
                  {localSubtasks.length > 0 && (
                    <span className="ml-1.5 font-mono text-compass-dim">
                      {doneCount}/{localSubtasks.length}
                    </span>
                  )}
                </p>
              </div>

              {/* Progress bar */}
              {localSubtasks.length > 0 && (
                <div className="w-full h-0.5 bg-compass-surface-3 rounded-full mb-2 overflow-hidden">
                  <div
                    className="h-full bg-compass-success rounded-full transition-all duration-300"
                    style={{ width: `${(doneCount / localSubtasks.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Subtask list */}
              {localSubtasks.length > 0 && (
                <div className="flex flex-col gap-1 mb-2">
                  {localSubtasks.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] bg-compass-surface border border-compass-border group"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(sub.id, sub.status !== 'done')}
                        className="flex-shrink-0 hover:opacity-70 transition-opacity"
                      >
                        {sub.status === 'done'
                          ? <CheckCircle2 size={12} className="text-compass-success" />
                          : <Circle size={12} className="text-compass-dim" />
                        }
                      </button>
                      <span className={cn(
                        'text-xs flex-1 min-w-0 truncate',
                        sub.status === 'done' && 'line-through text-compass-dim'
                      )}>
                        {sub.title}
                      </span>
                      {/* Reorder */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleMoveSubtask(sub.id, 'up')}
                          disabled={idx === 0}
                          className="text-compass-dim hover:text-compass-muted disabled:opacity-20 p-0.5"
                        >
                          <ArrowUp size={10} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSubtask(sub.id, 'down')}
                          disabled={idx === localSubtasks.length - 1}
                          className="text-compass-dim hover:text-compass-muted disabled:opacity-20 p-0.5"
                        >
                          <ArrowDown size={10} />
                        </button>
                      </div>
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="text-compass-dim hover:text-compass-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add subtask input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubtask())}
                  placeholder="Dodaj podzadanie… (Enter)"
                  className="flex-1 compass-input text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="compass-btn-outline text-xs px-3 flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus size={12} />
                  Dodaj
                </button>
              </div>
            </div>

            {/* RACI */}
            <div>
              <p className="compass-label mb-2">RACI Matrix</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Responsible — single */}
                <RaciSingleField
                  label="Responsible"
                  selected={raci.responsible}
                  profiles={profiles}
                  onChange={(id) => setRaci((r) => ({ ...r, responsible: id }))}
                />
                {/* Accountable — multi */}
                <RaciMultiField
                  label="Accountable"
                  selected={raci.accountable}
                  profiles={profiles}
                  onChange={(ids) => setRaci((r) => ({ ...r, accountable: ids }))}
                />
                {/* Consulted — multi */}
                <RaciMultiField
                  label="Consulted"
                  selected={raci.consulted}
                  profiles={profiles}
                  onChange={(ids) => setRaci((r) => ({ ...r, consulted: ids }))}
                />
                {/* Informed — multi */}
                <RaciMultiField
                  label="Informed"
                  selected={raci.informed}
                  profiles={profiles}
                  onChange={(ids) => setRaci((r) => ({ ...r, informed: ids }))}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-compass-border bg-compass-surface/30">
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                onBlur={() => !isPending && setConfirmDelete(false)}
                disabled={isPending}
                className={cn(
                  'text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] transition-colors',
                  confirmDelete
                    ? 'bg-compass-danger/20 text-compass-danger border border-compass-danger/40'
                    : 'text-compass-dim hover:text-compass-danger hover:bg-compass-danger/10'
                )}
              >
                <Trash2 size={12} strokeWidth={1.5} />
                {confirmDelete ? 'Potwierdź usunięcie' : 'Usuń'}
              </button>

              {/* Move to Sprint */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoveToSprint((v) => !v)}
                  disabled={isPending}
                  className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-compass-dim hover:text-compass-muted hover:bg-compass-surface transition-colors"
                >
                  <MoveRight size={12} strokeWidth={1.5} />
                  Przenieś do sprintu
                </button>
                {showMoveToSprint && (
                  <div className="absolute bottom-full mb-1 left-0 w-52 bg-compass-surface-2 border border-compass-border rounded-[4px] shadow-xl z-20 overflow-hidden">
                    {cycles.filter((c) => c.id !== task.cycle_id).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setShowMoveToSprint(false)
                          startTransition(async () => {
                            const { error } = await moveTaskToCycle(task.id, c.id)
                            if (error) toast.error('Nie udało się przenieść', { description: error })
                            else {
                              toast.success(`Przeniesiono do ${c.name}`)
                              onUpdated?.(task.id, { cycle_id: c.id } as Partial<TaskWithRelations>)
                              onOpenChange(false)
                            }
                          })
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-compass-muted hover:bg-compass-surface-3 hover:text-compass-text transition-colors"
                      >
                        {c.name}{c.is_active ? ' ✦' : ''}
                      </button>
                    ))}
                    {cycles.filter((c) => c.id !== task.cycle_id).length === 0 && (
                      <p className="px-3 py-2 text-xs text-compass-dim">Brak innych sprintów</p>
                    )}
                  </div>
                )}
              </div>

              <span className="font-mono text-2xs text-compass-dim/50">
                {formatDate(new Date(task.updated_at))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <button className="compass-btn-outline text-xs">Anuluj</button>
              </Dialog.Close>
              <button
                onClick={handleSave}
                disabled={isPending || !title.trim()}
                className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
              >
                {isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Zapisz
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Pilny',
  high: 'Wysoki',
  medium: 'Średni',
  low: 'Niski',
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: 'text-compass-danger',
  high: 'text-compass-warning',
  medium: 'text-compass-muted',
  low: 'text-compass-dim',
}

interface StatusOption {
  value: string
  label: string
  icon: React.ElementType
  color: string
}

function MetaSelect({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: StatusOption[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value) ?? options[0]
  const Icon = current.icon

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs',
          'border border-compass-border bg-compass-surface hover:border-compass-border-strong',
          'cursor-pointer transition-colors'
        )}
      >
        <Icon size={11} strokeWidth={1.5} className={current.color} />
        <span className="text-compass-muted">{current.label}</span>
        <ChevronDown size={10} className="text-compass-dim" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 min-w-[140px] bg-compass-surface-2 border border-compass-border rounded-[4px] shadow-xl z-30 overflow-hidden">
          {options.map((o) => {
            const OIcon = o.icon
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors',
                  o.value === value
                    ? 'text-compass-text bg-compass-surface-3'
                    : 'text-compass-muted hover:bg-compass-surface hover:text-compass-text'
                )}
              >
                <OIcon size={11} strokeWidth={1.5} className={o.color} />
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface SelectPillProps {
  value: string
  onChange: (v: string) => void
  label: string
  colorClass: string
  dotColor?: string
  options: { value: string; label: string }[]
}

// ---------------------------------------------------------------------------
// RaciSingleField — single-select toggle buttons for Responsible
// ---------------------------------------------------------------------------

function RaciSingleField({ label, selected, profiles, onChange }: {
  label: string
  selected: string | null
  profiles: DbUser[]
  onChange: (id: string | null) => void
}) {
  return (
    <div>
      <p className="font-mono text-2xs text-compass-dim mb-1 uppercase">{label}</p>
      <div className="flex flex-wrap gap-1">
        {profiles.map((p) => {
          const isOn = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(isOn ? null : p.id)}
              className={cn(
                'text-2xs font-mono px-1.5 py-0.5 rounded-[3px] border transition-colors',
                isOn
                  ? 'bg-compass-accent/15 border-compass-accent/40 text-compass-accent'
                  : 'bg-compass-surface border-compass-border text-compass-dim hover:text-compass-muted hover:border-compass-border-strong'
              )}
            >
              {(p.full_name ?? p.email ?? 'Brak').split(' ')[0]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RaciMultiField — checkbox list for multi-user RACI roles
// ---------------------------------------------------------------------------

interface RaciMultiFieldProps {
  label: string
  selected: string[]
  profiles: DbUser[]
  onChange: (ids: string[]) => void
}

function RaciMultiField({ label, selected, profiles, onChange }: RaciMultiFieldProps) {
  return (
    <div>
      <p className="font-mono text-2xs text-compass-dim mb-1 uppercase">{label}</p>
      <div className="flex flex-wrap gap-1">
        {profiles.map((p) => {
          const isOn = selected.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(isOn ? selected.filter((id) => id !== p.id) : [...selected, p.id])}
              className={cn(
                'text-2xs font-mono px-1.5 py-0.5 rounded-[3px] border transition-colors',
                isOn
                  ? 'bg-compass-accent/15 border-compass-accent/40 text-compass-accent'
                  : 'bg-compass-surface border-compass-border text-compass-dim hover:text-compass-muted hover:border-compass-border-strong'
              )}
            >
              {(p.full_name ?? p.email ?? 'Brak').split(' ')[0]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SelectPill({ value, onChange, label, colorClass, dotColor, options }: SelectPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs',
          'border border-compass-border bg-compass-surface hover:border-compass-border-strong',
          'cursor-pointer transition-colors'
        )}
      >
        {dotColor && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
        )}
        <span className={colorClass}>{label}</span>
        <ChevronDown size={10} className="text-compass-dim" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 min-w-[140px] bg-compass-surface-2 border border-compass-border rounded-[4px] shadow-xl z-30 overflow-hidden">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs transition-colors',
                o.value === value
                  ? 'text-compass-text bg-compass-surface-3'
                  : 'text-compass-muted hover:bg-compass-surface hover:text-compass-text'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
