'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { Plus, X, Loader2, Check } from 'lucide-react'
import { createProject, type CreateProjectInput } from '@/app/actions/projects'
import { getScopeLabel } from '@/lib/utils'
import type { ScopeTag } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

const SCOPE_TAGS: ScopeTag[] = ['scope_1.0', 'scope_1.5', 'scope_2.0', 'grant_parp', 'marketing', 'ops']

const PRESET_COLORS = [
  { value: '#4BAF87', label: 'Zielony' },
  { value: '#4B8FAF', label: 'Niebieski' },
  { value: '#8F4BAF', label: 'Fioletowy' },
  { value: '#F5A83A', label: 'Złoty' },
  { value: '#E8622A', label: 'Pomarańczowy' },
  { value: '#DE4040', label: 'Czerwony' },
  { value: '#848179', label: 'Szary' },
  { value: '#EAE8DF', label: 'Kremowy' },
]

interface NewProjectModalProps {
  trigger?: React.ReactNode
}

export function NewProjectModal({ trigger }: NewProjectModalProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState<{
    name: string
    scope_tag: ScopeTag
    description: string
    color: string
  }>({
    name: '',
    scope_tag: 'scope_1.0',
    description: '',
    color: '#4BAF87',
  })

  const [fieldError, setFieldError] = useState<string | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm({ name: '', scope_tag: 'scope_1.0', description: '', color: '#4BAF87' })
      setFieldError(null)
    }
    setOpen(next)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const input: CreateProjectInput = {
      name: form.name.trim(),
      scope_tag: form.scope_tag,
      description: form.description.trim() || null,
      color: form.color,
    }

    startTransition(async () => {
      const { error } = await createProject(input)
      if (error) {
        setFieldError(error)
        return
      }
      toast.success('Projekt utworzony', { description: input.name })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button className="compass-btn-primary text-xs flex items-center gap-1.5">
            <Plus size={13} strokeWidth={2} />
            Nowy projekt
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40 animate-in fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          aria-describedby={undefined}
        >
          <div className="compass-card border border-compass-border shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="font-display text-lg text-compass-text">
                Nowy projekt
              </Dialog.Title>
              <Dialog.Close className="compass-btn-ghost p-1 rounded-[2px]">
                <X size={15} />
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Nazwa *</label>
                <input
                  className="compass-input"
                  placeholder="np. Hotable MVP"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  disabled={isPending}
                />
              </div>

              {/* Scope tag */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Scope tag *</label>
                <select
                  className="compass-input text-xs"
                  value={form.scope_tag}
                  onChange={(e) => setForm((f) => ({ ...f, scope_tag: e.target.value as ScopeTag }))}
                  disabled={isPending}
                >
                  {SCOPE_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {getScopeLabel(tag)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Opis</label>
                <textarea
                  className="compass-input resize-none"
                  rows={2}
                  placeholder="Krótki opis projektu…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  disabled={isPending}
                />
              </div>

              {/* Color picker */}
              <div className="flex flex-col gap-1.5">
                <label className="compass-label">Kolor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                      disabled={isPending}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110',
                        form.color === c.value
                          ? 'border-compass-text scale-110'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: c.value }}
                    >
                      {form.color === c.value && (
                        <Check size={10} className="text-compass-bg" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                  {/* Custom hex input */}
                  <input
                    type="color"
                    className="w-6 h-6 rounded cursor-pointer border border-compass-border bg-transparent"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    disabled={isPending}
                    title="Własny kolor"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-[3px] bg-compass-surface-2 border border-compass-border">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: form.color }}
                />
                <span className="text-xs text-compass-text truncate">
                  {form.name || 'Podgląd projektu'}
                </span>
                <span className="font-mono text-2xs text-compass-muted ml-auto">
                  {getScopeLabel(form.scope_tag)}
                </span>
              </div>

              {/* Error */}
              {fieldError && (
                <p className="text-xs text-compass-danger">{fieldError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Dialog.Close
                  className="compass-btn-ghost text-xs"
                  disabled={isPending}
                >
                  Anuluj
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={isPending || !form.name.trim()}
                  className="compass-btn-primary text-xs flex items-center gap-1.5"
                >
                  {isPending && <Loader2 size={12} className="animate-spin" />}
                  Utwórz projekt
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
