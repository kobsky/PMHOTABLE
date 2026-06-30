'use client'

import { useState, useMemo, useTransition } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createIdea, updateIdeaStatus, promoteIdeaToTask } from '@/app/actions/ideas'
import { IdeaCard } from './idea-card'
import type { IdeaWithAuthor, IdeaStatus, DbProject } from '@/lib/supabase/types'
import { Plus, X, Loader2, Lightbulb, ArrowRight } from 'lucide-react'

interface IdeasViewProps {
  ideas: IdeaWithAuthor[]
  projects: DbProject[]
}

type Tab = IdeaStatus | 'all'

const STATUS_TABS: { value: Tab; label: string }[] = [
  { value: 'all',       label: 'Wszystkie' },
  { value: 'inbox',     label: 'Skrzynka' },
  { value: 'accepted',  label: 'Zaakceptowane' },
  { value: 'rejected',  label: 'Odrzucone' },
  { value: 'converted', label: 'Przekształcone' },
]

export function IdeasView({ ideas: initialIdeas, projects }: IdeasViewProps) {
  const [ideas, setIdeas] = useState<IdeaWithAuthor[]>(initialIdeas)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [showNew, setShowNew] = useState(false)
  const [promotingIdea, setPromotingIdea] = useState<IdeaWithAuthor | null>(null)

  const inboxCount = ideas.filter((i) => i.status === 'inbox').length

  const filtered = useMemo(
    () => activeTab === 'all' ? ideas : ideas.filter((i) => i.status === activeTab),
    [ideas, activeTab]
  )

  async function handleStatusChange(id: string, status: IdeaStatus, rejectionReason?: string) {
    setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status, rejection_reason: rejectionReason ?? i.rejection_reason } : i))
    const { error } = await updateIdeaStatus(id, status, rejectionReason)
    if (error) toast.error('Nie udało się zaktualizować statusu')
  }

  async function handlePromote(idea: IdeaWithAuthor, projectId: string) {
    const { error } = await promoteIdeaToTask(idea.id, {
      title: idea.title,
      projectId,
    })
    if (error) {
      toast.error('Nie udało się przekształcić pomysłu', { description: error })
    } else {
      setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, status: 'converted' } : i))
      setPromotingIdea(null)
      toast.success('Pomysł przekształcony w zadanie', { description: `Dodano do backlogu: ${idea.title}` })
    }
  }

  function handleCreated(idea: IdeaWithAuthor) {
    setIdeas((prev) => [idea, ...prev].sort((a, b) => b.ice_score - a.ice_score))
    setShowNew(false)
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Zakładki statusów */}
      <div className="flex items-center gap-0 px-6 pt-4 border-b border-compass-border">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              'px-3 py-2 text-xs font-medium border-b-2 transition-colors duration-100',
              activeTab === tab.value
                ? 'border-compass-accent text-compass-text'
                : 'border-transparent text-compass-muted hover:text-compass-text'
            )}
          >
            {tab.label}
            {tab.value === 'inbox' && inboxCount > 0 && (
              <span className="ml-1.5 font-mono text-2xs bg-compass-accent-dim text-compass-accent px-1 rounded-[2px]">
                {inboxCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowNew(true)}
          className="ml-auto mb-1 compass-btn-primary text-xs flex items-center gap-1.5"
        >
          <Plus size={12} />
          Nowy pomysł
        </button>
      </div>

      {/* Legenda ICE */}
      <div className="flex items-center gap-4 px-6 py-2.5 border-b border-compass-border bg-compass-surface/30">
        <span className="compass-label">ICE Score =</span>
        <span className="font-mono text-2xs text-compass-muted">
          (Impact + Confidence + Ease) ÷ 3
        </span>
        <div className="ml-auto flex items-center gap-3">
          <ScaleLegend color="text-compass-success" label="≥7 Wysoki" />
          <ScaleLegend color="text-compass-warning" label="5–7 Średni" />
          <ScaleLegend color="text-compass-muted" label="<5 Niski" />
        </div>
      </div>

      {/* Karty */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb size={24} className="text-compass-dim mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-compass-muted">Brak pomysłów</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 max-w-3xl sm:grid-cols-2">
            {filtered.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                authorName={idea.author?.full_name?.split(' ')[0] ?? idea.author?.email ?? undefined}
                onAccept={idea.status === 'inbox' ? () => handleStatusChange(idea.id, 'accepted') : undefined}
                onReject={idea.status !== 'rejected' && idea.status !== 'converted'
                  ? (reason) => handleStatusChange(idea.id, 'rejected', reason)
                  : undefined}
                onPromote={idea.status === 'accepted' ? () => setPromotingIdea(idea) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal nowego pomysłu */}
      {showNew && (
        <NewIdeaModal
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Modal wyboru projektu przy promowaniu */}
      {promotingIdea && (
        <PromoteModal
          idea={promotingIdea}
          projects={projects}
          onClose={() => setPromotingIdea(null)}
          onConfirm={(projectId) => handlePromote(promotingIdea, projectId)}
        />
      )}
    </div>
  )
}

function ScaleLegend({ color, label }: { color: string; label: string }) {
  return <span className={cn('font-mono text-2xs', color)}>{label}</span>
}

// ---------------------------------------------------------------------------
// ModalShell — dostępny modal na bazie Radix Dialog (focus trap, Esc,
// przywrócenie focusu, role="dialog" + aria-modal). Zachowuje wzorzec
// montowania warunkowego: rodzic renderuje modal tylko gdy ma być widoczny,
// a zamknięcie woła onClose().
// ---------------------------------------------------------------------------

interface ModalShellProps {
  title: string
  onClose: () => void
  maxWidth?: string
  children: React.ReactNode
}

function ModalShell({ title, onClose, maxWidth = 'max-w-md', children }: ModalShellProps) {
  return (
    <Dialog.Root open onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // Zachowaj dawny UX: focus na pierwszym polu formularza zamiast
            // na przycisku zamknięcia (domyślne zachowanie Radix).
            const first = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('input, textarea, select')
            if (first) { e.preventDefault(); first.focus() }
          }}
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full p-4',
            maxWidth
          )}
        >
          <div className="bg-compass-surface border border-compass-border rounded-[4px] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border">
              <Dialog.Title className="text-sm font-semibold text-compass-text">{title}</Dialog.Title>
              <Dialog.Close className="compass-btn-ghost p-1"><X size={14} /></Dialog.Close>
            </div>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// NewIdeaModal
// ---------------------------------------------------------------------------

function NewIdeaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (idea: IdeaWithAuthor) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState(5)
  const [confidence, setConfidence] = useState(5)
  const [ease, setEase] = useState(5)
  const [isPending, startTransition] = useTransition()

  const iceScore = ((impact + confidence + ease) / 3)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    startTransition(async () => {
      const { error } = await createIdea({
        title: title.trim(),
        description: description.trim() || null,
        iceImpact: impact,
        iceConfidence: confidence,
        iceEase: ease,
      })

      if (error) {
        toast.error('Nie udało się dodać pomysłu', { description: error })
      } else {
        toast.success('Pomysł dodany')
        const tempIdea: IdeaWithAuthor = {
          id: crypto.randomUUID(),
          title: title.trim(),
          description: description.trim() || null,
          status: 'inbox',
          ice_impact: impact,
          ice_confidence: confidence,
          ice_ease: ease,
          ice_score: Math.round(iceScore * 10) / 10,
          rejection_reason: null,
          source: 'other',
          promoted_to_task_id: null,
          author_id: '',
          author: { id: '', email: '', full_name: 'Ty', avatar_url: null, created_at: '' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        onCreated(tempIdea)
      }
    })
  }

  const iceColor = iceScore >= 7 ? 'text-compass-success' : iceScore >= 5 ? 'text-compass-warning' : 'text-compass-muted'

  return (
    <ModalShell title="Nowy pomysł" onClose={onClose} maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <label className="compass-label block mb-1.5">Tytuł</label>
            <input
              autoFocus
              type="text"
              placeholder="Krótki opis pomysłu…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="compass-input w-full text-sm"
              disabled={isPending}
            />
          </div>

          <div>
            <label className="compass-label block mb-1.5">Opis (opcjonalny)</label>
            <textarea
              placeholder="Więcej szczegółów…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="compass-input w-full text-sm resize-none"
              rows={3}
              disabled={isPending}
            />
          </div>

          {/* ICE Sliders */}
          <div className="border border-compass-border rounded-[3px] overflow-hidden">
            <div className="grid grid-cols-4">
              <IceSliderCell label="Impact"     title="I" value={impact}     onChange={setImpact}     disabled={isPending} />
              <IceSliderCell label="Confidence" title="C" value={confidence} onChange={setConfidence} disabled={isPending} />
              <IceSliderCell label="Ease"       title="E" value={ease}       onChange={setEase}       disabled={isPending} />
              {/* Score */}
              <div className="flex flex-col items-center justify-center py-3 gap-1 bg-compass-surface-2 border-l border-compass-border">
                <span className="font-mono text-2xs text-compass-dim">ICE</span>
                <span className={cn('font-display text-xl font-semibold', iceColor)}>
                  {iceScore.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="compass-btn-outline text-xs" disabled={isPending}>
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isPending}
              className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Dodaj pomysł
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

function PromoteModal({
  idea,
  projects,
  onClose,
  onConfirm,
}: {
  idea: IdeaWithAuthor
  projects: DbProject[]
  onClose: () => void
  onConfirm: (projectId: string) => void
}) {
  const [selectedProject, setSelectedProject] = useState(projects[0]?.id ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProject) return
    startTransition(() => {
      onConfirm(selectedProject)
    })
  }

  return (
    <ModalShell title="Przekształć w zadanie" onClose={onClose} maxWidth="max-w-sm">
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="px-3 py-2.5 bg-compass-surface-2 rounded-[3px] border border-compass-border">
            <p className="text-xs text-compass-muted mb-0.5">Pomysł</p>
            <p className="text-sm font-medium text-compass-text">{idea.title}</p>
          </div>

          <div>
            <label className="compass-label block mb-1.5">Projekt</label>
            {projects.length === 0 ? (
              <p className="text-xs text-compass-danger">Brak projektów — utwórz projekt przed promowaniem.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {projects.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-[3px] border cursor-pointer transition-colors',
                      selectedProject === p.id
                        ? 'border-compass-accent bg-compass-accent-dim'
                        : 'border-compass-border hover:border-compass-border-strong'
                    )}
                  >
                    <input
                      type="radio"
                      name="project"
                      value={p.id}
                      checked={selectedProject === p.id}
                      onChange={() => setSelectedProject(p.id)}
                      className="sr-only"
                    />
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-sm text-compass-text">{p.name}</span>
                    <span className="font-mono text-2xs text-compass-dim ml-auto">{p.scope_tag}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="compass-btn-outline text-xs" disabled={isPending}>
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!selectedProject || projects.length === 0 || isPending}
              className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
              Przekształć
            </button>
          </div>
        </form>
    </ModalShell>
  )
}

function IceSliderCell({
  label, title, value, onChange, disabled,
}: {
  label: string
  title: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  const color = value >= 7 ? 'text-compass-success' : value >= 5 ? 'text-compass-warning' : 'text-compass-muted'

  return (
    <div className="flex flex-col items-center py-3 px-2 gap-1.5 border-r border-compass-border last:border-r-0">
      <span className="font-mono text-2xs text-compass-dim">{title}</span>
      <span className={cn('font-display text-xl font-semibold', color)}>{value}</span>
      <span className="font-mono text-2xs text-compass-dim/60">{label}</span>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-compass-accent mt-1"
      />
    </div>
  )
}
