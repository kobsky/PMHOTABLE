'use client'

import { useState, useMemo, useTransition } from 'react'
import { cn, formatRelativeDate, getStatusLabel, scopeColor } from '@/lib/utils'
import type { TaskWithRelations, DbProject, DbUser, DbCycle, TaskPriority, TaskStatus } from '@/lib/supabase/types'
import { updateTask, bulkUpdateTasks, getDeletedTasks, restoreTask } from '@/app/actions/tasks'
import { bulkCategorizeTaskTypes } from '@/app/actions/ai'
import dynamic from 'next/dynamic'
const TaskDetailModal = dynamic(
  () => import('./task-detail-modal').then(m => m.TaskDetailModal),
  { ssr: false }
)
import { toast } from 'sonner'
import {
  Calendar, ChevronDown, Circle, Clock4, CheckCircle2, Ban,
  Search, RotateCcw, Trash2, Sparkles,
} from 'lucide-react'

interface BacklogViewProps {
  tasks: TaskWithRelations[]
  projects: DbProject[]
  profiles: DbUser[]
  cycles: DbCycle[]
  initialCycleId?: string
}

type FilterStatus = 'all' | TaskStatus
type FilterPriority = 'all' | TaskPriority
type FilterProject = 'all' | string
type FilterAssignee = 'all' | 'unassigned' | string
type FilterCycle = 'all' | 'unscheduled' | string

