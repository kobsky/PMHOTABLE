import { z } from 'zod'

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const TEAM_ROLES = [
  'CEO', 'CTO', 'CPO',
  'Project Manager', 'Product Manager',
  'Developer', 'Engineer',
  'Designer', 'UX Researcher',
  'Marketing', 'Sales',
  'Other',
] as const

export type TeamRole = typeof TEAM_ROLES[number]

// Backwards-compatible map for old MemberRole enum values (migration 008 → 009)
export const LEGACY_ROLE_LABELS: Record<string, string> = {
  pm: 'Project Manager',
  developer: 'Developer',
  designer: 'Designer',
  engineer: 'Engineer',
  researcher: 'UX Researcher',
  marketing: 'Marketing',
}

// ROLE_LABELS kept for any code still using the old MemberRole type
export const ROLE_LABELS = LEGACY_ROLE_LABELS

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

export const UpdateMemberSchema = z.object({
  full_name: z.string().min(1).max(100).optional(),
  // multi-role: array of strings, min 1 role required
  role: z.array(z.string().min(1).max(60)).min(1, 'Wybierz co najmniej jedną rolę').max(8).optional(),
  bio: z.string().max(500).nullable().optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
  base_capacity: z.number().int().min(1).max(100).optional(),
})

export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>

export const CreatePlaceholderSchema = z.object({
  full_name: z.string().min(1, 'Imię i nazwisko jest wymagane').max(100),
  // accepts string | null | undefined | '' — all map to null after transform
  email: z.string().email('Nieprawidłowy email').nullish().or(z.literal('')).transform(v => v || null),
  role: z.array(z.string().min(1).max(60)).min(1, 'Dodaj co najmniej jedną rolę').max(20),
  bio: z.string().max(500).optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
})

export type CreatePlaceholderInput = z.infer<typeof CreatePlaceholderSchema>
