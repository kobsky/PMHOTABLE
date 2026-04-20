'use client'

import { useState, useEffect } from 'react'
import { getTeamMembers } from '@/app/actions/team'
import { PageHeader } from '@/components/compass/page-header'
import { MemberActions } from '@/components/compass/member-actions'
import { AddProfileModal } from '@/components/compass/add-profile-modal'
import { InviteModal } from '@/components/compass/invite-modal'
import { UserPlus, Users, UserCheck } from 'lucide-react'
import type { DbUser, ProfileType } from '@/lib/supabase/types'

// ----------------------------------------------------------------
// Status badge helpers
// ----------------------------------------------------------------

const STATUS_CONFIG: Record<ProfileType, { label: string; icon: React.ReactNode; classes: string }> = {
  active: {
    label: 'Aktywny',
    icon: <span className="text-compass-success">●</span>,
    classes: 'text-compass-success bg-compass-success/10',
  },
  placeholder: {
    label: 'Placeholder',
    icon: <span className="text-compass-muted">◌</span>,
    classes: 'text-compass-muted bg-compass-surface-3',
  },
  invited: {
    label: 'Zaproszony',
    icon: <span className="text-compass-warning">◎</span>,
    classes: 'text-compass-warning bg-compass-warning/10',
  },
}

function ProfileTypeBadge({ profileType }: { profileType?: ProfileType }) {
  const type = profileType ?? 'active'
  const cfg = STATUS_CONFIG[type]
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-2xs px-1.5 py-0.5 rounded-[2px] ${cfg.classes}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

// ----------------------------------------------------------------
// Page (client component — needs modal state)
// ----------------------------------------------------------------

export default function TeamMembersPage() {
  const [members, setMembers] = useState<DbUser[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  async function loadMembers() {
    const data = await getTeamMembers()
    setMembers(data)
  }

  useEffect(() => {
    loadMembers()
  }, [])

  // Reload after modal closes
  function handleModalClose() {
    setShowAddModal(false)
    loadMembers()
  }

  const activeCount = members.filter((m) => (m.profile_type ?? 'active') === 'active').length
  const totalCount = members.length

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Członkowie zespołu"
        subtitle={`${activeCount} aktywnych · ${totalCount} łącznie`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="compass-btn-outline text-xs flex items-center gap-1.5"
            >
              <UserCheck size={12} />
              Dodaj profil
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="compass-btn-primary text-xs flex items-center gap-1.5"
            >
              <UserPlus size={12} />
              Zaproś członka
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6 max-w-3xl">
        {members.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-compass-border rounded-[4px]">
            <Users size={24} className="text-compass-dim mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-compass-muted mb-1">Brak członków zespołu</p>
            <p className="text-xs text-compass-dim mb-5">
              Dodaj profil ręcznie lub zaproś osoby przez link zaproszenia.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="compass-btn-outline text-xs px-4 py-2 inline-flex items-center gap-1.5"
              >
                <UserCheck size={12} />
                Dodaj profil
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="compass-btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5"
              >
                <UserPlus size={12} />
                Zaproś pierwszą osobę
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((member) => {
              const displayName = member.full_name ?? member.email?.split('@')[0] ?? 'Bez nazwy'
              const initial = displayName[0].toUpperCase()
              const roles: string[] = Array.isArray(member.role) ? member.role : []
              const skills: string[] = Array.isArray(member.skills) ? member.skills : []
              const profileType = (member.profile_type ?? 'active') as ProfileType

              return (
                <div
                  key={member.id}
                  className="compass-card p-4 group"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-compass-surface-3 border border-compass-border flex-shrink-0 flex items-center justify-center font-mono text-sm text-compass-muted uppercase font-semibold select-none">
                      {initial}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-compass-text">
                            {displayName}
                          </p>
                          {member.email && (
                            <p className="font-mono text-2xs text-compass-dim">{member.email}</p>
                          )}
                        </div>
                        <MemberActions memberId={member.id} member={member} />
                      </div>

                      {/* Status + roles row */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <ProfileTypeBadge profileType={profileType} />
                        {roles.map((role) => (
                          <span
                            key={role}
                            className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px] bg-compass-accent/10 text-compass-accent"
                          >
                            {role}
                          </span>
                        ))}
                      </div>

                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="font-mono text-2xs px-1.5 py-0.5 rounded-[2px] bg-compass-surface-3 text-compass-muted"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {member.bio && (
                        <p className="text-xs text-compass-muted mt-2 leading-relaxed">{member.bio}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddModal && <AddProfileModal onClose={handleModalClose} />}
      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  )
}
