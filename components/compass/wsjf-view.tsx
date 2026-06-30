'use client'

// ============================================================
// components/compass/wsjf-view.tsx — U5 SAFe WSJF (decision support)
// ============================================================
// WSPOMAGANIE DECYZJI (decision support) — NIE jest to model ML ani wywołanie
// LLM. Widok pozwala oszacować 4 wejścia WSJF na skali Fibonacciego per zadanie,
// pokazuje policzony WSJF (lib/wsjf.computeWsjf) oraz ranking malejący.
//
// Logowanie do ai_feedback (feature='wsjf_prioritization') rejestruje WYŁĄCZNIE
// surowe interakcje: 'apply' (zapis oszacowania) oraz 'dismiss' (porzucenie
// edycji bez zapisu). NIE liczymy ani nie twierdzimy "skuteczności" — adopcja
// to nie skuteczność.
// ============================================================

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { setWsjfInputs, type WsjfRankedTask } from '@/app/actions/wsjf'
import { logAIFeedback } from '@/app/actions/ai'
import {
  computeWsjf,
  hasValidWsjfInputs,
  WSJF_FIBONACCI,
  type WsjfInputs,
} from '@/lib/wsjf'
import type { TaskWithRelations } from '@/lib/supabase/types'
import {
  Scale,
  AlertTriangle,
  ListOrdered,
  SlidersHorizontal,
  Loader2,
  Check,
  X,
  Info,
} from 'lucide-react'

interface WsjfViewProps {
  tasks: TaskWithRelations[]
  ranking: WsjfRankedTask[]
}

type Tab = 'ranking' | 'estimate'

// Lokalny, edytowalny stan 4 wejść (każde może być jeszcze niewybrane).
type DraftInputs = Partial<WsjfInputs>

function draftFromTask(t: TaskWithRelations): DraftInputs {
  return {
    userValue: t.wsjf_user_value ?? undefined,
    timeCriticality: t.wsjf_time_criticality ?? undefined,
    riskReduction: t.wsjf_risk_reduction ?? undefined,
    jobSize: t.wsjf_job_size ?? undefined,
  }
}

function fmtWsjf(value: number): string {
  return value.toFixed(2)
}

