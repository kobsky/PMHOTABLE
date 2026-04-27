'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TaskCard } from './task-card'
import dynamic from 'next/dynamic'
const TaskDetailModal = dynamic(
  () => import('./task-detail-modal').then(m => m.TaskDetailModal),
  { ssr: false }
)
import { WipWarning } from './wip-warning'
import { QuickAddTask } from './quick-add-task'
import { updateTaskStatus, reorderColumn } from '@/app/actions/tasks'
import { updateCycleNotes, addCycleLink, removeCycleLink, addUnavailableDate, removeUnavailableDate } from '@/app/actions/cycles'
import type { TaskWithRelations, TaskStatus, DbProject, DbUser, DbCycle, SprintLink, SprintLinkLabel, UnavailabilityEntry } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Plus, TrendingUp, StickyNote, Users, ChevronDown, ChevronUp, ExternalLink, X, Link2, AlertTriangle } from 'lucide-react'

const WIP_LIMIT = 3

interface Column {
  id: TaskStatus
  label: string
}

const COLUMNS: Column[] = [
  { id: 'todo',        label: 'Do zrobienia' },
  { id: 'in_progress', label: 'W toku' },
  { id: 'done',        label: 'Gotowe' },
]

interface SprintBoardProps {
  initialTasks: TaskWithRelations[]
  cycleId: string
  projects: DbProject[]
  profiles: DbUser[]
  cycles: DbCycle[]
  assigneeId: string | null
  velocityPlanned?: number | null
  activeCycle?: DbCycle | null
}