export function BacklogView({ tasks, projects, profiles, cycles, initialCycleId }: BacklogViewProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all')
  const [filterProject, setFilterProject] = useState<FilterProject>('all')
  const [filterAssignee, setFilterAssignee] = useState<FilterAssignee>('all')
  const [filterCycle, setFilterCycle] = useState<FilterCycle>(initialCycleId ?? 'all')
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'due' | 'size'>('priority')
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const [localTasks, setLocalTasks] = useState<TaskWithRelations[]>(tasks)

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Show deleted
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedTasks, setDeletedTasks] = useState<TaskWithRelations[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)

  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    return localTasks
      .filter((t) => {
        if (t.status === 'cancelled') return false
        if (filterStatus !== 'all' && t.status !== filterStatus) return false
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false
        if (filterProject !== 'all' && t.project_id !== filterProject) return false
        if (filterAssignee === 'unassigned' && t.assignee_id !== null) return false
        if (filterAssignee !== 'all' && filterAssignee !== 'unassigned' && t.assignee_id !== filterAssignee) return false
        if (filterCycle === 'unscheduled' && t.cycle_id !== null) return false
        if (filterCycle !== 'all' && filterCycle !== 'unscheduled' && t.cycle_id !== filterCycle) return false
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority]
        if (sortBy === 'due') {
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        }
        if (sortBy === 'size') {
          return (a.story_points ?? 3) - (b.story_points ?? 3)
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [localTasks, search, filterStatus, filterPriority, filterProject, filterAssignee, filterCycle, sortBy])

  // ---------------------------------------------------------------------------
  // Optimistic helpers
  // ---------------------------------------------------------------------------

  function handleUpdated(taskId: string, patch: Partial<TaskWithRelations>) {
    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t))
    if (selectedTask?.id === taskId) setSelectedTask((prev) => prev ? { ...prev, ...patch } : prev)
  }

  function handleDeleted(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId))
    setSelectedTask(null)
  }

  function handleInlineUpdate(taskId: string, patch: { assignee_id?: string | null; priority?: TaskPriority }) {
    setLocalTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t))
    startTransition(async () => {
      const { error } = await updateTask(taskId, patch)
      if (error) toast.error('Nie udało się zapisać')
    })
  }

  // ---------------------------------------------------------------------------
  // Multi-select
  // ---------------------------------------------------------------------------

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)))
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  function handleBulkAssign(assigneeId: string | null) {
    const ids = Array.from(selectedIds)
    setLocalTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, assignee_id: assigneeId } : t))
    setSelectedIds(new Set())
    startTransition(async () => {
      const { error } = await bulkUpdateTasks(ids, { assignee_id: assigneeId })
      if (error) toast.error('Nie udało się zaktualizować')
    })
  }

  function handleBulkMoveToCycle(cycleId: string | null) {
    const ids = Array.from(selectedIds)
    setLocalTasks((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, cycle_id: cycleId } : t))
    setSelectedIds(new Set())
    startTransition(async () => {
      const { error } = await bulkUpdateTasks(ids, { cycle_id: cycleId })
      if (error) toast.error('Nie udało się zaktualizować')
    })
  }

  function handleBulkAutoCategorize() {
    const ids = Array.from(selectedIds)
    const tasksToProcess = localTasks
      .filter((t) => ids.includes(t.id))
      .map((t) => ({ id: t.id, title: t.title, currentType: t.type }))

    setSelectedIds(new Set())
    startTransition(async () => {
      const { error, updated } = await bulkCategorizeTaskTypes(tasksToProcess)
      if (error) {
        toast.error('Błąd auto-kategoryzacji')
      } else if (updated === 0) {
        toast.info('Brak zmian — typy już są poprawne lub nie można wykryć')
      } else {
        toast.success(`Auto-kategoryzacja: zaktualizowano ${updated} zadań`)
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Show deleted
  // ---------------------------------------------------------------------------

  async function handleToggleDeleted() {
    if (!showDeleted && deletedTasks.length === 0) {
      setLoadingDeleted(true)
      const data = await getDeletedTasks()
      setDeletedTasks(data)
      setLoadingDeleted(false)
    }
    setShowDeleted((v) => !v)
  }

  function handleRestore(taskId: string) {
    setDeletedTasks((prev) => prev.filter((t) => t.id !== taskId))
    startTransition(async () => {
      const { error } = await restoreTask(taskId)
      if (error) {
        toast.error('Nie udało się przywrócić')
      } else {
        toast.success('Zadanie przywrócone')
      }
    })
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length
  const someSelected = selectedIds.size > 0

  return (
    <>
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projects={projects}
          profiles={profiles}
          cycles={cycles}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      <div className="flex flex-col gap-0">
        {/* Filtry */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-compass-border flex-wrap">
          {/* Szukaj */}
          <div className="relative flex-1 min-w-[180px] max-w-[260px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none" />
            <input
              type="text"
              placeholder="Szukaj zadań…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="compass-input pl-8 py-1.5 text-xs w-full"
            />
          </div>

          <span className="w-px h-4 bg-compass-border" />

          {/* Status */}
          <FilterSelect
            value={filterStatus}
            onChange={(v) => setFilterStatus(v as FilterStatus)}
            options={[
              { value: 'all',         label: 'Status: Wszystkie' },
              { value: 'todo',        label: 'Do zrobienia' },
              { value: 'in_progress', label: 'W toku' },
              { value: 'in_review',   label: 'W review' },
              { value: 'done',        label: 'Gotowe' },
            ]}
          />

          {/* Priorytet */}
          <FilterSelect
            value={filterPriority}
            onChange={(v) => setFilterPriority(v as FilterPriority)}
            options={[
              { value: 'all',    label: 'Priorytet: Wszystkie' },
              { value: 'urgent', label: 'Pilny' },
              { value: 'high',   label: 'Wysoki' },
              { value: 'medium', label: 'Średni' },
              { value: 'low',    label: 'Niski' },
            ]}
          />

          {/* Projekt */}
          <FilterSelect
            value={filterProject}
            onChange={(v) => setFilterProject(v)}
            options={[
              { value: 'all', label: 'Projekt: Wszystkie' },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />

          {/* Assignee */}
          <FilterSelect
            value={filterAssignee}
            onChange={(v) => setFilterAssignee(v as FilterAssignee)}
            options={[
              { value: 'all',        label: 'Osoba: Wszystkie' },
              { value: 'unassigned', label: 'Nieprzypisane' },
              ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email ?? p.id })),
            ]}
          />

          {/* Sprint */}
          <FilterSelect
            value={filterCycle}
            onChange={(v) => setFilterCycle(v as FilterCycle)}
            options={[
              { value: 'all',         label: 'Sprint: Wszystkie' },
              { value: 'unscheduled', label: 'Nieplanowane' },
              ...cycles.map((c) => ({ value: c.id, label: c.name + (c.is_active ? ' ✦' : '') })),
            ]}
          />

          <span className="w-px h-4 bg-compass-border" />

          {/* Sort */}
          <FilterSelect
            value={sortBy}
            onChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: 'priority', label: 'Sortuj: Priorytet' },
              { value: 'size',     label: 'Sortuj: Story Points' },
              { value: 'due',      label: 'Sortuj: Termin' },
              { value: 'created',  label: 'Sortuj: Dodane' },
            ]}
          />

          {/* Show deleted toggle */}
          <button
            onClick={handleToggleDeleted}
            disabled={loadingDeleted}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs font-mono transition-colors border',
              showDeleted
                ? 'bg-compass-danger/10 border-compass-danger/40 text-compass-danger'
                : 'bg-compass-surface-2 border-compass-border text-compass-dim hover:text-compass-muted'
            )}
          >
            <Trash2 size={11} />
            {loadingDeleted ? '…' : 'Usunięte'}
          </button>

          <span className="ml-auto font-mono text-2xs text-compass-dim">
            {filtered.length} zadań
          </span>
        </div>

        {/* Bulk actions bar */}
        {someSelected && (
          <div className="flex items-center gap-2 px-6 py-2.5 bg-compass-accent/8 border-b border-compass-accent/20">
            <span className="font-mono text-2xs text-compass-accent font-semibold">
              {selectedIds.size} zaznaczonych
            </span>
            <span className="w-px h-4 bg-compass-border" />

            {/* Bulk assign */}
            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value !== '') handleBulkAssign(e.target.value === 'none' ? null : e.target.value); e.target.value = '' }}
                className={cn(
                  'appearance-none cursor-pointer',
                  'bg-compass-surface border border-compass-border',
                  'text-compass-muted text-xs',
                  'pl-2.5 pr-6 py-1 rounded-[3px]',
                  'focus:outline-none focus:border-compass-accent/60',
                )}
              >
                <option value="" disabled>Przypisz do…</option>
                <option value="none">— Odpisz</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none" />
            </div>

            {/* Bulk move to cycle */}
            <div className="relative">
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value !== '') handleBulkMoveToCycle(e.target.value === 'none' ? null : e.target.value); e.target.value = '' }}
                className={cn(
                  'appearance-none cursor-pointer',
                  'bg-compass-surface border border-compass-border',
                  'text-compass-muted text-xs',
                  'pl-2.5 pr-6 py-1 rounded-[3px]',
                  'focus:outline-none focus:border-compass-accent/60',
                )}
              >
                <option value="" disabled>Przenieś do sprintu…</option>
                <option value="none">— Usuń ze sprintu</option>
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.is_active ? ' ✦' : ''}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none" />
            </div>

            {/* Bulk auto-categorize */}
            <button
              onClick={handleBulkAutoCategorize}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] text-xs border transition-colors',
                'bg-compass-surface border-compass-accent/30 text-compass-accent',
                'hover:bg-compass-accent/15 hover:border-compass-accent/50'
              )}
            >
              <Sparkles size={11} />
              Auto-kategoryzuj
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-compass-dim hover:text-compass-muted font-mono"
            >
              Odznacz wszystkie
            </button>
          </div>
        )}

        {/* Tabela */}
        <div className="divide-y divide-compass-border">
          {/* Nagłówek */}
          <div className="grid grid-cols-[20px_1fr_80px_100px_80px_90px_55px_80px] gap-3 px-4 py-2 items-center">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 accent-compass-accent cursor-pointer"
            />
            <span className="compass-label">Tytuł</span>
            <span className="compass-label">Osoba</span>
            <span className="compass-label">Projekt</span>
            <span className="compass-label">Status</span>
            <span className="compass-label">Priorytet</span>
            <span className="compass-label">Rozmiar</span>
            <span className="compass-label text-right">Termin</span>
          </div>

          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-mono text-2xs text-compass-dim uppercase tracking-wider">
                Brak wyników
              </p>
            </div>
          ) : (
            filtered.map((task) => (
              <BacklogRow
                key={task.id}
                task={task}
                profiles={profiles}
                isSelected={selectedIds.has(task.id)}
                onToggleSelect={() => toggleSelect(task.id)}
                onOpen={() => setSelectedTask(task)}
                onInlineUpdate={handleInlineUpdate}
              />
            ))
          )}

          {/* Deleted tasks section */}
          {showDeleted && deletedTasks.length > 0 && (
            <>
              <div className="px-4 py-2 bg-compass-surface/40">
                <span className="font-mono text-2xs text-compass-danger uppercase tracking-widest">
                  Usunięte ({deletedTasks.length})
                </span>
              </div>
              {deletedTasks.map((task) => {
                const projectColor = scopeColor(task.project?.scope_tag ?? '')
                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[20px_1fr_80px_100px_80px_90px_55px_80px] gap-3 px-4 py-2.5 opacity-50 hover:opacity-70 transition-opacity"
                  >
                    <div />
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-[2px] h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: projectColor }}
                      />
                      <span className="text-sm text-compass-dim line-through truncate">
                        {task.title}
                      </span>
                    </div>
                    <div />
                    <span className="font-mono text-2xs truncate self-center" style={{ color: projectColor }}>
                      {task.project?.name ?? '—'}
                    </span>
                    <div />
                    <div />
                    <div />
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleRestore(task.id)}
                        className="flex items-center gap-1 text-2xs font-mono text-compass-dim hover:text-compass-success transition-colors"
                      >
                        <RotateCcw size={10} />
                        Przywróć
                      </button>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {showDeleted && deletedTasks.length === 0 && !loadingDeleted && (
            <div className="px-6 py-4 text-center">
              <p className="font-mono text-2xs text-compass-dim">Brak usuniętych zadań</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Backlog row (extracted for readability)
// ---------------------------------------------------------------------------

interface BacklogRowProps {
  task: TaskWithRelations
  profiles: DbUser[]
  isSelected: boolean
  onToggleSelect: () => void
  onOpen: () => void
  onInlineUpdate: (id: string, patch: { assignee_id?: string | null; priority?: TaskPriority }) => void
}

function BacklogRow({ task, profiles, isSelected, onToggleSelect, onOpen, onInlineUpdate }: BacklogRowProps) {
  const projectColor = scopeColor(task.project?.scope_tag ?? '')
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  const StatusIcon = {
    todo:        Circle,
    in_progress: Clock4,
    in_review:   Clock4,
    done:        CheckCircle2,
    cancelled:   Ban,
  }[task.status] ?? Circle

  const assignee = profiles.find((p) => p.id === task.assignee_id)
  const assigneeInitial = assignee
    ? (assignee.full_name ?? assignee.email ?? '?')[0].toUpperCase()
    : null

  return (
    <div
      className={cn(
        'grid grid-cols-[20px_1fr_80px_100px_80px_90px_55px_80px] gap-3 px-4 py-2.5 items-center',
        'hover:bg-compass-surface transition-colors duration-100 group',
        isSelected && 'bg-compass-accent/5'
      )}
    >
      {/* Checkbox */}
      <div
        className="flex items-center"
        onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-3.5 h-3.5 accent-compass-accent cursor-pointer"
        />
      </div>

      {/* Tytuł — click opens modal */}
      <div
        onClick={onOpen}
        className="flex items-center gap-2.5 min-w-0 cursor-pointer"
      >
        <div
          className="w-[2px] h-4 rounded-full flex-shrink-0 opacity-60"
          style={{ backgroundColor: projectColor }}
        />
        <span
          className={cn(
            'text-sm text-compass-text truncate',
            task.status === 'done' && 'line-through text-compass-dim'
          )}
        >
          {task.title}
        </span>
        {task.subtasks?.length > 0 && (
          <span className="font-mono text-2xs text-compass-dim flex-shrink-0">
            +{task.subtasks.length}
          </span>
        )}
      </div>

      {/* Assignee — inline editable */}
      <div
        className="relative flex items-center cursor-pointer self-center"
        onClick={(e) => e.stopPropagation()}
        title={assignee ? (assignee.full_name ?? assignee.email ?? 'Nieznany') : 'Nieprzypisane'}
      >
        <select
          value={task.assignee_id ?? ''}
          onChange={(e) => onInlineUpdate(task.id, { assignee_id: e.target.value || null })}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        >
          <option value="">— Brak</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
          ))}
        </select>
        {assigneeInitial ? (
          <span className="w-5 h-5 rounded-full bg-compass-accent/20 flex items-center justify-center font-mono text-2xs text-compass-accent flex-shrink-0">
            {assigneeInitial}
          </span>
        ) : (
          <span className="font-mono text-2xs text-compass-dim/40">—</span>
        )}
      </div>

      {/* Projekt */}
      <span
        onClick={onOpen}
        className="font-mono text-2xs truncate self-center cursor-pointer"
        style={{ color: projectColor }}
        title={task.project?.name ?? ''}
      >
        {task.project?.name ?? '—'}
      </span>

      {/* Status */}
      <div
        onClick={onOpen}
        className="flex items-center gap-1.5 self-center cursor-pointer"
      >
        <StatusIcon
          size={11}
          strokeWidth={1.5}
          className={cn({
            'text-compass-dim':     task.status === 'todo',
            'text-compass-warning': task.status === 'in_progress',
            'text-compass-accent':  task.status === 'in_review',
            'text-compass-success': task.status === 'done',
            'text-compass-danger':  task.status === 'cancelled',
          })}
        />
        <span className="font-mono text-2xs text-compass-muted hidden xl:inline">
          {getStatusLabel(task.status)}
        </span>
      </div>

      {/* Priorytet — inline editable */}
      <div
        className="relative flex items-center gap-1.5 self-center cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          value={task.priority}
          onChange={(e) => onInlineUpdate(task.id, { priority: e.target.value as TaskPriority })}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
        >
          <option value="urgent">Pilny</option>
          <option value="high">Wysoki</option>
          <option value="medium">Średni</option>
          <option value="low">Niski</option>
        </select>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Story Points */}
      <div className="flex items-center self-center">
        <StoryPointsBadge points={task.story_points ?? 3} />
      </div>

      {/* Termin */}
      <div
        onClick={onOpen}
        className="flex items-center justify-end gap-1 self-center cursor-pointer"
      >
        {task.due_date ? (
          <span
            className={cn(
              'flex items-center gap-1 font-mono text-2xs',
              isOverdue ? 'text-compass-danger' : 'text-compass-dim'
            )}
          >
            <Calendar size={10} />
            {formatRelativeDate(task.due_date)}
          </span>
        ) : (
          <span className="font-mono text-2xs text-compass-dim/40">—</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function StoryPointsBadge({ points }: { points: number }) {
  const colorClass =
    points >= 8 ? 'text-compass-danger' :
    points >= 5 ? 'text-compass-warning' :
    points >= 3 ? 'text-compass-muted' :
    'text-compass-dim'
  return (
    <span className={cn('font-mono text-2xs font-semibold', colorClass)}>
      {points}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    urgent: { label: 'Pilny',  className: 'compass-badge-danger' },
    high:   { label: 'Wysoki', className: 'compass-badge-progress' },
    medium: { label: 'Średni', className: 'compass-badge-todo' },
    low:    { label: 'Niski',  className: 'compass-badge-todo' },
  }
  const c = config[priority] ?? config.medium
  return <span className={cn('compass-badge', c.className)}>{c.label}</span>
}

interface FilterSelectProps {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}

function FilterSelect({ value, onChange, options }: FilterSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none cursor-pointer',
          'bg-compass-surface-2 border border-compass-border',
          'text-compass-muted text-xs font-body',
          'pl-2.5 pr-6 py-1.5 rounded-[3px]',
          'focus:outline-none focus:border-compass-accent/60',
          'transition-colors duration-150',
          value !== 'all' && 'text-compass-text border-compass-accent/40'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-compass-dim pointer-events-none"
      />
    </div>
  )
}
