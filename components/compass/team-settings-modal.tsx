'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import type { DbUser } from '@/lib/supabase/types'
import { updateMember } from '@/app/actions/team'
import { toast } from 'sonner'
import { X } from 'lucide-react'

const SKILL_OPTIONS = ['Frontend', 'Backend', 'Design', 'PM', 'DevOps', 'QA', 'Marketing']

interface TeamSettingsModalProps {
  user: DbUser
  onClose: () => void
  onSave: (updated: DbUser) => void
}

export function TeamSettingsModal({ user, onClose, onSave }: TeamSettingsModalProps) {
  const [baseCapacity, setBaseCapacity] = useState(user.base_capacity ?? 20)
  const [skills, setSkills] = useState<string[]>(user.skills ?? [])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateMember(user.id, { base_capacity: baseCapacity, skills })
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Zapisano')
    onSave({ ...user, base_capacity: baseCapacity, skills })
  }

  return (
    <Dialog.Root open onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-compass-surface border border-compass-border rounded-lg p-6 shadow-xl animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-display text-lg font-bold text-compass-text">
              {user.full_name ?? user.email}
            </Dialog.Title>
            <Dialog.Close className="text-compass-dim hover:text-compass-muted transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            {/* Base Capacity */}
            <div>
              <label className="block text-sm font-semibold text-compass-text mb-1">
                Pojemność bazowa (pkt/sprint)
              </label>
              <input
                type="number"
                value={baseCapacity}
                onChange={(e) =>
                  setBaseCapacity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))
                }
                min={1}
                max={100}
                className="compass-input w-full"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-semibold text-compass-text mb-2">
                Umiejętności
              </label>
              <div className="flex flex-wrap gap-2">
                {SKILL_OPTIONS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() =>
                      setSkills(
                        skills.includes(skill)
                          ? skills.filter((s) => s !== skill)
                          : [...skills, skill]
                      )
                    }
                    className={cn(
                      'px-3 py-1 rounded text-xs transition-colors',
                      skills.includes(skill)
                        ? 'bg-compass-accent text-compass-bg'
                        : 'border border-compass-border text-compass-muted hover:border-compass-accent/50'
                    )}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <button
              onClick={onClose}
              className="compass-btn border border-compass-border text-compass-muted"
            >
              Anuluj
            </button>
            <button onClick={handleSave} disabled={saving} className="compass-btn-primary">
              {saving ? 'Zapisywanie…' : 'Zapisz'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
