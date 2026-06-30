'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { DbCycle, DbGoal, TaskSize } from '@/lib/supabase/types'
import { LayoutGrid, Trophy, Target, CalendarDays } from 'lucide-react'

// ─── constants ────────────────────────────────────────────────────────────────
const ROW_H = 34
const SECTION_H = 26
const HEADER_H = 38
const LEFT_W = 196

// ─── date helpers ─────────────────────────────────────────────────────────────
function parseDate(s: string): Date {
  if (s.length === 10) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  // ISO datetime — use local midnight of that date
  const base = new Date(s)
  return new Date(base.getFullYear(), base.getMonth(), base.getDate())
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

// ─── row union type ───────────────────────────────────────────────────────────
type GanttRow =
  | { kind: 'section'; label: string; icon: React.ElementType; count: number }
  | { kind: 'cycle'; cycle: DbCycle }
  | { kind: 'milestone'; goal: DbGoal }
  | { kind: 'objective'; goal: DbGoal }
  | { kind: 'keyresult'; goal: DbGoal }

// ─── props ────────────────────────────────────────────────────────────────────
interface GanttViewProps {
  cycles: DbCycle[]
  goals: DbGoal[]
  tasks?: Array<{ cycle_id: string | null; size?: TaskSize | null }>
}

// ─── gridlines (module scope — stable identity) ─────────────────────────────────
// Rendered per-row (not as one overlay) on purpose: section rows use the dimmer
// `light` variant while data rows use the normal variant, and each row clips its
// own gridlines to its height. A single full-height overlay can't reproduce that
// per-row light/normal distinction without a visual change, so we keep per-row
// rendering — but with a stable module-scope component identity + memoized props.
interface GridlinesProps {
  months: Array<{ x: number }>
  todayX: number
  light?: boolean
}

function Gridlines({ months, todayX, light = false }: GridlinesProps) {
  return (
    <>
      {months.map((m, i) => (
        <div
          key={i}
          style={{ left: m.x, position: 'absolute', top: 0, bottom: 0, width: 1 }}
          className={light ? 'bg-compass-border/20' : 'bg-compass-border/35'}
        />
      ))}
      <div
        style={{ left: todayX, position: 'absolute', top: 0, bottom: 0, width: 1 }}
        className="bg-compass-accent/50 z-10"
      />
    </>
  )
}

// ─── component ────────────────────────────────────────────────────────────────
const SIZE_ORDER: TaskSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function GanttView({ cycles, goals, tasks = [] }: GanttViewProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const [availTimelineWidth, setAvailTimelineWidth] = useState(800)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setAvailTimelineWidth(Math.max(400, entry.contentRect.width - LEFT_W))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { milestones, objectives, keyResults } = useMemo(() => ({
    milestones: goals.filter((g) => g.type === 'grant_milestone'),
    objectives: goals.filter((g) => g.type === 'objective'),
    keyResults: goals.filter((g) => g.type === 'key_result'),
  }), [goals])

  const isEmpty = cycles.length === 0 && goals.length === 0

  // ── Time range ──────────────────────────────────────────────────────────────
  const { rangeStart, totalDays } = useMemo(() => {
    const dates: Date[] = [
      today,
      ...cycles.map((c) => parseDate(c.start_date)),
      ...cycles.map((c) => parseDate(c.end_date)),
      ...goals.filter((g) => g.due_date).map((g) => parseDate(g.due_date!)),
    ]
    const minMs = Math.min(...dates.map((d) => d.getTime()))
    const maxMs = Math.max(...dates.map((d) => d.getTime()))
    const minDate = new Date(minMs)
    const maxDate = new Date(maxMs)

    const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1)
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0)
    return { rangeStart: start, totalDays: diffDays(start, end) }
  }, [cycles, goals, today])

  // pxPerDay fills the available container width; minimum 5px/day for readability
  const pxPerDay = totalDays > 0 ? Math.max(5, availTimelineWidth / totalDays) : 5

  const timelineWidth = totalDays * pxPerDay

  function xOf(date: Date): number {
    return Math.max(0, diffDays(rangeStart, date) * pxPerDay)
  }
  function wOf(start: Date, end: Date): number {
    return Math.max(pxPerDay * 2, diffDays(start, end) * pxPerDay)
  }

  // ── Month headers ───────────────────────────────────────────────────────────
  const months = useMemo(() => {
    const result: Array<{ label: string; x: number; width: number; isCurrent: boolean }> = []
    let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const rangeEnd = new Date(rangeStart.getTime() + totalDays * 86_400_000)
    while (cur <= rangeEnd) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      const x = diffDays(rangeStart, cur) * pxPerDay
      const width = diffDays(cur, next) * pxPerDay
      const isCurrent =
        cur.getFullYear() === today.getFullYear() && cur.getMonth() === today.getMonth()
      result.push({
        label: cur.toLocaleString('pl-PL', { month: 'short', year: '2-digit' }),
        x,
        width,
        isCurrent,
      })
      cur = next
    }
    return result
  }, [rangeStart, totalDays, today, pxPerDay])

  // ── Rows ─────────────────────────────────────────────────────────────────────
  const rows = useMemo((): GanttRow[] => [
    { kind: 'section', label: 'Sprinty', icon: LayoutGrid, count: cycles.length },
    ...cycles.map((c) => ({ kind: 'cycle' as const, cycle: c })),
    { kind: 'section', label: 'Milestony PARP', icon: Trophy, count: milestones.length },
    ...milestones.map((g) => ({ kind: 'milestone' as const, goal: g })),
    { kind: 'section', label: 'OKR Objectives', icon: Target, count: objectives.length },
    ...objectives.flatMap((obj) => [
      { kind: 'objective' as const, goal: obj },
      ...keyResults
        .filter((kr) => kr.parent_goal_id === obj.id)
        .map((kr) => ({ kind: 'keyresult' as const, goal: kr })),
    ]),
  ], [cycles, milestones, objectives, keyResults])

  // ── Per-cycle task size counts (memoized so ResizeObserver ticks don't recompute) ──
  const sizeCountsByCycle = useMemo(() => {
    const map = new Map<string, Partial<Record<TaskSize, number>>>()
    for (const cycle of cycles) {
      const cycleTasks = tasks.filter((t) => t.cycle_id === cycle.id)
      const sizeCounts = SIZE_ORDER.reduce<Partial<Record<TaskSize, number>>>((acc, s) => {
        const count = cycleTasks.filter((t) => (t.size ?? 'M') === s).length
        if (count > 0) acc[s] = count
        return acc
      }, {})
      map.set(cycle.id, sizeCounts)
    }
    return map
  }, [cycles, tasks])

  const todayX = xOf(today)

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-4">
        <CalendarDays size={32} className="text-compass-muted/40" strokeWidth={1} />
        <div className="text-center">
          <p className="text-sm font-medium text-compass-muted">Brak danych na osi czasu</p>
          <p className="text-xs text-compass-dim mt-1">
            Utwórz sprint lub cel OKR, aby zobaczyć harmonogram
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-auto min-h-0">
      <div className="flex flex-col min-h-full" style={{ minWidth: Math.max(600, LEFT_W + timelineWidth) }}>

        {/* ── Month header ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 flex" style={{ height: HEADER_H }}>
          {/* Corner */}
          <div
            className="flex-shrink-0 sticky left-0 z-40 bg-compass-surface border-b border-r border-compass-border flex items-end pb-2 px-3"
            style={{ width: LEFT_W, height: HEADER_H }}
          >
            <span className="font-mono text-2xs text-compass-dim tracking-widest uppercase">
              Oś czasu 2026
            </span>
          </div>
          {/* Month labels */}
          <div
            className="relative border-b border-compass-border bg-compass-surface flex-shrink-0"
            style={{ width: timelineWidth, height: HEADER_H }}
          >
            {months.map((m, i) => (
              <div
                key={i}
                style={{ left: m.x, width: m.width, height: HEADER_H, position: 'absolute' }}
                className={cn(
                  'flex items-end justify-center pb-2 font-mono text-2xs border-r border-compass-border/40',
                  m.isCurrent ? 'text-compass-accent font-semibold' : 'text-compass-dim',
                )}
              >
                {m.label}
              </div>
            ))}
            {/* Today marker in header */}
            <div
              style={{ left: todayX, position: 'absolute', top: 0, bottom: 0, width: 1 }}
              className="bg-compass-accent/60"
            />
            <div
              style={{ left: todayX - 3, bottom: 0, position: 'absolute', width: 7, height: 7 }}
              className="bg-compass-accent rounded-full -mb-[3px]"
            />
          </div>
        </div>

        {/* ── Body rows ────────────────────────────────────────────────────── */}
        {rows.map((row, idx) => {
          if (row.kind === 'section') {
            const Icon = row.icon
            return (
              <div key={idx} className="flex" style={{ height: SECTION_H }}>
                <div
                  className="flex-shrink-0 sticky left-0 z-20 bg-compass-surface-2 flex items-center gap-1.5 px-3 border-b border-r border-compass-border"
                  style={{ width: LEFT_W }}
                >
                  <Icon size={10} className="text-compass-dim" strokeWidth={1.5} />
                  <span className="compass-label">{row.label}</span>
                  <span className="ml-auto font-mono text-2xs text-compass-dim">{row.count}</span>
                </div>
                <div
                  className="relative bg-compass-surface-2/40 border-b border-compass-border flex-shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <Gridlines months={months} todayX={todayX} light />
                </div>
              </div>
            )
          }

          if (row.kind === 'cycle') {
            const { cycle } = row
            const start = parseDate(cycle.start_date)
            const end = parseDate(cycle.end_date)
            const x = xOf(start)
            const w = wOf(start, end)
            const sizeCounts = sizeCountsByCycle.get(cycle.id) ?? {}
            const hasSizes = Object.keys(sizeCounts).length > 0
            return (
              <div key={cycle.id} className="flex" style={{ height: ROW_H }}>
                <div
                  className="flex-shrink-0 sticky left-0 z-20 bg-compass-surface flex items-center gap-2 px-3 border-b border-r border-compass-border"
                  style={{ width: LEFT_W }}
                >
                  <span className={cn(
                    'font-mono text-2xs truncate flex-1',
                    cycle.is_active ? 'text-compass-text' : 'text-compass-dim',
                  )}>
                    {cycle.name}
                  </span>
                  {cycle.is_active && (
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-compass-accent animate-pulse" />
                  )}
                </div>
                <div
                  className="relative border-b border-compass-border flex-shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <Gridlines months={months} todayX={todayX} />
                  <div
                    style={{ left: x, width: w, top: 6, height: ROW_H - 12, position: 'absolute' }}
                    className={cn(
                      'rounded-[2px] flex items-center gap-2 px-2 overflow-hidden z-10',
                      cycle.is_active
                        ? 'bg-compass-accent/20 border border-compass-accent/50'
                        : 'bg-compass-surface-3 border border-compass-border',
                    )}
                  >
                    <span className={cn(
                      'font-mono text-2xs truncate leading-none flex-shrink-0',
                      cycle.is_active ? 'text-compass-accent' : 'text-compass-dim',
                    )}>
                      {cycle.name}
                    </span>
                    {hasSizes && (
                      <span className="flex items-center gap-1 ml-auto flex-shrink-0">
                        {(Object.entries(sizeCounts) as [TaskSize, number][]).map(([size, count]) => (
                          <span
                            key={size}
                            className={cn(
                              'font-mono leading-none',
                              'text-[9px]',
                              cycle.is_active ? 'text-compass-accent/70' : 'text-compass-dim/70',
                            )}
                          >
                            {count}{size}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          }

          if (row.kind === 'milestone') {
            const { goal } = row
            if (!goal.due_date) return null
            const dueDate = parseDate(goal.due_date)
            const x = xOf(dueDate)
            const isDone = goal.progress === 100
            const isOverdue = dueDate < today && !isDone
            const fillW = Math.round(x * goal.progress / 100)

            return (
              <div key={goal.id} className="flex" style={{ height: ROW_H }}>
                <div
                  className="flex-shrink-0 sticky left-0 z-20 bg-compass-surface flex items-center gap-2 px-3 border-b border-r border-compass-border"
                  style={{ width: LEFT_W }}
                >
                  <div className={cn(
                    'flex-shrink-0 w-2 h-2 rotate-45 border',
                    isDone
                      ? 'bg-compass-success/60 border-compass-success'
                      : isOverdue
                        ? 'bg-compass-danger/40 border-compass-danger'
                        : 'bg-compass-warning/40 border-compass-warning',
                  )} />
                  <span className="font-mono text-2xs truncate flex-1 text-compass-text">{goal.title}</span>
                  <span className={cn(
                    'ml-auto font-mono text-2xs flex-shrink-0',
                    isDone ? 'text-compass-success' : isOverdue ? 'text-compass-danger' : 'text-compass-warning',
                  )}>
                    {goal.progress}%
                  </span>
                </div>
                <div
                  className="relative border-b border-compass-border flex-shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <Gridlines months={months} todayX={todayX} />
                  {/* Runway track */}
                  {x > 0 && (
                    <div
                      style={{ left: 0, width: x, top: ROW_H / 2 - 1, height: 2, position: 'absolute' }}
                      className="bg-compass-surface-3 z-10"
                    />
                  )}
                  {/* Progress fill */}
                  {fillW > 0 && (
                    <div
                      style={{ left: 0, width: fillW, top: ROW_H / 2 - 1, height: 2, position: 'absolute' }}
                      className={cn(
                        'z-10',
                        isDone ? 'bg-compass-success' : isOverdue ? 'bg-compass-danger' : 'bg-compass-warning',
                      )}
                    />
                  )}
                  {/* Diamond at due_date */}
                  {x >= 0 && x <= timelineWidth && (
                    <div
                      style={{ left: x - 6, top: ROW_H / 2 - 6, width: 12, height: 12, position: 'absolute' }}
                      className={cn(
                        'rotate-45 border-2 z-20',
                        isDone
                          ? 'bg-compass-success/80 border-compass-success'
                          : isOverdue
                            ? 'bg-compass-danger/60 border-compass-danger'
                            : 'bg-compass-warning/60 border-compass-warning',
                      )}
                    />
                  )}
                </div>
              </div>
            )
          }

          if (row.kind === 'objective') {
            const { goal } = row
            const start = parseDate(goal.created_at)
            const end = goal.due_date
              ? parseDate(goal.due_date)
              : new Date(today.getTime() + 14 * 86_400_000)
            const x = xOf(start)
            const w = wOf(start, end)

            return (
              <div key={goal.id} className="flex" style={{ height: ROW_H }}>
                <div
                  className="flex-shrink-0 sticky left-0 z-20 bg-compass-surface flex items-center gap-2 px-3 border-b border-r border-compass-border"
                  style={{ width: LEFT_W }}
                >
                  <Target size={9} className="text-compass-accent flex-shrink-0" strokeWidth={2.5} />
                  <span className="font-mono text-2xs truncate flex-1 text-compass-text">{goal.title}</span>
                  <span className="ml-auto font-mono text-2xs text-compass-dim flex-shrink-0">{goal.progress}%</span>
                </div>
                <div
                  className="relative border-b border-compass-border flex-shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <Gridlines months={months} todayX={todayX} />
                  <div
                    style={{ left: x, width: w, top: 7, height: ROW_H - 14, position: 'absolute' }}
                    className="bg-compass-accent/10 border border-compass-accent/30 rounded-[2px] overflow-hidden z-10"
                  >
                    <div
                      style={{ width: `${goal.progress}%` }}
                      className="absolute inset-y-0 left-0 bg-compass-accent/20"
                    />
                  </div>
                </div>
              </div>
            )
          }

          if (row.kind === 'keyresult') {
            const { goal } = row
            const parentObj = objectives.find((o) => o.id === goal.parent_goal_id)
            const start = parentObj ? parseDate(parentObj.created_at) : parseDate(goal.created_at)
            const end = goal.due_date
              ? parseDate(goal.due_date)
              : new Date(today.getTime() + 14 * 86_400_000)
            const x = xOf(start)
            const w = wOf(start, end)

            return (
              <div key={goal.id} className="flex" style={{ height: ROW_H }}>
                <div
                  className="flex-shrink-0 sticky left-0 z-20 bg-compass-surface flex items-center gap-2 pl-6 pr-3 border-b border-r border-compass-border"
                  style={{ width: LEFT_W }}
                >
                  <span className="font-mono text-2xs truncate flex-1 text-compass-muted">{goal.title}</span>
                  <span className="ml-auto font-mono text-2xs text-compass-dim flex-shrink-0">{goal.progress}%</span>
                </div>
                <div
                  className="relative border-b border-compass-border flex-shrink-0"
                  style={{ width: timelineWidth }}
                >
                  <Gridlines months={months} todayX={todayX} />
                  <div
                    style={{ left: x, width: w, top: 10, height: ROW_H - 20, position: 'absolute' }}
                    className="bg-compass-surface-3 border border-compass-border rounded-[2px] overflow-hidden z-10"
                  >
                    <div
                      style={{ width: `${goal.progress}%` }}
                      className="absolute inset-y-0 left-0 bg-compass-accent/15"
                    />
                  </div>
                </div>
              </div>
            )
          }

          return null
        })}

        {/* spacer pushes legend to bottom when content is shorter than viewport */}
        <div className="flex-1" />

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        <div
          className="sticky left-0 flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 border-t border-compass-border bg-compass-surface"
          style={{ width: LEFT_W + timelineWidth }}
        >
          <span className="compass-label">Legenda:</span>
          <LegendBar
            className="bg-compass-accent/20 border border-compass-accent/50"
            label="Sprint aktywny"
          />
          <LegendBar
            className="bg-compass-surface-3 border border-compass-border"
            label="Sprint ukończony"
          />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rotate-45 bg-compass-warning/60 border-2 border-compass-warning flex-shrink-0" />
            <span className="font-mono text-2xs text-compass-muted">Milestone PARP</span>
          </div>
          <LegendBar
            className="bg-compass-accent/10 border border-compass-accent/30"
            label="OKR Objective"
          />
          <LegendBar
            className="bg-compass-surface-3 border border-compass-border"
            label="Key Result"
            short
          />
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-4 bg-compass-accent/60 flex-shrink-0" />
            <span className="font-mono text-2xs text-compass-muted">Dziś</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

interface LegendBarProps {
  className: string
  label: string
  short?: boolean
}

function LegendBar({ className, label, short = false }: LegendBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('h-3 rounded-[2px] flex-shrink-0', short ? 'w-5' : 'w-8', className)} />
      <span className="font-mono text-2xs text-compass-muted">{label}</span>
    </div>
  )
}