export function SprintBoard({ initialTasks, cycleId, projects, profiles, cycles, assigneeId, velocityPlanned, activeCycle }: SprintBoardProps) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks)
  const [addingToColumn, setAddingToColumn] = useState<TaskStatus | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null)
  const router = useRouter()

  // Realtime subscription — odświeża board gdy inny user zmieni dane
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`board-cycle-${cycleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `cycle_id=eq.${cycleId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === payload.new.id
                  ? { ...t, ...(payload.new as Partial<TaskWithRelations>) }
                  : t
              )
            )
          }
          if (payload.eventType === 'INSERT') {
            // router.refresh() re-fetches Server Components without a full page reload
            router.refresh()
          }
          if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cycleId, router])

  // Sync state when server re-renders after router.refresh()
  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  const getTasksForColumn = useCallback(
    (status: TaskStatus): TaskWithRelations[] =>
      tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.position - b.position),
    [tasks]
  )

  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length
  const activeTasks = tasks.filter((t) => t.status !== 'cancelled')
  const usedPoints = activeTasks.reduce((sum, t) => sum + (t.story_points ?? 0), 0)
  const velocityTarget = velocityPlanned ?? usedPoints

  async function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) return

    const newStatus = destination.droppableId as TaskStatus
    const isSameColumn = source.droppableId === destination.droppableId

    // Sprawdź WIP limit
    if (newStatus === 'in_progress' && !isSameColumn) {
      if (inProgressCount >= WIP_LIMIT) {
        toast.warning(`WIP limit: max ${WIP_LIMIT} zadania w toku`, {
          description: 'Ukończ jedno z aktywnych zadań przed dodaniem kolejnego.',
        })
        return
      }
    }

    if (isSameColumn) {
      // Reorder within same column — update positions for all tasks in column
      const colTasks = getTasksForColumn(newStatus)
      const reordered = [...colTasks]
      const [moved] = reordered.splice(source.index, 1)
      reordered.splice(destination.index, 0, moved)

      // Optimistic update with new positions
      const positionMap = new Map(reordered.map((t, i) => [t.id, i]))
      setTasks((prev) =>
        prev.map((t) =>
          positionMap.has(t.id)
            ? { ...t, position: positionMap.get(t.id)! }
            : t
        )
      )

      // Persist all positions in this column
      const { error } = await reorderColumn(reordered.map((t) => t.id))
      if (error) {
        toast.error('Nie udało się zapisać kolejności')
        setTasks(tasks) // rollback
      }
    } else {
      // Move to different column — optimistic update
      const prevTasks = tasks
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggableId
            ? { ...t, status: newStatus, position: destination.index, updated_at: new Date().toISOString() }
            : t
        )
      )

      // Persist do Supabase
      const { error } = await updateTaskStatus(draggableId, newStatus, destination.index)
      if (error) {
        toast.error('Nie udało się zaktualizować statusu')
        setTasks(prevTasks)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Velocity bar */}
      <div className="flex items-center gap-3 px-1">
        <TrendingUp size={12} className="text-compass-muted flex-shrink-0" strokeWidth={1.5} />
        <div className="flex-1 h-1 bg-compass-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-compass-success transition-all duration-500 rounded-full"
            style={{ width: `${velocityTarget > 0 ? Math.min(100, (usedPoints / velocityTarget) * 100) : 0}%` }}
          />
        </div>
        <span className="font-mono text-2xs text-compass-dim whitespace-nowrap">
          {usedPoints}
          {velocityPlanned ? `/${velocityPlanned} pkt` : ` pkt`}
        </span>
      </div>

      {/* Sprint Info Panel — Notes + Team Availability */}
      {activeCycle && (
        <SprintInfoPanel cycle={activeCycle} profiles={profiles} />
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid gap-3 flex-1" style={{ gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
          {COLUMNS.map((col) => {
            const colTasks = getTasksForColumn(col.id)
            const isInProgress = col.id === 'in_progress'
            const atWipLimit = isInProgress && inProgressCount >= WIP_LIMIT

            return (
              <div key={col.id} className="flex flex-col gap-2">
                {/* Nagłówek kolumny */}
                <div
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-[3px] border',
                    atWipLimit
                      ? 'border-compass-danger/50 bg-compass-danger/5 animate-wip-pulse'
                      : 'border-compass-border bg-compass-surface'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StatusDot status={col.id} />
                    <span className="text-xs font-semibold text-compass-text">
                      {col.label}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-2xs px-1.5 py-0.5 rounded-[2px]',
                        atWipLimit
                          ? 'bg-compass-danger/20 text-compass-danger'
                          : 'bg-compass-surface-2 text-compass-dim'
                      )}
                    >
                      {colTasks.length}
                      {isInProgress && `/${WIP_LIMIT}`}
                    </span>
                  </div>
                  <button
                    className="compass-btn-ghost p-1 rounded-[2px]"
                    title="Dodaj zadanie"
                    onClick={() => setAddingToColumn(addingToColumn === col.id ? null : col.id)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {/* WIP warning */}
                {atWipLimit && (
                  <WipWarning count={inProgressCount} limit={WIP_LIMIT} />
                )}

                {/* Quick add — otwiera się pod nagłówkiem kolumny */}
                {addingToColumn === col.id && (
                  <QuickAddTask
                    projects={projects}
                    assigneeId={assigneeId}
                    cycleId={cycleId}
                    onClose={() => setAddingToColumn(null)}
                  />
                )}

                {/* Drop zone */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'flex-1 flex flex-col gap-1.5 rounded-[3px] p-1.5 transition-colors duration-150 min-h-[100px]',
                        snapshot.isDraggingOver
                          ? 'bg-compass-accent/5 border border-compass-accent/20'
                          : 'bg-compass-surface/40 border border-transparent'
                      )}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              onClick={() => { if (!snap.isDragging) setSelectedTask(task) }}
                            >
                              <TaskCard task={task} dragging={snap.isDragging} unavailability={activeCycle?.unavailability ?? undefined} profiles={profiles} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-center font-mono text-2xs text-compass-dim py-6 uppercase tracking-wider">
                          Brak zadań
                        </p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Task detail modal — opens on task card click */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          projects={projects}
          profiles={profiles}
          cycles={cycles}
          open={!!selectedTask}
          onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
          onDeleted={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId))
            setSelectedTask(null)
          }}
          onUpdated={(taskId, patch) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
            )
            setSelectedTask((prev) => prev ? { ...prev, ...patch } : null)
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SprintInfoPanel — collapsible notes + links + team availability
// ---------------------------------------------------------------------------

const LINK_LABEL_COLORS: Record<SprintLinkLabel, string> = {
  blocker: 'text-compass-danger border-compass-danger/40 bg-compass-danger/10',
  info:    'text-compass-muted border-compass-border bg-compass-surface-2',
  doc:     'text-compass-accent border-compass-accent/40 bg-compass-accent/10',
}

const UNAVAIL_REASONS = ['wakacje', 'chorobowe', 'konferencja', 'szkolenie', 'inne']

function SprintInfoPanel({ cycle, profiles }: { cycle: DbCycle; profiles: DbUser[] }) {
  const [showNotes, setShowNotes] = useState(false)
  const [showAvail, setShowAvail] = useState(false)
  const [notes, setNotes] = useState(cycle.notes ?? '')
  const [notesSaving, setNotesSaving] = useState(false)
  const [addLinkOpen, setAddLinkOpen] = useState(false)
  const [linkForm, setLinkForm] = useState({ title: '', url: '', label: 'info' as SprintLinkLabel })
  const [links, setLinks] = useState<SprintLink[]>((cycle.sprint_links as SprintLink[] | null) ?? [])
  const [unavailability, setUnavailability] = useState<Record<string, UnavailabilityEntry[]>>(
    (cycle.unavailability as Record<string, UnavailabilityEntry[]> | null) ?? {}
  )
  const [newDate, setNewDate] = useState('')
  const [newReason, setNewReason] = useState('wakacje')
  const [addingFor, setAddingFor] = useState<string | null>(null)

  async function handleSaveNotes() {
    setNotesSaving(true)
    const { error } = await updateCycleNotes(cycle.id, notes)
    setNotesSaving(false)
    if (error) toast.error('Nie udało się zapisać notatek')
    else toast.success('Notatki zapisane')
  }

  async function handleAddLink() {
    if (!linkForm.title.trim() || !linkForm.url.trim()) return
    const { error } = await addCycleLink(cycle.id, linkForm)
    if (error) { toast.error(error); return }
    const newLink: SprintLink = { id: Date.now().toString(), ...linkForm }
    setLinks((l) => [...l, newLink])
    setLinkForm({ title: '', url: '', label: 'info' })
    setAddLinkOpen(false)
  }

  async function handleRemoveLink(id: string) {
    const { error } = await removeCycleLink(cycle.id, id)
    if (!error) setLinks((l) => l.filter((x) => x.id !== id))
  }

  async function handleAddUnavail(userId: string) {
    if (!newDate) return
    const { error } = await addUnavailableDate(cycle.id, userId, newDate, newReason)
    if (error) { toast.error(error); return }
    setUnavailability((u) => ({
      ...u,
      [userId]: [...(u[userId] ?? []), { date: newDate, reason: newReason }],
    }))
    setNewDate('')
    setAddingFor(null)
  }

  async function handleRemoveUnavail(userId: string, date: string) {
    const { error } = await removeUnavailableDate(cycle.id, userId, date)
    if (!error) {
      setUnavailability((u) => ({
        ...u,
        [userId]: (u[userId] ?? []).filter((e) => e.date !== date),
      }))
    }
  }

  const sprintDays = Math.ceil(
    (new Date(cycle.end_date).getTime() - new Date(cycle.start_date).getTime()) / 86400000
  )

  return (
    <div className="flex gap-2">
      {/* Notes + Links toggle */}
      <div className="flex-1 bg-compass-surface border border-compass-border rounded-[3px] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowNotes((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-compass-muted hover:text-compass-text hover:bg-compass-surface-2 transition-colors"
        >
          <StickyNote size={12} strokeWidth={1.5} />
          <span className="font-medium">Notatki sprintu</span>
          {links.length > 0 && (
            <span className="font-mono text-2xs text-compass-dim ml-1">{links.length} linki</span>
          )}
          <span className="ml-auto">
            {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </button>

        {showNotes && (
          <div className="px-3 pb-3 space-y-3 border-t border-compass-border">
            {/* Notes textarea */}
            <div className="pt-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notatki, decyzje, kontekst sprintu…"
                className="w-full compass-input text-xs resize-none"
              />
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={notesSaving}
                className="mt-1.5 compass-btn-outline text-xs px-2.5 py-1 disabled:opacity-40"
              >
                {notesSaving ? 'Zapisywanie…' : 'Zapisz notatki'}
              </button>
            </div>

            {/* Links */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="compass-label">Linki</p>
                <button
                  type="button"
                  onClick={() => setAddLinkOpen((v) => !v)}
                  className="flex items-center gap-1 font-mono text-2xs text-compass-dim hover:text-compass-accent transition-colors"
                >
                  <Link2 size={10} />
                  Dodaj link
                </button>
              </div>

              {addLinkOpen && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="Tytuł"
                    value={linkForm.title}
                    onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))}
                    className="compass-input text-xs flex-1 min-w-[100px]"
                  />
                  <input
                    type="url"
                    placeholder="URL"
                    value={linkForm.url}
                    onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
                    className="compass-input text-xs flex-1 min-w-[140px]"
                  />
                  <select
                    value={linkForm.label}
                    onChange={(e) => setLinkForm((f) => ({ ...f, label: e.target.value as SprintLinkLabel }))}
                    className="compass-input text-xs"
                  >
                    <option value="blocker">Blocker</option>
                    <option value="info">Info</option>
                    <option value="doc">Docs</option>
                  </select>
                  <button type="button" onClick={handleAddLink} className="compass-btn-primary text-xs px-3">Dodaj</button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] border text-2xs font-mono', LINK_LABEL_COLORS[link.label])}
                  >
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                      <ExternalLink size={9} />
                      {link.title}
                    </a>
                    <button type="button" onClick={() => handleRemoveLink(link.id)} className="opacity-50 hover:opacity-100">
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Team Availability toggle */}
      <div className="flex-1 bg-compass-surface border border-compass-border rounded-[3px] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAvail((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-compass-muted hover:text-compass-text hover:bg-compass-surface-2 transition-colors"
        >
          <Users size={12} strokeWidth={1.5} />
          <span className="font-medium">Dostępność zespołu</span>
          <span className="ml-auto">
            {showAvail ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </button>

        {showAvail && (
          <div className="px-3 pb-3 space-y-3 border-t border-compass-border pt-3">
            {profiles.map((profile) => {
              const entries = unavailability[profile.id] ?? []
              const availDays = sprintDays - entries.length
              const pct = sprintDays > 0 ? availDays / sprintDays : 1
              const barColor = pct >= 0.8 ? 'bg-compass-success' : pct >= 0.5 ? 'bg-compass-warning' : 'bg-compass-danger'

              return (
                <div key={profile.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-compass-text font-medium">
                      {profile.full_name ?? profile.email}
                    </span>
                    <span className="font-mono text-2xs text-compass-dim">{availDays}/{sprintDays} dni</span>
                  </div>
                  <div className="h-1 bg-compass-surface-2 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct * 100}%` }} />
                  </div>
                  {entries.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {entries.map((e) => (
                        <div key={e.date} className="flex items-center gap-1 text-2xs font-mono text-compass-dim border border-compass-border rounded-[3px] px-1.5 py-0.5">
                          <AlertTriangle size={9} className="text-compass-warning" />
                          {e.date}
                          <span className="text-compass-dim/60">{e.reason}</span>
                          <button type="button" onClick={() => handleRemoveUnavail(profile.id, e.date)} className="opacity-50 hover:opacity-100 ml-0.5">
                            <X size={9} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {addingFor === profile.id ? (
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <input
                        type="date"
                        value={newDate}
                        min={cycle.start_date}
                        max={cycle.end_date}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="compass-input text-xs"
                      />
                      <select
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                        className="compass-input text-xs"
                      >
                        {UNAVAIL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="button" onClick={() => handleAddUnavail(profile.id)} className="compass-btn-primary text-xs px-2.5">Dodaj</button>
                      <button type="button" onClick={() => setAddingFor(null)} className="compass-btn-outline text-xs px-2">Anuluj</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingFor(profile.id)}
                      className="text-2xs font-mono text-compass-dim hover:text-compass-accent transition-colors flex items-center gap-1"
                    >
                      <Plus size={9} />
                      Dodaj dzień niedostępności
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = {
    todo:        'bg-compass-border-strong',
    in_progress: 'bg-compass-warning',
    in_review:   'bg-compass-accent',
    done:        'bg-compass-success',
    cancelled:   'bg-compass-danger',
  }

  return (
    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[status])} />
  )
}
