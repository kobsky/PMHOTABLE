'use client'

import { useState, useTransition } from 'react'
import { PageHeader } from '@/components/compass/page-header'
import { inferTaskType } from '@/lib/utils'
import { getWorkloadSuggestions, getAssigneeRecommendation } from '@/app/actions/ai'
import type { TaskTypeInference } from '@/lib/utils'
import type { AssigneeSuggestion, WorkloadSuggestion } from '@/app/actions/ai'
import { cn } from '@/lib/utils'
import { Sparkles, Zap, Users2, Tag, ChevronRight, Loader2 } from 'lucide-react'

type Tab = 'categorization' | 'workload' | 'assignee'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'categorization', label: 'Auto-kategoryzacja', icon: Tag },
  { id: 'workload',       label: 'Balansowanie obciążeń', icon: Users2 },
  { id: 'assignee',       label: 'Rekomendacja assignee', icon: Zap },
]

const TYPE_COLORS: Record<string, string> = {
  bug:       'text-compass-danger bg-compass-danger/10',
  feature:   'text-compass-accent bg-compass-accent/10',
  chore:     'text-compass-muted bg-compass-surface-3',
  research:  'text-compass-warning bg-compass-warning/10',
  design:    'text-blue-400 bg-blue-400/10',
  marketing: 'text-purple-400 bg-purple-400/10',
}

const EXAMPLE_TITLES = [
  'Fix login button not working on mobile',
  'Implement magic link authentication',
  'Research SEO best practices for hoteliers',
  'Prepare wireframes for dashboard redesign',
  'Create Q2 email marketing campaign',
  'Refactor API authentication middleware',
  'Setup CI/CD pipeline on GitHub Actions',
  'Add dark mode support to panel',
  'Naprawić błąd przy rezerwacji z kartą',
  'Dodaj integrację z Google Calendar',
]

