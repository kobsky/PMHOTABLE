'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createPlaceholderProfile } from '@/app/actions/team'
import { TEAM_ROLES } from '@/lib/team-constants'
import { X, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AddProfileModalProps {
  onClose: () => void
}

export function AddProfileModal({ onClose }: AddProfileModalProps) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [roleInput, setRoleInput] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')
  const [isPending, startTransition] = useTransition()

  function addRole(value?: string) {
    const r = (value ?? roleInput).trim()
    if (r && !roles.includes(r) && roles.length < 20) {
      setRoles((prev) => [...prev, r])
      setRoleInput('')
    }
  }

  function removeRole(r: string) {
    setRoles((prev) => prev.filter((x) => x !== r))
  }

  function addSkill() {
    const s = skillInput.trim()
    if (s && !skills.includes(s) && skills.length < 20) {
      setSkills((prev) => [...prev, s])
      setSkillInput('')
    }
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) { toast.error('Imię i nazwisko jest wymagane'); return }
    if (roles.length === 0) { toast.error('Dodaj co najmniej jedną rolę'); return }

    startTransition(async () => {
      const result = await createPlaceholderProfile({
        full_name: fullName.trim(),
        email: email.trim() || null,
        role: roles,
        bio: bio.trim() || undefined,
        skills,
      })

      if (result.error) {
        toast.error('Nie udało się dodać profilu', { description: result.error })
      } else {
        toast.success(`${fullName.trim()} dodany do zespołu`)
        onClose()
      }
    })
  }

  // suggestions = predefined roles not yet added
  const suggestions = TEAM_ROLES.filter((r) => !roles.includes(r))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-compass-surface border border-compass-border rounded-[4px] w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-compass-border sticky top-0 bg-compass-surface">
          <div>
            <h2 className="text-sm font-semibold text-compass-text">Dodaj profil członka</h2>
            <p className="text-2xs text-compass-dim mt-0.5">Bez konta — można zaprosić później</p>
          </div>
          <button onClick={onClose} className="compass-btn-ghost p-1">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="compass-label block mb-1.5">
              Imię i nazwisko <span className="text-compass-danger">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="compass-input w-full text-sm"
              disabled={isPending}
              placeholder="Jan Kowalski"
              autoFocus
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="compass-label block mb-1.5">
              Email <span className="text-compass-dim font-normal">(opcjonalny — potrzebny do zaproszenia)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="compass-input w-full text-sm"
              disabled={isPending}
              placeholder="jan@example.com"
            />
          </div>

          {/* Roles — free-form tag input */}
          <div>
            <label className="compass-label block mb-1.5">
              Role <span className="text-compass-danger">*</span>
            </label>

            {/* Tag input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addRole() }
                }}
                className="compass-input flex-1 text-sm"
                disabled={isPending}
                placeholder="np. CEO, Developer, Designer…"
              />
              <button
                type="button"
                onClick={() => addRole()}
                className="compass-btn-outline px-2 py-1 flex items-center"
                disabled={isPending || !roleInput.trim()}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Added roles */}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {roles.map((r) => (
                  <span
                    key={r}
                    className="flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded-[2px] bg-compass-accent/10 text-compass-accent"
                  >
                    {r}
                    <button type="button" onClick={() => removeRole(r)} className="hover:text-compass-danger" disabled={isPending}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Quick-add suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestions.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => addRole(r)}
                    disabled={isPending}
                    className={cn(
                      'px-2 py-0.5 text-2xs rounded-[3px] border border-compass-border',
                      'text-compass-dim hover:text-compass-muted hover:border-compass-border-strong transition-colors'
                    )}
                  >
                    + {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Skills */}
          <div>
            <label className="compass-label block mb-1.5">Umiejętności</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addSkill() }
                }}
                className="compass-input flex-1 text-sm"
                disabled={isPending}
                placeholder="np. React, Figma, SQL"
              />
              <button
                type="button"
                onClick={addSkill}
                className="compass-btn-outline px-2 py-1 flex items-center"
                disabled={isPending || !skillInput.trim()}
              >
                <Plus size={12} />
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 font-mono text-2xs px-2 py-0.5 rounded-[2px] bg-compass-surface-3 text-compass-muted"
                  >
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} className="hover:text-compass-danger" disabled={isPending}>
                      <X size={9} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="compass-label block mb-1.5">Bio (opcjonalny)</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="compass-input w-full text-sm resize-none"
              rows={2}
              disabled={isPending}
              placeholder="Krótki opis, specjalizacja..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="compass-btn-outline text-xs" disabled={isPending}>
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isPending || !fullName.trim() || roles.length === 0}
              className="compass-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
            >
              {isPending && <Loader2 size={12} className="animate-spin" />}
              Dodaj do zespołu
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
