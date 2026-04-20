'use client'

import { useEffect, useState } from 'react'
import type { DbUser } from '@/lib/supabase/types'
import { getTeamMembers } from '@/app/actions/team'
import { TeamSettingsModal } from '@/components/compass/team-settings-modal'
import { Settings2 } from 'lucide-react'

export default function TeamSettingsPage() {
  const [team, setTeam] = useState<DbUser[]>([])
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null)

  useEffect(() => {
    getTeamMembers().then(setTeam)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-compass-text">Ustawienia zespołu</h1>
        <p className="text-sm text-compass-muted mt-1">
          Zarządzaj pojemnością i umiejętnościami członków zespołu
        </p>
      </div>

      <div className="divide-y divide-compass-border border border-compass-border rounded">
        {team.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-4 hover:bg-compass-surface transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-compass-accent/20 flex items-center justify-center font-mono text-sm text-compass-accent flex-shrink-0">
                {(user.full_name ?? user.email ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm text-compass-text">
                  {user.full_name ?? user.email ?? 'Nieznany'}
                </div>
                <div className="text-xs text-compass-muted">
                  {user.role?.join(', ') ?? '—'} ·{' '}
                  <span className="font-mono">{user.base_capacity ?? 20} pkt/sprint</span>
                </div>
                {user.skills && user.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {user.skills.map((skill) => (
                      <span
                        key={skill}
                        className="text-2xs px-1.5 py-0.5 bg-compass-surface-2 border border-compass-border rounded font-mono text-compass-dim"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(user)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 text-xs text-compass-muted hover:text-compass-text px-3 py-1.5 border border-compass-border rounded"
            >
              <Settings2 size={12} />
              Edytuj
            </button>
          </div>
        ))}

        {team.length === 0 && (
          <div className="p-8 text-center text-sm text-compass-dim">
            Ładowanie…
          </div>
        )}
      </div>

      {selectedUser && (
        <TeamSettingsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSave={(updated) => {
            setTeam((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}
