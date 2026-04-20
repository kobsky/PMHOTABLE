'use client'

import { useState, useEffect, useTransition, use } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { getGoalById, updateGoal } from '@/app/actions/goals'
import { getProjects } from '@/app/actions/projects'
import { PageHeader } from '@/components/compass/page-header'
import type { DbGoal, DbProject, GoalStatus } from '@/lib/supabase/types'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

const STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'on_track',  label: 'Na dobrej drodze' },
  { value: 'at_risk',   label: 'Zagrożony' },
  { value: 'off_track', label: 'Opóźniony' },
  { value: 'achieved',  label: 'Osiągnięty' },
]

const STATUS_COLORS: Record<GoalStatus, string> = {
  on_track:  'text-compass-success',
  at_risk:   'text-compass-warning',
  off_track: 'text-compass-danger',
  achieved:  'text-compass-accent',
}

export default function GoalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [goal, setGoal] = useState<DbGoal | null>(null)
  const [projects, setProjects] = useState<DbProject[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    Promise.all([getGoalById(id), getProjects()]).then(([data, projs]) => {
      setGoal(data)
      setProjects(projs)
      setLoading(false)
    })
  }, [id])

  function patch<K extends keyof DbGoal>(key: K, value: DbGoal[K]) {
    setGoal((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  function handleSave() {
    if (!goal) return
    startTransition(async () => {
      const { error } = await updateGoal(goal.id, {
        title: goal.title,
        description: goal.description,
        status: goal.status,
        progress: goal.progress,
        project_id: goal.project_id,
        target_value: goal.target_value,
        current_value: goal.current_value,
        unit: goal.unit,
        quarter: goal.quarter,
        budget_planned_pln: goal.budget_planned_pln,
        budget_actual_pln: goal.budget_actual_pln,
        due_date: goal.due_date,
      })
      if (error) {
        toast.error(error)
      } else {
        toast.success('Cel zaktualizowany')
        router.push('/goals')
      }
    })
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <PageHeader title="Edytuj cel" />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-xs text-compass-dim animate-pulse">Ładowanie...</p>
        </div>
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="flex flex-col h-screen">
        <PageHeader title="Cel nie znaleziony" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-compass-muted mb-4">Cel nie istnieje lub został usunięty.</p>
            <Link href="/goals" className="compass-btn-primary text-sm px-4 py-2">
              Wróć do celów
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const budgetUsedPct =
    goal.budget_planned_pln && goal.budget_actual_pln
      ? Math.min(100, (goal.budget_actual_pln / goal.budget_planned_pln) * 100)
      : 0

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title={goal.title}
        subtitle={goal.type === 'grant_milestone' ? 'Grant milestone' : goal.type === 'objective' ? 'Objective' : 'Key Result'}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/goals"
              className="flex items-center gap-1.5 text-xs text-compass-muted hover:text-compass-text transition-colors px-2 py-1"
            >
              <ArrowLeft size={12} />
              Cele
            </Link>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="compass-btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
            >
              <Save size={12} />
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">

          {/* Projekt */}
          <div>
            <label className="compass-label mb-1.5 block">Projekt</label>
            <select
              value={goal.project_id ?? ''}
              onChange={(e) => patch('project_id', e.target.value || null)}
              className="compass-input w-full"
            >
              <option value="">— brak projektu —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="compass-label mb-1.5 block">Tytuł</label>
            <input
              type="text"
              value={goal.title}
              onChange={(e) => patch('title', e.target.value)}
              className="compass-input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="compass-label mb-1.5 block">Opis</label>
            <textarea
              value={goal.description ?? ''}
              onChange={(e) => patch('description', e.target.value || null)}
              rows={3}
              className="compass-input w-full resize-none"
              placeholder="Opcjonalny opis..."
            />
          </div>

          {/* Status + Progress */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="compass-label mb-1.5 block">Status</label>
              <select
                value={goal.status}
                onChange={(e) => patch('status', e.target.value as GoalStatus)}
                className="compass-input w-full"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className={`font-mono text-2xs mt-1 ${STATUS_COLORS[goal.status]}`}>
                {STATUS_OPTIONS.find((o) => o.value === goal.status)?.label}
              </p>
            </div>

            <div>
              <label className="compass-label mb-1.5 block">
                Postęp: <span className="text-compass-accent">{goal.progress}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={goal.progress}
                onChange={(e) => patch('progress', parseInt(e.target.value))}
                className="w-full accent-[#E8622A] mt-1"
              />
              <div className="h-1.5 bg-compass-surface-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-compass-accent rounded-full transition-all"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Target / Current value */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="compass-label mb-1.5 block">Wartość docelowa</label>
              <input
                type="number"
                value={goal.target_value ?? ''}
                onChange={(e) => patch('target_value', e.target.value ? parseFloat(e.target.value) : null)}
                className="compass-input w-full"
                placeholder="np. 100"
              />
            </div>
            <div>
              <label className="compass-label mb-1.5 block">Wartość aktualna</label>
              <input
                type="number"
                value={goal.current_value ?? ''}
                onChange={(e) => patch('current_value', e.target.value ? parseFloat(e.target.value) : null)}
                className="compass-input w-full"
                placeholder="np. 42"
              />
            </div>
            <div>
              <label className="compass-label mb-1.5 block">Jednostka</label>
              <input
                type="text"
                value={goal.unit ?? ''}
                onChange={(e) => patch('unit', e.target.value || null)}
                className="compass-input w-full"
                placeholder="%, użytkownicy, h"
              />
            </div>
          </div>

          {/* Quarter + Due date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="compass-label mb-1.5 block">Kwartał</label>
              <input
                type="text"
                value={goal.quarter ?? ''}
                onChange={(e) => patch('quarter', e.target.value || null)}
                className="compass-input w-full"
                placeholder="np. 2026-Q2"
              />
            </div>
            <div>
              <label className="compass-label mb-1.5 block">Termin</label>
              <input
                type="date"
                value={goal.due_date ?? ''}
                onChange={(e) => patch('due_date', e.target.value || null)}
                className="compass-input w-full"
              />
            </div>
          </div>

          {/* Budget (only for grant milestones) */}
          {goal.type === 'grant_milestone' && (
            <div className="compass-card p-4">
              <p className="text-sm font-semibold text-compass-text mb-3">Budżet (PLN)</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="compass-label mb-1.5 block">Zaplanowany</label>
                  <input
                    type="number"
                    value={goal.budget_planned_pln ?? ''}
                    onChange={(e) => patch('budget_planned_pln', e.target.value ? parseFloat(e.target.value) : null)}
                    className="compass-input w-full"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="compass-label mb-1.5 block">Wydany</label>
                  <input
                    type="number"
                    value={goal.budget_actual_pln ?? ''}
                    onChange={(e) => patch('budget_actual_pln', e.target.value ? parseFloat(e.target.value) : null)}
                    className="compass-input w-full"
                    placeholder="0.00"
                  />
                </div>
              </div>
              {goal.budget_planned_pln && (
                <>
                  <div className="flex justify-between text-2xs font-mono text-compass-dim mb-1">
                    <span>Utilizacja budżetu</span>
                    <span>{budgetUsedPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-compass-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetUsedPct > 90 ? 'bg-compass-danger' : 'bg-compass-success'}`}
                      style={{ width: `${budgetUsedPct}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/goals" className="text-xs text-compass-muted hover:text-compass-text transition-colors px-3 py-1.5">
              Anuluj
            </Link>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="compass-btn-primary flex items-center gap-1.5 text-xs px-4 py-2"
            >
              <Save size={12} />
              {isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