export function WsjfView({ tasks, ranking }: WsjfViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('ranking')

  // Optymistyczna kopia oszacowań — klucz po id zadania.
  const [drafts, setDrafts] = useState<Record<string, DraftInputs>>(() => {
    const init: Record<string, DraftInputs> = {}
    for (const t of tasks) init[t.id] = draftFromTask(t)
    return init
  })

  // Ranking liczony lokalnie z bieżących draftów, żeby po zapisie kolejność
  // odświeżyła się natychmiast (a nie dopiero po revalidatePath).
  const liveRanking = useMemo(() => {
    const rows = tasks
      .map((task) => ({ task, wsjf: computeWsjf(drafts[task.id] ?? {}) }))
      .filter((r): r is { task: TaskWithRelations; wsjf: number } => r.wsjf !== null)
    rows.sort((a, b) => b.wsjf - a.wsjf)
    return rows
  }, [tasks, drafts])

  const estimatedCount = liveRanking.length

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Zakładki */}
      <div className="flex items-center gap-0 px-6 pt-4 border-b border-compass-border">
        <TabButton
          active={activeTab === 'ranking'}
          onClick={() => setActiveTab('ranking')}
          icon={ListOrdered}
          label="Ranking"
          count={estimatedCount}
        />
        <TabButton
          active={activeTab === 'estimate'}
          onClick={() => setActiveTab('estimate')}
          icon={SlidersHorizontal}
          label="Oszacuj"
          count={tasks.length}
        />
      </div>

      {/* Wzór + skala */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-compass-border bg-compass-surface/30 flex-wrap">
        <Scale size={13} className="text-compass-accent shrink-0" />
        <span className="compass-label">WSJF =</span>
        <span className="font-mono text-2xs text-compass-muted">
          (User Value + Time Criticality + Risk Reduction) ÷ Job Size
        </span>
        <span className="ml-auto font-mono text-2xs text-compass-dim">
          Skala Fibonacciego: {WSJF_FIBONACCI.join(' · ')}
        </span>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Banner ograniczeń — WIDOCZNY w każdej zakładce (DoD) */}
        <LimitationsBanner />

        {activeTab === 'ranking' ? (
          <RankingPanel liveRanking={liveRanking} initialRanking={ranking} />
        ) : (
          <EstimatePanel
            tasks={tasks}
            drafts={drafts}
            setDrafts={setDrafts}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Banner ograniczeń WSJF (jawnie udokumentowane w UI — wymóg DoD)
// ---------------------------------------------------------------------------

function LimitationsBanner() {
  return (
    <div className="mb-6 max-w-3xl compass-card p-4 border-compass-warning/30 bg-compass-warning/5">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={14} className="text-compass-warning shrink-0" />
        <span className="font-mono text-2xs text-compass-warning uppercase tracking-wider">
          Ograniczenia WSJF — czytaj zanim zaufasz kolejności
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-compass-muted leading-snug">
        <li className="flex gap-2">
          <span className="text-compass-dim shrink-0">1.</span>
          <span>
            <span className="text-compass-text font-medium">Subiektywność wejść.</span>{' '}
            Cztery komponenty to relatywne oszacowania ekspertów na skali
            Fibonacciego — różni oceniający dają różne liczby dla tego samego
            zadania.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-compass-dim shrink-0">2.</span>
          <span>
            <span className="text-compass-text font-medium">Podwójne liczenie.</span>{' '}
            User Value, Time Criticality i Risk Reduction często się nakładają,
            więc ta sama &bdquo;wartość&rdquo; bywa liczona wielokrotnie w liczniku
            (Cost of Delay).
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-compass-dim shrink-0">3.</span>
          <span>
            <span className="text-compass-text font-medium">
              Inflacja pojedynczego interesariusza.
            </span>{' '}
            Przy jednym oceniającym (tu: 3-osobowy zespół) brak uśrednienia
            perspektyw sprzyja zawyżaniu wartości pod własne priorytety.
          </span>
        </li>
      </ul>
      <p className="mt-2.5 pt-2.5 border-t border-compass-warning/15 text-2xs text-compass-dim flex items-start gap-1.5">
        <Info size={11} className="text-compass-dim shrink-0 mt-0.5" />
        WSJF to <span className="text-compass-muted">podpowiedź kolejności</span>, a
        nie wyrocznia. Finalną decyzję podejmuje człowiek.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zakładka RANKING — lista malejąca po WSJF
// ---------------------------------------------------------------------------

function RankingPanel({
  liveRanking,
  initialRanking,
}: {
  liveRanking: { task: TaskWithRelations; wsjf: number }[]
  initialRanking: WsjfRankedTask[]
}) {
  // initialRanking służy jako fallback gdyby liveRanking był pusty mimo danych
  // serwera (np. brak hydratacji draftów) — w praktyce liveRanking jest źródłem.
  const rows = liveRanking.length > 0 ? liveRanking : initialRanking

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 max-w-3xl">
        <ListOrdered size={24} className="text-compass-dim mx-auto mb-3" strokeWidth={1} />
        <p className="text-sm text-compass-muted">Brak oszacowanych zadań</p>
        <p className="text-xs text-compass-dim mt-1">
          Przejdź do zakładki &bdquo;Oszacuj&rdquo;, aby nadać zadaniom wejścia WSJF.
        </p>
      </div>
    )
  }

  const top = rows[0].wsjf

  return (
    <div className="max-w-3xl flex flex-col gap-2">
      {rows.map(({ task, wsjf }, index) => {
        const pct = top > 0 ? Math.round((wsjf / top) * 100) : 0
        return (
          <div
            key={task.id}
            className="compass-card p-3 flex items-center gap-3"
          >
            <span className="font-mono text-xs text-compass-dim w-6 text-right shrink-0">
              {index + 1}.
            </span>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: task.project?.color ?? '#848179' }}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-compass-text truncate leading-tight">
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-2xs text-compass-dim">
                  {task.project?.name ?? 'Bez projektu'}
                </span>
                {task.assignee?.full_name && (
                  <span className="font-mono text-2xs text-compass-dim">
                    · {task.assignee.full_name.split(' ')[0]}
                  </span>
                )}
              </div>
            </div>
            {/* Pasek udziału względem najwyższego WSJF */}
            <div className="hidden sm:block w-24 h-1.5 rounded-full bg-compass-surface-3 overflow-hidden shrink-0">
              <div
                className="h-full bg-compass-accent rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-display text-lg font-semibold text-compass-accent w-14 text-right shrink-0 tabular-nums">
              {fmtWsjf(wsjf)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zakładka OSZACUJ — edytowalne wejścia Fibonacciego per zadanie
// ---------------------------------------------------------------------------

function EstimatePanel({
  tasks,
  drafts,
  setDrafts,
}: {
  tasks: TaskWithRelations[]
  drafts: Record<string, DraftInputs>
  setDrafts: React.Dispatch<React.SetStateAction<Record<string, DraftInputs>>>
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 max-w-3xl">
        <SlidersHorizontal size={24} className="text-compass-dim mx-auto mb-3" strokeWidth={1} />
        <p className="text-sm text-compass-muted">Brak aktywnych zadań do oszacowania</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl flex flex-col gap-3">
      {tasks.map((task) => (
        <EstimateRow
          key={task.id}
          task={task}
          draft={drafts[task.id] ?? {}}
          onDraftChange={(next) =>
            setDrafts((prev) => ({ ...prev, [task.id]: next }))
          }
        />
      ))}
    </div>
  )
}

const FIB_FIELDS: { key: keyof WsjfInputs; label: string; short: string }[] = [
  { key: 'userValue', label: 'User Value', short: 'UV' },
  { key: 'timeCriticality', label: 'Time Criticality', short: 'TC' },
  { key: 'riskReduction', label: 'Risk / Opp.', short: 'RR' },
  { key: 'jobSize', label: 'Job Size', short: 'JS' },
]

function EstimateRow({
  task,
  draft,
  onDraftChange,
}: {
  task: TaskWithRelations
  draft: DraftInputs
  onDraftChange: (next: DraftInputs) => void
}) {
  const [isPending, startTransition] = useTransition()

  const wsjf = computeWsjf(draft)
  const complete = hasValidWsjfInputs(draft)

  // Czy lokalny draft różni się od zapisanego stanu zadania?
  const saved = draftFromTask(task)
  const dirty =
    draft.userValue !== saved.userValue ||
    draft.timeCriticality !== saved.timeCriticality ||
    draft.riskReduction !== saved.riskReduction ||
    draft.jobSize !== saved.jobSize

  function setField(key: keyof WsjfInputs, value: number) {
    onDraftChange({ ...draft, [key]: value })
  }

  function handleSave() {
    if (!hasValidWsjfInputs(draft)) {
      toast.error('Uzupełnij wszystkie 4 wejścia WSJF')
      return
    }
    const inputs: WsjfInputs = {
      userValue: draft.userValue,
      timeCriticality: draft.timeCriticality,
      riskReduction: draft.riskReduction,
      jobSize: draft.jobSize,
    }
    const computed = computeWsjf(inputs)

    startTransition(async () => {
      const { error } = await setWsjfInputs(task.id, inputs)
      if (error) {
        toast.error('Nie udało się zapisać oszacowania', { description: error })
        return
      }
      // Log surowej interakcji: 'apply' (zapis oszacowania). Bez "skuteczności".
      await logAIFeedback({
        feature: 'wsjf_prioritization',
        taskId: task.id,
        suggestion: { action: 'apply', inputs, wsjf: computed },
        accepted: true,
        overrideValue: null,
      })
      toast.success('Oszacowanie zapisane')
    })
  }

  function handleReset() {
    // Cofnięcie edycji do stanu zapisanego = 'dismiss' (porzucenie zmian).
    onDraftChange(saved)
    startTransition(async () => {
      await logAIFeedback({
        feature: 'wsjf_prioritization',
        taskId: task.id,
        suggestion: { action: 'dismiss', inputs: draft },
        accepted: false,
        overrideValue: null,
      })
    })
  }

  return (
    <div className="compass-card p-3">
      <div className="flex items-start gap-3">
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: task.project?.color ?? '#848179' }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-compass-text leading-tight">{task.title}</p>
          <span className="font-mono text-2xs text-compass-dim">
            {task.project?.name ?? 'Bez projektu'}
          </span>
        </div>
        {/* Policzony WSJF dla bieżącego draftu */}
        <div className="flex flex-col items-end shrink-0">
          <span className="font-mono text-2xs text-compass-dim">WSJF</span>
          <span
            className={cn(
              'font-display text-lg font-semibold tabular-nums',
              complete ? 'text-compass-accent' : 'text-compass-dim'
            )}
          >
            {wsjf !== null ? fmtWsjf(wsjf) : '—'}
          </span>
        </div>
      </div>

      {/* Cztery selektory Fibonacciego */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        {FIB_FIELDS.map((f) => (
          <FibonacciField
            key={f.key}
            label={f.label}
            short={f.short}
            value={draft[f.key]}
            disabled={isPending}
            onChange={(v) => setField(f.key, v)}
          />
        ))}
      </div>

      {/* Akcje */}
      <div className="flex items-center justify-end gap-2 mt-3">
        {dirty && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="compass-btn-outline text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <X size={12} />
            Cofnij
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !complete || !dirty}
          className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Check size={12} />
          )}
          Zapisz
        </button>
      </div>
    </div>
  )
}

function FibonacciField({
  label,
  short,
  value,
  disabled,
  onChange,
}: {
  label: string
  short: string
  value: number | undefined
  disabled: boolean
  onChange: (value: number) => void
}) {
  const selectId = `wsjf-${short}-${label}`
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="font-mono text-2xs text-compass-dim"
        title={label}
      >
        {label}
      </label>
      <select
        id={selectId}
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value
          if (v !== '') onChange(Number(v))
        }}
        className="compass-input w-full text-sm py-1.5"
      >
        <option value="" disabled>
          —
        </option>
        {WSJF_FIBONACCI.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zakładka — przycisk
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors duration-100',
        active
          ? 'border-compass-accent text-compass-text'
          : 'border-transparent text-compass-muted hover:text-compass-text'
      )}
    >
      <Icon size={13} />
      {label}
      <span className="font-mono text-2xs text-compass-dim">{count}</span>
    </button>
  )
}
