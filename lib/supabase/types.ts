// Typy generowane z Supabase — nie edytuj ręcznie
// Aby zaktualizować: supabase gen types typescript --local > lib/supabase/types.ts

// task_status: migracja 001 + 'in_review' dodane w migracji 004
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskType = 'research' | 'development' | 'outreach' | 'design' | 'marketing' | 'support' | 'ops'
export type ScopeTag =
  | 'scope_1.0'
  | 'scope_1.5'
  | 'scope_2.0'
  | 'grant_parp'
  | 'marketing'
  | 'ops'
// document_type: migracja 001 + 'brief' dodane w migracji 004
export type DocumentType = 'adr' | 'rfc' | 'spec' | 'brief' | 'weekly_summary'
export type DocumentStatus = 'draft' | 'review' | 'accepted' | 'deprecated' | 'superseded'
export type GoalType = 'objective' | 'key_result' | 'grant_milestone'
export type GoalStatus = 'on_track' | 'at_risk' | 'off_track' | 'achieved'
export type IdeaStatus = 'inbox' | 'accepted' | 'rejected' | 'converted'
export type IdeaSource = 'founders_meeting' | 'user_feedback' | 'competitor' | 'market' | 'other'
export type AiFeature = 'assignee_recommender' | 'workload_balancing' | 'auto_categorization'
export type TaskSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
export type SprintLinkLabel = 'blocker' | 'info' | 'doc'

export interface RaciMatrix {
  responsible: string | null
  accountable: string[]
  consulted: string[]
  informed: string[]
}

export interface SprintLink {
  id: string
  title: string
  url: string
  label: SprintLinkLabel
}

export interface UnavailabilityEntry {
  date: string
  reason: string
}

// migration 008 type — kept for backwards-compat reference only
export type MemberRole = 'pm' | 'developer' | 'designer' | 'engineer' | 'researcher' | 'marketing'

// migration 009: profile_type discriminates real users vs placeholders
export type ProfileType = 'active' | 'placeholder' | 'invited'

export interface DbUser {
  id: string
  email: string | null              // nullable since migration 009 (placeholder profiles)
  full_name: string | null
  avatar_url: string | null
  created_at: string
  // Extended in migration 008
  skills?: string[]
  // migration 009: role is now text[] (multi-role)
  role?: string[]
  bio?: string | null
  // migration 009: new columns
  profile_type?: ProfileType
  linked_user_id?: string | null
  // migration 014: capacity planning
  base_capacity?: number | null
}

export interface DbProject {
  id: string
  name: string
  scope_tag: ScopeTag
  description: string | null
  color: string
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface DbTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  type: TaskType
  project_id: string
  assignee_id: string | null
  parent_task_id: string | null
  cycle_id: string | null
  due_date: string | null
  position: number
  // migracja 004
  ai_suggested: boolean
  deleted_at: string | null
  // migracja 012
  size?: TaskSize | null  // @deprecated — use story_points
  raci?: RaciMatrix | null
  // migracja 016
  story_points?: number | null
  created_at: string
  updated_at: string
}

export interface DbCycle {
  id: string
  name: string
  start_date: string
  end_date: string
  goal: string | null
  is_active: boolean
  velocity_planned: number | null
  velocity_actual: number | null
  // migracja 013
  notes: string | null
  sprint_links: SprintLink[] | null
  unavailability: Record<string, UnavailabilityEntry[]> | null
  // migracja 017
  tolerance_percent: number
  created_at: string
}

export interface DbDocument {
  id: string
  title: string
  type: DocumentType
  status: DocumentStatus
  content: string
  project_id: string | null
  author_id: string
  created_at: string
  updated_at: string
}

export interface DbGoal {
  id: string
  title: string
  type: GoalType
  status: GoalStatus
  description: string | null
  progress: number
  project_id: string | null   // migration 011
  parent_goal_id: string | null
  due_date: string | null
  target_value: number | null
  current_value: number | null
  unit: string | null
  quarter: string | null
  budget_planned_pln: number | null
  budget_actual_pln: number | null
  created_at: string
  updated_at: string
}

export interface DbIdea {
  id: string
  title: string
  description: string | null
  status: IdeaStatus
  ice_impact: number
  ice_confidence: number
  ice_ease: number
  ice_score: number
  rejection_reason: string | null
  source: IdeaSource
  promoted_to_task_id: string | null
  author_id: string
  created_at: string
  updated_at: string
}

export interface DbAiFeedback {
  id: string
  feature: AiFeature
  task_id: string | null
  suggestion: Record<string, unknown> | null
  accepted: boolean | null
  override_value: Record<string, unknown> | null
  created_at: string
}

// Joined types
export interface TaskWithRelations extends DbTask {
  project: DbProject
  assignee: DbUser | null
  subtasks: DbTask[]
}

export interface IdeaWithAuthor extends DbIdea {
  author: DbUser
}
