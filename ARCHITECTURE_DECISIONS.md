# Architecture Decisions — Hotable Compass

> Last updated: 2026-04-16
> These are the key architectural choices made during development, with rationale. For feature-level decisions see `docs/ARCHITECTURE_AUDIT.md`.

---

## ADR-001: Next.js 15 App Router over Pages Router

**Decision:** Use Next.js 15 with the App Router and React Server Components.

**Rationale:**
- Server Components eliminate client-side data fetching boilerplate — page data is fetched directly in `page.tsx` and passed to client components as props
- Server Actions (`'use server'`) replace REST API routes for mutations, keeping all DB logic in the same file hierarchy
- App Router's nested layouts provide the auth-guard pattern for the dashboard without middleware complexity
- Edge-ready by default (Vercel deployment, Supabase edge functions match)

**Trade-offs:**
- Learning curve for `async` Server Components and the client/server boundary
- `'use client'` must be explicitly added to interactive components — easy to forget

**Alternatives considered:** Pages Router (more familiar, worse RSC support), Remix (excellent data model but smaller ecosystem).

---

## ADR-002: Supabase as the Entire Backend

**Decision:** Use Supabase for PostgreSQL, Auth, Realtime subscriptions, Storage, and Edge Functions — instead of building a separate backend.

**Rationale:**
- 3-person team with no dedicated backend engineer — Supabase reduces backend work by ~80%
- Row Level Security (RLS) enforces data access at the DB level, not the application layer
- Realtime subscriptions (used on Sprint Board) require no additional infrastructure
- Magic link auth (OTP) is built-in — no password storage, no OAuth configuration
- `@supabase/ssr` handles cookie-based sessions correctly for Next.js server components
- Generous free tier covers the team for the entire grant period

**Trade-offs:**
- Supabase types must be manually regenerated after migrations (`supabase gen types`)
- Edge Functions run on Deno — different runtime from Node.js (minor inconvenience)
- RLS policy mistakes are hard to debug; required careful testing

**Alternatives considered:** PlanetScale + Prisma + custom auth (more flexible, 5× more setup), Firebase (NoSQL, poor for relational data).

---

## ADR-003: Server Actions over API Routes

**Decision:** All data mutations use Next.js Server Actions (`app/actions/*.ts`) rather than `app/api/` route handlers.

**Rationale:**
- Server Actions are co-located with the data they serve — `tasks.ts` contains all task mutations
- No fetch() boilerplate — components call `await createTask(input)` directly
- Type-safe by default — TypeScript infers input/output types across the server boundary
- Built-in CSRF protection (Next.js handles the POST with action ID)
- `revalidatePath()` after mutations keeps cached pages fresh without manual cache invalidation

**Trade-offs:**
- Not independently testable via HTTP (no curl-friendly endpoints)
- Cannot be called from external services (webhook handlers must still use route handlers)

**Where API routes are still used:** `app/auth/callback/route.ts` (OAuth code exchange) and `app/auth/signout/route.ts` (POST-based signout).

---

## ADR-004: Tailwind CSS with Custom Design Tokens

**Decision:** Use Tailwind CSS 3 with a set of `compass-*` CSS custom properties defined in `globals.css`, extended via `tailwind.config.ts`.

**Rationale:**
- Utility-first CSS removes the need for a separate stylesheet per component
- Custom tokens (`--compass-bg`, `--compass-accent`, etc.) create a consistent dark-mode design system without arbitrary color values in markup
- Tailwind's JIT compiler means zero unused CSS in production
- shadcn/ui components are already Tailwind-based — no integration friction

**Convention enforced:** Never use arbitrary Tailwind values like `bg-[#E8622A]` — always use token classes like `bg-compass-accent`. Changing the accent color requires updating only one CSS variable.

**Alternatives considered:** CSS Modules (good isolation, no design system), styled-components (runtime overhead, no RSC support).

---

## ADR-005: @hello-pangea/dnd for Drag and Drop

**Decision:** Use `@hello-pangea/dnd` (React 18+ community fork of `react-beautiful-dnd`) for the Sprint Board Kanban drag-and-drop.

**Rationale:**
- `react-beautiful-dnd` is unmaintained and has React 18 issues; `@hello-pangea/dnd` is the drop-in replacement maintained by the community
- Excellent accessibility (keyboard drag, screen reader announcements)
- Familiar API — extensive prior art and documentation online
- Works well with optimistic updates — DnD state is local, DB sync happens in background