export default function AITestingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categorization')

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="AI Testing Playground"
        subtitle="Testuj i weryfikuj działanie funkcji AI"
        actions={
          <div className="flex items-center gap-1.5 font-mono text-2xs text-compass-dim px-2 py-1 rounded-[3px] bg-compass-surface-2 border border-compass-border">
            <Sparkles size={10} className="text-compass-accent" />
            Środowisko deweloperskie
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex items-center gap-0 px-6 border-b border-compass-border flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
              activeTab === id
                ? 'border-compass-accent text-compass-text'
                : 'border-transparent text-compass-muted hover:text-compass-text'
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'categorization' && <CategorizationTester typeColors={TYPE_COLORS} />}
        {activeTab === 'workload'       && <WorkloadTester />}
        {activeTab === 'assignee'       && <AssigneeTester typeColors={TYPE_COLORS} />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Auto-Categorization Tester
// ---------------------------------------------------------------------------

function CategorizationTester({ typeColors }: { typeColors: Record<string, string> }) {
  const [title, setTitle] = useState('')
  const [result, setResult] = useState<TaskTypeInference | null>(null)
  const [tested, setTested] = useState(false)

  function test(t: string) {
    setTitle(t)
    const r = inferTaskType(t)
    setResult(r)
    setTested(true)
  }

  return (
    <div className="grid grid-cols-2 gap-6 max-w-4xl">
      {/* Left: inputs */}
      <div className="space-y-4">
        <div>
          <label className="compass-label block mb-1.5">Tytuł zadania</label>
          <input
            type="text"
            value={title}
            onChange={(e) => test(e.target.value)}
            placeholder="Wpisz tytuł zadania..."
            className="compass-input w-full"
          />
          <p className="font-mono text-2xs text-compass-dim mt-1">
            Wynik aktualizuje się w czasie rzeczywistym
          </p>
        </div>

        <div>
          <p className="compass-label mb-2">Przykłady</p>
          <div className="flex flex-col gap-1">
            {EXAMPLE_TITLES.map((ex) => (
              <button
                key={ex}
                onClick={() => test(ex)}
                className={cn(
                  'text-left px-3 py-2 text-xs rounded-[3px] border transition-colors',
                  title === ex
                    ? 'border-compass-accent bg-compass-accent/5 text-compass-text'
                    : 'border-compass-border text-compass-muted hover:border-compass-border-strong hover:text-compass-text'
                )}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: result */}
      <div>
        <p className="compass-label mb-3">Wynik inferencji</p>
        {!tested ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-compass-border rounded-[4px]">
            <Tag size={20} className="text-compass-dim mb-2" strokeWidth={1} />
            <p className="text-xs text-compass-dim">Wpisz tytuł lub wybierz przykład</p>
          </div>
        ) : result === null ? (
          <div className="compass-card p-5 text-center">
            <p className="text-sm text-compass-muted mb-1">Brak pewnej kategorii</p>
            <p className="text-xs text-compass-dim">
              Tytuł jest zbyt krótki lub nie pasuje do żadnego wzorca.
            </p>
          </div>
        ) : (
          <div className="compass-card p-5 space-y-4">
            <div>
              <p className="compass-label mb-1.5">Wykryty typ</p>
              <span className={cn('inline-flex px-3 py-1 rounded-[3px] font-mono text-xs font-semibold uppercase', typeColors[result.type] ?? 'text-compass-muted bg-compass-surface-3')}>
                {result.type}
              </span>
            </div>

            <div>
              <p className="compass-label mb-1.5">
                Pewność:{' '}
                <span className="text-compass-accent font-semibold">
                  {Math.round(result.confidence * 100)}%
                </span>
              </p>
              <div className="h-2 bg-compass-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    result.confidence >= 0.8 ? 'bg-compass-success' :
                    result.confidence >= 0.6 ? 'bg-compass-accent' :
                    'bg-compass-warning'
                  )}
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t border-compass-border">
              <p className="compass-label mb-2">Wszystkie typy (reguły)</p>
              {['research', 'development', 'outreach', 'design', 'marketing', 'support', 'ops'].map((t) => (
                <div key={t} className={cn(
                  'flex items-center gap-2 py-1 text-xs',
                  result.type === t ? 'text-compass-text font-semibold' : 'text-compass-dim'
                )}>
                  <ChevronRight size={10} className={result.type === t ? 'text-compass-accent' : 'text-compass-dim'} />
                  <span className="font-mono w-20">{t}</span>
                  {result.type === t && (
                    <span className="font-mono text-compass-accent">✓ dopasowanie</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Workload Tester
// ---------------------------------------------------------------------------

function WorkloadTester() {
  const [result, setResult] = useState<{ suggestions: WorkloadSuggestion[]; loadMap: Record<string, { name: string; active: number; inProgress: number }> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function runTest() {
    startTransition(async () => {
      const res = await getWorkloadSuggestions()
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
        setError(null)
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="compass-card p-5">
        <p className="text-sm text-compass-muted mb-4">
          Pobiera aktualny rozkład zadań w zespole i generuje sugestie rebalansowania.
          Nie wywołuje API zewnętrznego — działa na danych z bazy.
        </p>
        <button onClick={runTest} disabled={isPending} className="compass-btn-primary flex items-center gap-1.5 text-xs">
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Users2 size={12} />}
          {isPending ? 'Analizowanie...' : 'Analizuj obciążenie'}
        </button>
      </div>

      {error && (
        <div className="compass-card p-4 border-compass-danger/30 text-sm text-compass-danger">{error}</div>
      )}

      {result && (
        <>
          {/* Load map */}
          <div>
            <p className="compass-label mb-2">Aktualne obciążenie</p>
            <div className="flex flex-col gap-2">
              {Object.entries(result.loadMap).map(([id, data]) => (
                <div key={id} className="compass-card p-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-compass-surface-3 border border-compass-border flex items-center justify-center font-mono text-xs text-compass-muted uppercase">
                    {data.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-compass-text">{data.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-2xs text-compass-dim">{data.active} aktywnych</span>
                      <span className="font-mono text-2xs text-compass-warning">{data.inProgress} w toku</span>
                    </div>
                  </div>
                  <div className="font-display text-lg font-semibold text-compass-text">{data.active}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <p className="compass-label mb-2">Sugestie rebalansowania ({result.suggestions.length})</p>
            {result.suggestions.length === 0 ? (
              <div className="compass-card p-4 text-center">
                <p className="text-xs text-compass-muted">Obciążenie jest zbalansowane — brak sugestii.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {result.suggestions.map((s) => (
                  <div key={s.suggestionId} className="compass-card p-4">
                    <p className="text-xs font-medium text-compass-text mb-1 truncate">{s.taskTitle}</p>
                    <div className="flex items-center gap-2 text-xs text-compass-muted">
                      <span className="text-compass-danger">{s.fromUserName} ({s.fromLoad})</span>
                      <ChevronRight size={10} />
                      <span className="text-compass-success">{s.toUserName} ({s.toLoad})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Assignee Recommender Tester
// ---------------------------------------------------------------------------

function AssigneeTester({ typeColors }: { typeColors: Record<string, string> }) {
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [result, setResult] = useState<AssigneeSuggestion[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const EXAMPLE_TASKS = [
    { title: 'Implement user authentication with magic link', desc: 'Use Supabase Auth + @supabase/ssr. Protect all dashboard routes.' },
    { title: 'Design new hotel onboarding flow in Figma', desc: 'Create wireframes + high-fidelity mockups. Include mobile breakpoints.' },
    { title: 'Research competitors in hotel booking space', desc: 'Analyze 5 competitors: pricing, features, UX. Write brief.' },
    { title: 'Create Q2 marketing newsletter', desc: 'Email campaign for hotel partners. 500 word copy + 3 visuals.' },
  ]

  function runTest() {
    if (!taskTitle.trim()) return
    startTransition(async () => {
      const res = await getAssigneeRecommendation(taskTitle, taskDesc || null)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res.suggestions)
        setError(null)
      }
    })
  }

  return (
    <div className="grid grid-cols-2 gap-6 max-w-4xl">
      <div className="space-y-4">
        <div>
          <label className="compass-label block mb-1.5">Tytuł zadania</label>
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Opisz zadanie..."
            className="compass-input w-full"
          />
        </div>

        <div>
          <label className="compass-label block mb-1.5">Opis (opcjonalny)</label>
          <textarea
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            placeholder="Szczegółowy opis zadania..."
            className="compass-input w-full resize-none"
            rows={3}
          />
        </div>

        <button
          onClick={runTest}
          disabled={isPending || !taskTitle.trim()}
          className="compass-btn-primary w-full flex items-center justify-center gap-1.5 text-xs disabled:opacity-40"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {isPending ? 'Pytam Claude...' : 'Rekomenduj assignee'}
        </button>

        <div>
          <p className="compass-label mb-2">Przykłady</p>
          <div className="flex flex-col gap-1">
            {EXAMPLE_TASKS.map((ex) => (
              <button
                key={ex.title}
                onClick={() => { setTaskTitle(ex.title); setTaskDesc(ex.desc) }}
                className="text-left px-3 py-2 text-xs rounded-[3px] border border-compass-border text-compass-muted hover:border-compass-border-strong hover:text-compass-text transition-colors"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="compass-label mb-3">Rekomendacje AI</p>

        {!result && !error && !isPending && (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-compass-border rounded-[4px]">
            <Sparkles size={20} className="text-compass-dim mb-2" strokeWidth={1} />
            <p className="text-xs text-compass-dim">Wypełnij formularz i kliknij "Rekomenduj"</p>
            {!process.env.ANTHROPIC_API_KEY && (
              <p className="text-xs text-compass-warning mt-2">ANTHROPIC_API_KEY nie ustawiony</p>
            )}
          </div>
        )}

        {isPending && (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-compass-border rounded-[4px]">
            <Loader2 size={20} className="text-compass-accent animate-spin mb-2" />
            <p className="text-xs text-compass-dim">Claude analizuje członków zespołu...</p>
          </div>
        )}

        {error && (
          <div className="compass-card p-4 border-compass-danger/30 text-sm text-compass-danger">{error}</div>
        )}

        {result && result.length === 0 && (
          <div className="compass-card p-5 text-center">
            <p className="text-sm text-compass-muted">Brak rekomendacji</p>
            <p className="text-xs text-compass-dim mt-1">
              Sprawdź czy ANTHROPIC_API_KEY jest ustawiony i czy są członkowie zespołu.
            </p>
          </div>
        )}

        {result && result.length > 0 && (
          <div className="flex flex-col gap-3">
            {result.map((rec, idx) => (
              <div key={rec.assignee_id} className={cn('compass-card p-4', idx === 0 && 'border-compass-accent/40')}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-compass-surface-3 border border-compass-border flex items-center justify-center font-mono text-xs text-compass-muted uppercase">
                      {rec.assignee_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-compass-text">{rec.assignee_name}</p>
                      {idx === 0 && (
                        <span className="font-mono text-2xs text-compass-accent">Najlepsza rekomendacja</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display text-lg font-semibold text-compass-text">
                      {Math.round(rec.score * 100)}%
                    </p>
                    <p className="font-mono text-2xs text-compass-dim">pewność</p>
                  </div>
                </div>

                <div className="h-1 bg-compass-surface-2 rounded-full overflow-hidden mb-2">
                  <div
                    className={cn('h-full rounded-full', idx === 0 ? 'bg-compass-accent' : 'bg-compass-muted/40')}
                    style={{ width: `${rec.score * 100}%` }}
                  />
                </div>

                <p className="text-xs text-compass-muted leading-relaxed">{rec.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
