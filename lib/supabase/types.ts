// ⚠️ PLIK PISANY RĘCZNIE — NIE rób `supabase gen types ... > lib/supabase/types.ts`!
// Całe repo importuje aliasy (DbUser/DbTask/DbCycle/TaskWithRelations/AiFeature/
// Database.Functions), których `gen types` NIE produkuje — nadpisanie wywala
// build (~90 błędów TS2305). To NIE jest plik generowany.
// Sprawdzenie zgodności ze schematem: generuj do pliku TYMCZASOWEGO i porównaj,
// NIE nadpisuj:  supabase gen types typescript --linked > /tmp/gen.ts  (potem diff)
// Zweryfikowane vs żywa baza (ref bgiezcdacrxnpzvwpdzu) po migracji 020:
// wsjf_*, RPC z 019, story_points/size/raci, AiFeature(6) — zgodne.

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
// Rozszerzone w migracji 020 (Tier 2): nowe nazwy funkcji wspomagania decyzji
// (sp_estimation_baseline=U2, wsjf_prioritization=U5) oraz klasyfikator ML
// (task_type_classifier_ml=U1). ai_feedback rejestruje WYŁĄCZNIE surowe
// interakcje (accept/reject/apply/dismiss) — nie "skuteczność".
export type AiFeature =
  | 'assignee_recommender'
  | 'workload_balancing'
  | 'auto_categorization'
  | 'sp_estimation_baseline'
  | 'wsjf_prioritization'
  | 'task_type_classifier_ml'
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
  // migracja 020 (U5 — SAFe WSJF, wspomaganie decyzji, BEZ LLM/ML)
  // Cztery komponenty WSJF: CoD = user_value + time_criticality + risk_reduction,
  // mianownik = job_size. Wszystkie nullowalne (zadania nieoszacowane).
  // DODANE RĘCZNIE; zweryfikowane vs żywa baza po deployu 020 (NIE nadpisuj gen types).
  wsjf_user_value?: number | null
  wsjf_time_criticality?: number | null
  wsjf_risk_reduction?: number | null
  wsjf_job_size?: number | null
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

// ---------------------------------------------------------------------------
// RPC (Postgres Functions) — DODANE RĘCZNIE dla migracji 019_tier1_atomicity.sql
// ---------------------------------------------------------------------------
// Brak żywej bazy w tym środowisku → nie można uruchomić
// `supabase gen types typescript`. Poniższe sygnatury zostały dodane ręcznie,
// aby wywołania auth.supabase.rpc(...) w Server Actions były spójne z funkcjami
// SQL z migracji 019. Zweryfikowane vs żywa baza po deployu (NIE nadpisuj gen types).
//
// Kształt zgodny z typowanym klientem Supabase: Database['public']['Functions'].
// (Klient w lib/supabase/server.ts jest obecnie nieparametryzowany typem
// Database, więc rpc() nie egzekwuje tego na poziomie kompilatora — te typy
// służą jako kontrakt referencyjny dla agentów podłączających akcje.)
export interface Database {
  public: {
    Functions: {
      // LOG-003 — atomowa aktywacja cyklu (deaktywuj wszystkie → aktywuj jeden)
      activate_cycle: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      // LOG-004 — atomowy append linku sprintu (p_link = { id,title,url,label })
      add_cycle_link: {
        Args: { p_cycle_id: string; p_link: SprintLink }
        Returns: undefined
      }
      // LOG-004 — atomowe usunięcie linku sprintu po id
      remove_cycle_link: {
        Args: { p_cycle_id: string; p_link_id: string }
        Returns: undefined
      }
      // LOG-004 — atomowy append wpisu niedostępności użytkownika
      add_unavailable_date: {
        Args: {
          p_cycle_id: string
          p_user_id: string
          p_date: string
          p_reason: string
        }
        Returns: undefined
      }
      // LOG-004 — atomowe usunięcie wpisu niedostępności użytkownika dla daty
      remove_unavailable_date: {
        Args: {
          p_cycle_id: string
          p_user_id: string
          p_date: string
        }
        Returns: undefined
      }
      // LOG-005 — atomowy promote pomysłu → zadanie; zwraca id zadania
      // lub null, jeśli pomysł nie istnieje / był już przeniesiony.
      promote_idea_to_task: {
        Args: {
          p_idea_id: string
          p_title: string
          p_project_id: string
          p_priority: TaskPriority
          p_assignee_id: string | null
        }
        Returns: string | null
      }
    }
  }
}

// Wygodny alias dla agentów podłączających akcje do RPC.
export type DbFunctions = Database['public']['Functions']
