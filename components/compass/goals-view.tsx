'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn, formatShortDate } from '@/lib/utils'
import { createGoal, updateGoalProgress, deleteGoal } from '@/app/actions/goals'
import { createProject, updateProject, archiveProject } from '@/app/actions/projects'
import type { DbGoal, GoalType, DbProject } from '@/lib/supabase/types'
import {
  Target, Trophy, Calendar, Plus, X, Loader2,
  ChevronRight, Trash2, Pencil, CheckCircle2, Banknote,
  FolderOpen, AlertTriangle,
} from 'lucide-react'

const PRESET_COLORS = [
  '#E8622A', '#4BAF87', '#F5A83A', '#DE4040',
  '#848179', '#5B8DD9', '#C084FC', '#34D399',
]

interface GoalsViewProps {
  goals: DbGoal[]
  projects: DbProject[]
}

export function GoalsView({ goals: initialGoals, projects: initialProjects }: GoalsViewProps) {
  const [goals, setGoals] = useState<DbGoal[]>(initialGoals)
  const [projects, setProjects] = useState<DbProject[]>(initialProjects)
  const [showNew, setShowNew] = useState(false)
  const [editingProgress, setEditingProgress] = useState<string | null>(null)

  // Wybrany projekt (filtr celów)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Project panel state
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [deletingProject, setDeletingProject] = useState<DbProject | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null)

  function startEditProject(project: DbProject) {
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
  }

  async function handleSaveProjectName(projectId: string) {
    const name = editingProjectName.trim()
    if (!name) { setEditingProjectId(null); return }
    const project = projects.find((p) => p.id === projectId)
    if (!project || name === project.name) { setEditingProjectId(null); return }

    setSavingProjectId(projectId)
    setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name } : p))
    setEditingProjectId(null)

    const { error } = await updateProject(projectId, { name })
    setSavingProjectId(null)
    if (error) {
      toast.error('Nie udało się zmienić nazwy', { description: error })
      setProjects((prev) => prev.map((p) => p.id === projectId ? { ...p, name: project.name } : p))
    }
  }

  async function handleDeleteProject(project: DbProject) {
    setDeletingProject(null)
    if (selectedProjectId === project.id) setSelectedProjectId(null)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    const { error } = await archiveProject(project.id)
    if (error) {
      toast.error('Nie udało się usunąć projektu', { description: error })
      setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      toast.success(`Projekt „${project.name}" usunięty`)
    }
  }

  function handleProjectCreated(project: DbProject) {
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)))
    setShowNewProject(false)
  }

  // Filtruj cele po wybranym projekcie (null = wszystkie)
  const visibleGoals = selectedProjectId
    ? goals.filter((g) => g.project_id === selectedProjectId)
    : goals

  const objectives = visibleGoals.filter((g) => g.type === 'objective')
  const keyResults = visibleGoals.filter((g) => g.type === 'key_result')
  const milestones = visibleGoals.filter((g) => g.type === 'grant_milestone')

  async function handleProgressUpdate(id: string, progress: number) {
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, progress } : g))
    setEditingProgress(null)
    const { error } = await updateGoalProgress(id, progress)
    if (error) toast.error('Nie udało się zaktualizować postępu')
  }

  async function handleDelete(id: string) {
    const prev = goals
    setGoals((g) => g.filter((goal) => goal.id !== id))
    const { error } = await deleteGoal(id)
    if (error) {
      toast.error('Nie udało się usunąć celu')
      setGoals(prev)
    }
  }

  function handleCreated(goal: DbGoal) {
    setGoals((prev) => [...prev, goal])
    setShowNew(false)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Lewy panel — projekty */}
      <aside className="w-52 flex-shrink-0 border-r border-compass-border flex flex-col bg-compass-surface overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
          <span className="compass-label flex items-center gap-1.5">
            <FolderOpen size={11} />
            Projekty
          </span>
          <span className="font-mono text-2xs text-compass-dim">{projects.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-1">
          {/* Wszystkie cele */}
          <button
            onClick={() => setSelectedProjectId(null)}
            className={cn(
              'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[3px] text-xs transition-colors mb-0.5',
              selectedProjectId === null
                ? 'bg-compass-surface-3 text-compass-text font-medium'
                : 'text-compass-muted hover:text-compass-text hover:bg-compass-surface-2'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-compass-muted flex-shrink-0" />
            <span className="truncate flex-1 text-left">Wszystkie cele</span>
            <span className="font-mono text-2xs text-compass-dim">{goals.length}</span>
          </button>

          {projects.length === 0 ? (
            <p className="text-2xs text-compass-dim italic px-2 py-2">Brak projektów</p>
          ) : (
            projects.map((project) => {
              const projectGoalCount = goals.filter((g) => g.project_id === project.id).length
              const isSelected = selectedProjectId === project.id
              return (
                <div
                  key={project.id}
                  className={cn(
                    'group flex items-center gap-1.5 px-2 py-1.5 rounded-[3px] transition-colors',
                    isSelected
                      ? 'bg-compass-surface-3 text-compass-text'
                      : 'hover:bg-compass-surface-2'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 cursor-pointer"
                    style={{ backgroundColor: project.color }}
                    onClick={() => editingProjectId !== project.id && setSelectedProjectId(isSelected ? null : project.id)}
                  />
                  {editingProjectId === project.id ? (
                    <input
                      autoFocus
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onBlur={() => handleSaveProjectName(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProjectName(project.id)
                        if (e.key === 'Escape') setEditingProjectId(null)
                      }}
                      className="compass-input text-xs flex-1 py-0 px-1 h-5 min-w-0"
                      maxLength={100}
                    />
                  ) : (
                    <button
                      className="text-xs truncate flex-1 text-left leading-tight"
                      onClick={() => setSelectedProjectId(isSelected ? null : project.id)}
                    >
                      {savingProjectId === project.id && (
                        <Loader2 size={10} className="inline animate-spin mr-1" />
                      )}
                      {project.name}
                    </button>
                  )}
                  {editingProjectId !== project.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {projectGoalCount > 0 && (
                        <span className="font-mono text-2xs text-compass-dim mr-0.5">{projectGoalCount}</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditProject(project) }}
                        className="compass-btn-ghost p-0.5 hover:text-compass-accent"
                        title="Zmień nazwę"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeletingProject(project) }}
                        className="compass-btn-ghost p-0.5 hover:text-compass-danger"
                        title="Usuń projekt"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="px-1.5 pb-2 pt-1 border-t border-compass-border flex-shrink-0">
          <button
            onClick={() => setShowNewProject(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[3px] text-xs text-compass-muted hover:text-compass-text hover:bg-compass-surface-2 transition-colors"
          >
            <Plus size={11} />
            Nowy projekt
          </button>
        </div>
      </aside>

      {/* Prawa strona — cele */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Nagłówek */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-compass-border flex-shrink-0">
          {selectedProjectId ? (
            (() => {
              const proj = projects.find((p) => p.id === selectedProjectId)
              return proj ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color }} />
                  <span className="text-sm font-semibold text-compass-text truncate">{proj.name}</span>
                  <span className="font-mono text-2xs text-compass-dim">
                    {objectives.length + keyResults.length} OKR · {milestones.length} milestoneów
                  </span>
                </div>
              ) : <div className="flex-1" />
            })()
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-semibold text-compass-text">Wszystkie cele</span>
              <span className="font-mono text-2xs text-compass-dim">
                {objectives.length + keyResults.length} OKR · {milestones.length} milestoneów
              </span>
            </div>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="compass-btn-primary text-xs flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus size={12} />
            Nowy cel
          </button>
        </div>

        {/* Zawartość — sekcje zamiast zakładek */}
        <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">
          {/* Sekcja OKR */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Target size={13} className="text-compass-accent" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold text-compass-text uppercase tracking-wider">Objectives & Key Results</h2>
              <span className="font-mono text-2xs text-compass-dim">{objectives.length + keyResults.length}</span>
            </div>
            <OKRView
              objectives={objectives}
              keyResults={keyResults}
              editingProgress={editingProgress}
              onEditProgress={setEditingProgress}
              onProgressUpdate={handleProgressUpdate}
              onDelete={handleDelete}
            />
          </section>

          {/* Sekcja Milestony */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={13} className="text-compass-warning" strokeWidth={1.5} />
              <h2 className="text-xs font-semibold text-compass-text uppercase tracking-wider">Milestony</h2>
              <span className="font-mono text-2xs text-compass-dim">{milestones.length}</span>
            </div>
            <GrantView
              milestones={milestones}
              editingProgress={editingProgress}
              onEditProgress={setEditingProgress}
              onProgressUpdate={handleProgressUpdate}
              onDelete={handleDelete}
            />
          </section>
        </div>
      </div>

      {/* Modals */}
      {showNew && (
        <NewGoalModal
          objectives={objectives}
          projects={projects}
          projectId={selectedProjectId}
          projectName={projects.find((p) => p.id === selectedProjectId)?.name ?? null}
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}
      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={handleProjectCreated}
        />
      )}
      {deletingProject && (
        <DeleteProjectConfirm
          project={deletingProject}
          onCancel={() => setDeletingProject(null)}
          onConfirm={() => handleDeleteProject(deletingProject)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// OKR View
// ---------------------------------------------------------------------------

interface OKRViewProps {
  objectives: DbGoal[]
  keyResults: DbGoal[]
  editingProgress: string | null
  onEditProgress: (id: string | null) => void
  onProgressUpdate: (id: string, progress: number) => void
  onDelete: (id: string) => void
}

function OKRView({ objectives, keyResults, editingProgress, onEditProgress, onProgressUpdate, onDelete }: OKRViewProps) {
  if (objectives.length === 0) {
    return (
      <EmptyState icon={Target} label="Brak Objectives. Dodaj pierwszy cel strategiczny." />
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {objectives.map((obj) => {
        const krs = keyResults.filter((kr) => kr.parent_goal_id === obj.id)
        const avgProgress = krs.length > 0
          ? Math.round(krs.reduce((sum, kr) => sum + kr.progress, 0) / krs.length)
          : obj.progress

        return (
          <div key={obj.id} className="compass-card overflow-hidden group">
            {/* Objective header */}
            <div className="p-4 border-b border-compass-border">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Target size={14} className="text-compass-accent flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-compass-text leading-snug">{obj.title}</h3>
                    {obj.description && (
                      <p className="text-xs text-compass-muted mt-0.5">{obj.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {obj.due_date && (
                    <span className="font-mono text-2xs text-compass-dim flex items-center gap-1">
                      <Calendar size={9} />
                      {formatShortDate(obj.due_date)}
                    </span>
                  )}
                  <Link
                    href={`/goals/${obj.id}`}
                    className="compass-btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Pencil size={11} />
                  </Link>
                  <button
                    onClick={() => onDelete(obj.id)}
                    className="compass-btn-ghost p-1 opacity-0 group-hover:opacity-100 hover:text-compass-danger transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {/* Avg progress */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-compass-accent rounded-full transition-all duration-500"
                    style={{ width: `${avgProgress}%` }}
                  />
                </div>
                <span className="font-mono text-2xs text-compass-dim w-8 text-right">{avgProgress}%</span>
              </div>
            </div>

            {/* Key Results */}
            <div className="divide-y divide-compass-border">
              {krs.length === 0 ? (
                <p className="px-4 py-3 text-xs text-compass-dim italic">Brak Key Results</p>
              ) : (
                krs.map((kr) => (
                  <KRRow
                    key={kr.id}
                    kr={kr}
                    isEditing={editingProgress === kr.id}
                    onEdit={() => onEditProgress(kr.id)}
                    onCancel={() => onEditProgress(null)}
                    onProgressUpdate={onProgressUpdate}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface KRRowProps {
  kr: DbGoal
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onProgressUpdate: (id: string, progress: number) => void
  onDelete: (id: string) => void
}

function KRRow({ kr, isEditing, onEdit, onCancel, onProgressUpdate, onDelete }: KRRowProps) {
  const [tempProgress, setTempProgress] = useState(kr.progress)
  const progressColor =
    kr.progress >= 80 ? 'bg-compass-success' :
    kr.progress >= 40 ? 'bg-compass-accent' :
    'bg-compass-warning'

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 group/kr hover:bg-compass-surface-2/30 transition-colors">
      <ChevronRight size={10} className="text-compass-dim flex-shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-compass-text truncate">{kr.title}</p>
        {!isEditing && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1 bg-compass-surface-2 rounded-full overflow-hidden max-w-[120px]">
              <div
                className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                style={{ width: `${kr.progress}%` }}
              />
            </div>
            <span className="font-mono text-2xs text-compass-dim">{kr.progress}%</span>
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={tempProgress}
              onChange={(e) => setTempProgress(Number(e.target.value))}
              className="flex-1 max-w-[120px] accent-compass-accent"
            />
            <span className="font-mono text-2xs text-compass-text w-8">{tempProgress}%</span>
            <button
              onClick={() => onProgressUpdate(kr.id, tempProgress)}
              className="compass-btn-ghost p-0.5 text-compass-success hover:bg-compass-success/10"
            >
              <CheckCircle2 size={12} />
            </button>
            <button
              onClick={onCancel}
              className="compass-btn-ghost p-0.5 hover:text-compass-danger"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {kr.due_date && (
          <span className="font-mono text-2xs text-compass-dim">{formatShortDate(kr.due_date)}</span>
        )}
        {!isEditing && (
          <button
            onClick={onEdit}
            className="compass-btn-ghost p-1 opacity-0 group-hover/kr:opacity-100 hover:text-compass-accent transition-all"
          >
            <Pencil size={10} />
          </button>
        )}
        <button
          onClick={() => onDelete(kr.id)}
          className="compass-btn-ghost p-1 opacity-0 group-hover/kr:opacity-100 hover:text-compass-danger transition-all"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grant View
// ---------------------------------------------------------------------------

interface GrantViewProps {
  milestones: DbGoal[]
  editingProgress: string | null
  onEditProgress: (id: string | null) => void
  onProgressUpdate: (id: string, progress: number) => void
  onDelete: (id: string) => void
}

function GrantView({ milestones, editingProgress, onEditProgress, onProgressUpdate, onDelete }: GrantViewProps) {
  if (milestones.length === 0) {
    return <EmptyState icon={Trophy} label="Brak milestoneów. Dodaj pierwszy milestone." />
  }

  const done = milestones.filter((m) => m.progress === 100).length
  const total = milestones.length

  return (
    <div className="max-w-2xl">
      {/* Postęp grantu */}
      <div className="compass-card p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="compass-label">Postęp milestoneów</span>
          <span className="font-display text-sm font-semibold text-compass-text">{done}/{total} milestoneów</span>
        </div>
        <div className="h-2 bg-compass-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-compass-warning to-compass-success rounded-full transition-all duration-700"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-2xs text-compass-dim">{done}/{total} ukończone</span>
          <span className="font-mono text-2xs text-compass-dim">{Math.round((done / total) * 100)}% ukończone</span>
        </div>

        {/* Łączny budżet */}
        {(() => {
          const totalPlanned = milestones.reduce((s, m) => s + (m.budget_planned_pln ?? 0), 0)
          const totalActual  = milestones.reduce((s, m) => s + (m.budget_actual_pln  ?? 0), 0)
          if (totalPlanned === 0 && totalActual === 0) return null
          const budgetPct = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0
          const isOver = totalActual > totalPlanned && totalPlanned > 0
          const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}\u00a0000 zł` : `${n} zł`
          return (
            <div className="mt-3 pt-3 border-t border-compass-border/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Banknote size={10} className="text-compass-dim" strokeWidth={1.5} />
                <span className="compass-label">Budżet łącznie</span>
                <span className={cn('font-mono text-2xs ml-auto', isOver ? 'text-compass-danger' : 'text-compass-muted')}>
                  {fmt(totalActual)} / {fmt(totalPlanned)}
                </span>
              </div>
              {totalPlanned > 0 && (
                <div className="h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', isOver ? 'bg-compass-danger' : 'bg-gradient-to-r from-compass-warning to-compass-success')}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Lista milestoneów */}
      <div className="flex flex-col gap-3">
        {milestones.map((milestone, idx) => (
          <MilestoneCard
            key={milestone.id}
            milestone={milestone}
            index={idx + 1}
            isEditing={editingProgress === milestone.id}
            onEdit={() => onEditProgress(milestone.id)}
            onCancel={() => onEditProgress(null)}
            onProgressUpdate={onProgressUpdate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

interface MilestoneCardProps {
  milestone: DbGoal
  index: number
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onProgressUpdate: (id: string, progress: number) => void
  onDelete: (id: string) => void
}

function MilestoneCard({ milestone, index, isEditing, onEdit, onCancel, onProgressUpdate, onDelete }: MilestoneCardProps) {
  const [tempProgress, setTempProgress] = useState(milestone.progress)

  const isDone = milestone.progress === 100
  const isOverdue = milestone.due_date && new Date(milestone.due_date) < new Date() && !isDone
  const progressColor =
    isDone ? 'bg-compass-success' :
    isOverdue ? 'bg-compass-danger' :
    milestone.progress >= 50 ? 'bg-compass-accent' :
    'bg-compass-warning'

  return (
    <div className={cn('compass-card p-4 group', isDone && 'opacity-80')}>
      <div className="flex items-start gap-3">
        {/* Numer milestone */}
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-semibold border',
          isDone
            ? 'bg-compass-success/20 border-compass-success/40 text-compass-success'
            : 'bg-compass-surface-2 border-compass-border text-compass-muted'
        )}>
          {isDone ? <CheckCircle2 size={13} strokeWidth={2} /> : index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={cn(
              'text-sm font-semibold text-compass-text leading-snug',
              isDone && 'line-through text-compass-muted'
            )}>
              {milestone.title}
            </h3>
            <div className="flex items-center gap-1 flex-shrink-0">
              {milestone.due_date && (
                <span className={cn(
                  'font-mono text-2xs flex items-center gap-1',
                  isOverdue ? 'text-compass-danger' : 'text-compass-dim'
                )}>
                  <Calendar size={9} />
                  {formatShortDate(milestone.due_date)}
                </span>
              )}
              <Link
                href={`/goals/${milestone.id}`}
                className="compass-btn-ghost p-1 opacity-0 group-hover:opacity-100 hover:text-compass-accent transition-all"
              >
                <Pencil size={11} />
              </Link>
              <button
                onClick={() => onDelete(milestone.id)}
                className="compass-btn-ghost p-1 opacity-0 group-hover:opacity-100 hover:text-compass-danger transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {milestone.description && (
            <p className="text-xs text-compass-muted mb-3">{milestone.description}</p>
          )}

          {/* Progress */}
          {!isEditing ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', progressColor)}
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
              <span className="font-mono text-2xs text-compass-dim w-8 text-right">{milestone.progress}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={tempProgress}
                onChange={(e) => setTempProgress(Number(e.target.value))}
                className="flex-1 accent-compass-accent"
              />
              <span className="font-mono text-2xs text-compass-text w-8">{tempProgress}%</span>
              <button
                onClick={() => onProgressUpdate(milestone.id, tempProgress)}
                className="compass-btn-ghost p-0.5 text-compass-success hover:bg-compass-success/10"
              >
                <CheckCircle2 size={13} />
              </button>
              <button
                onClick={onCancel}
                className="compass-btn-ghost p-0.5 hover:text-compass-danger"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Budget tracking */}
          {(milestone.budget_planned_pln != null || milestone.budget_actual_pln != null) && (
            <BudgetBar
              planned={milestone.budget_planned_pln}
              actual={milestone.budget_actual_pln}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NewGoalModal
// ---------------------------------------------------------------------------

interface NewGoalModalProps {
  objectives: DbGoal[]
  projects: DbProject[]
  projectId: string | null
  projectName: string | null
  onClose: () => void
  onCreated: (goal: DbGoal) => void
}

function NewGoalModal({ objectives, projects, projectId, projectName, onClose, onCreated }: NewGoalModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<GoalType>('objective')
  const [parentId, setParentId] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>(projectId ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const { error, goal } = await createGoal({
        title: title.trim(),
        type,
        description: description.trim() || null,
        projectId: selectedProject || null,
        parentGoalId: type === 'key_result' ? parentId || null : null,
        dueDate: dueDate || null,
      })

      if (error || !goal) {
        toast.error('Nie udało się dodać celu', { description: error ?? undefined })
      } else {
        toast.success('Cel dodany')
        onCreated(goal)
      }
    })
  }

  const typeOptions: { value: GoalType; label: string }[] = [
    { value: 'objective', label: 'Objective' },
    { value: 'key_result', label: 'Key Result' },
    { value: 'grant_milestone', label: 'Milestone' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-compass-surface border border-compass-border rounded-[4px] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
          <h2 className="text-sm font-semibold text-compass-text">Nowy cel</h2>
          <button onClick={onClose} className="compass-btn-ghost p-1"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {/* Projekt */}
          <div>
            <label className="compass-label block mb-1.5">Projekt</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="compass-input w-full text-sm"
              disabled={isPending}
            >
              <option value="">— brak projektu —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Typ */}
          {typeOptions.length > 1 && (
            <div>
              <label className="compass-label block mb-1.5">Typ</label>
              <div className="flex gap-1.5">
                {typeOptions.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-medium rounded-[3px] border transition-colors',
                      type === t.value
                        ? 'border-compass-accent bg-compass-accent-dim text-compass-accent'
                        : 'border-compass-border text-compass-muted hover:border-compass-border-strong'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parent Objective (tylko dla KR) */}
          {type === 'key_result' && objectives.length > 0 && (
            <div>
              <label className="compass-label block mb-1.5">Objective</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="compass-input w-full text-sm"
                disabled={isPending}
              >
                <option value="">— wybierz Objective —</option>
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tytuł */}
          <div>
            <label className="compass-label block mb-1.5">Tytuł</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'objective' ? 'Co chcemy osiągnąć?' :
                type === 'key_result' ? 'Jak zmierzymy sukces?' :
                'M1 — Tytuł milestone...'
              }
              className="compass-input w-full text-sm"
              disabled={isPending}
            />
          </div>

          {/* Opis */}
          <div>
            <label className="compass-label block mb-1.5">Opis (opcjonalny)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="compass-input w-full text-sm resize-none"
              rows={2}
              disabled={isPending}
            />
          </div>

          {/* Due date */}
          <div>
            <label className="compass-label block mb-1.5">Deadline</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="compass-input w-full text-sm"
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="compass-btn-outline text-xs" disabled={isPending}>
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isPending}
              className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Dodaj cel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function BudgetBar({ planned, actual }: { planned: number | null; actual: number | null }) {
  const p = planned ?? 0
  const a = actual ?? 0
  const pct = p > 0 ? Math.min(100, Math.round((a / p) * 100)) : 0
  const isOver = a > p && p > 0
  const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(0)}k zł` : `${n} zł`

  return (
    <div className="mt-3 pt-3 border-t border-compass-border/50">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Banknote size={10} className="text-compass-dim" strokeWidth={1.5} />
        <span className="compass-label">Budżet</span>
        <span className={cn('font-mono text-2xs ml-auto', isOver ? 'text-compass-danger' : 'text-compass-muted')}>
          {actual != null ? fmt(a) : '—'} / {planned != null ? fmt(p) : '—'}
        </span>
      </div>
      {p > 0 && (
        <div className="h-1 bg-compass-surface-2 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', isOver ? 'bg-compass-danger' : 'bg-compass-warning')}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="text-center py-12">
      <Icon size={24} className="text-compass-dim mx-auto mb-3" strokeWidth={1} />
      <p className="text-sm text-compass-muted">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// NewProjectModal
// ---------------------------------------------------------------------------

interface NewProjectModalProps {
  onClose: () => void
  onCreated: (project: DbProject) => void
}

function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#848179')
  const [description, setDescription] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    startTransition(async () => {
      const { error, project } = await createProject({
        name: name.trim(),
        scope_tag: 'ops',
        color,
        description: description.trim() || null,
      })

      if (error || !project) {
        toast.error('Nie udało się utworzyć projektu', { description: error ?? undefined })
      } else {
        toast.success(`Projekt „${project.name}" utworzony`)
        onCreated(project)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-compass-surface border border-compass-border rounded-[4px] w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
          <h2 className="text-sm font-semibold text-compass-text">Nowy projekt</h2>
          <button onClick={onClose} className="compass-btn-ghost p-1"><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          {/* Nazwa */}
          <div>
            <label className="compass-label block mb-1.5">Nazwa</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa projektu..."
              className="compass-input w-full text-sm"
              maxLength={100}
              disabled={isPending}
            />
          </div>

          {/* Kolor */}
          <div>
            <label className="compass-label block mb-1.5">Kolor</label>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 transition-all',
                      color === c ? 'border-compass-text scale-110' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="compass-input text-xs w-24 font-mono"
                placeholder="#848179"
                disabled={isPending}
              />
            </div>
          </div>

          {/* Opis */}
          <div>
            <label className="compass-label block mb-1.5">Opis (opcjonalny)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="compass-input w-full text-sm resize-none"
              rows={2}
              maxLength={500}
              disabled={isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="compass-btn-outline text-xs" disabled={isPending}>
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isPending}
              className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Utwórz projekt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeleteProjectConfirm
// ---------------------------------------------------------------------------

interface DeleteProjectConfirmProps {
  project: DbProject
  onCancel: () => void
  onConfirm: () => void
}

function DeleteProjectConfirm({ project, onCancel, onConfirm }: DeleteProjectConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-compass-surface border border-compass-border rounded-[4px] w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
          <h2 className="text-sm font-semibold text-compass-text">Usuń projekt</h2>
          <button onClick={onCancel} className="compass-btn-ghost p-1"><X size={14} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-compass-warning flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="text-sm text-compass-text">
                Czy na pewno chcesz usunąć projekt{' '}
                <span className="font-semibold">„{project.name}"</span>?
              </p>
              <p className="text-xs text-compass-muted mt-1">
                Projekt zostanie zarchiwizowany i zniknie z listy. Powiązane zadania nie zostaną usunięte.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onCancel} className="compass-btn-outline text-xs">
              Anuluj
            </button>
            <button
              onClick={onConfirm}
              className="text-xs px-3 py-1.5 rounded-[3px] bg-compass-danger/90 hover:bg-compass-danger text-white font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={11} />
              Usuń projekt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