**Trade-offs:**
- Bundle size (~30 KB gzipped) — acceptable for a dashboard app
- Not suitable for tree-level nesting (drag across hierarchies) — but the board only needs column-to-column

---

## ADR-006: Magic Link Auth (Passwordless)

**Decision:** Authentication uses Supabase magic link OTP only — no password, no Google OAuth.

**Rationale:**
- No passwords means no password storage, no password reset flow, no credential leak risk
- The team is 3 people — they know their email addresses, onboarding friction is a non-issue
- OTP codes expire in 1 hour — sessions are HttpOnly cookie-based (via `@supabase/ssr`)
- Meets NCBR/PARP grant requirements for user authentication in the evaluated system

**Trade-offs:**
- Requires email access to log in — blocked if email is unavailable
- No guest access or public API tokens

---

## ADR-007: Anthropic Claude API for Assignee Recommender

**Decision:** Use Claude Haiku (via `@anthropic-ai/sdk`) for the assignee recommendation feature. Use rule-based heuristics for workload balancing and auto-categorization.

**Rationale:**
- Assignee recommendation requires contextual reasoning over team history — LLMs handle this better than fixed rules
- Claude Haiku is fast (~1–2s) and cheap (~$0.00025/recommendation) — acceptable latency and cost for a PM tool
- The feature gracefully degrades to no-op when `ANTHROPIC_API_KEY` is absent — app works fully without it
- Workload balancing and auto-categorization are deterministic enough for rule-based logic; no API cost needed
- All AI calls are server-side only (Server Actions) — the API key is never exposed to the client
- `ai_feedback` table tracks acceptance rates, allowing future prompt improvement

**Alternatives considered:** OpenAI GPT-4o-mini (similar cost, less tuned for structured JSON output), local model via Ollama (no latency, but no server setup in Vercel Hobby).

---

## ADR-008: Vercel Hobby Tier for Deployment

**Decision:** Deploy on Vercel Hobby (free tier) with automatic Git deployments.

**Rationale:**
- Zero-config deployment for Next.js — push to main, it deploys
- HTTPS is automatic — required for Supabase auth cookies
- Edge network means fast response times in Poland (closest edge in Frankfurt)
- Hobby tier is sufficient for a 3-person internal tool — limits (100 GB bandwidth, 100 deployments/day) are not a concern

**Trade-offs:**
- No persistent server — Server Actions run as serverless functions (cold start ~200ms, acceptable)
- Cannot run long-running background jobs (weekly summaries are handled by Supabase Edge Functions instead)

---

## ADR-009: Soft Deletes for Tasks

**Decision:** Tasks use a `deleted_at TIMESTAMP` column instead of hard `DELETE`.

**Rationale:**
- Recovering accidentally deleted tasks is important for a PM tool — hard deletes are irreversible
- Soft deletes are transparent to the application: all queries add `.is('deleted_at', null)` filter
- Preserves referential integrity — subtasks, cycle assignments, and AI feedback still reference the row
- Future "trash" / restore UI is trivially implementable

**Trade-offs:**
- Queries must always include the `deleted_at IS NULL` filter — a missing filter is a bug (partially mitigated by TypeScript)
- DB grows over time without a periodic hard-delete job

---

## ADR-010: ICE Scoring as a Generated Column

**Decision:** `ice_score` in the `ideas` table is a PostgreSQL generated column: `(ice_impact + ice_confidence + ice_ease) / 3.0`.

**Rationale:**
- The formula is simple and fixed — no reason to compute it in application code
- Generated columns are always consistent — no risk of stale score if individual fields change
- Ordering ideas by ICE score is a single SQL `ORDER BY ice_score` — efficient with a standard index
- The formula is visible in the migration and self-documenting

**Alternatives considered:** Compute in `lib/utils.ts` (`calculateICE()` still exists as a utility for UI display formatting), store as application-computed field on insert (could drift).

---

## ADR-011: No Global State (No Redux/Zustand)

**Decision:** Use React `useState` + Server Component props + URL search params for all state. No global state manager.

**Rationale:**
- Server Components fetch data at the page level and pass it as props — no client-side store needed for initial data
- Mutations use optimistic updates via local `useState` + Server Actions — simple, no coordination needed
- URL params are used for filters (e.g., backlog status filter) — shareable, bookmarkable, no state hydration
- The app has no cross-page real-time state that would justify a global store

**Alternatives considered:** Zustand (lightweight, but adds an abstraction layer that's unnecessary here), React Query (good for client-side fetching, but Server Components make it redundant).
