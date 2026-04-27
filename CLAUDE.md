# CLAUDE.md — Hotable Compass

Internal PM tool for Hotable Sp. z o.o. (3-person team). Solo Next.js 15 app, Supabase backend, deployed on Netlify.

## Stack

Next.js 15 App Router (NOT Pages Router) · React 19 · TypeScript strict · Tailwind v3 + shadcn/ui · Supabase (PostgreSQL + Auth + Realtime + RLS + Edge Functions) via `@supabase/ssr` cookie auth · `@hello-pangea/dnd` for Kanban · `@anthropic-ai/sdk` for Claude API · pnpm.

For full version pinning see `package.json`. Don't suggest dependency upgrades unprompted.

## Architecture rules

- **Server Components by default.** `'use client'` only when interactivity is required (event handlers, hooks, browser APIs). Data fetching lives in Server Components or Server Actions, never in client components.
- **All mutations through Server Actions** in `app/actions/`. Never call Supabase directly from client components for writes.
- **Routes**: `(auth)` group for unauthenticated, `(dashboard)` group with auth guard in its `layout.tsx`. Auth-callback as bare `app/auth/callback/route.ts`.
- **`/board` is realtime**, subscribed to `tasks` table changes filtered by active `cycle_id`. Don't add second realtime channel — one is enough for <50 tasks per sprint.
- **RLS-first**: every new table needs a policy in the same migration. Default for the team scope is "all authenticated CRUD" except `profiles` (self-update only). If you create a table without a policy, the migration is incomplete.
- **Soft deletes** via `deleted_at` — every read query must filter `deleted_at IS NULL` unless the use case is explicitly "show archived".

## What this project is NOT

- Not multi-tenant — 3-person team, equal permissions, no admin/manager roles.
- Not a time tracker, not a comments system, not a custom-fields engine — out of scope.
- No Zustand/Redux — Server Components + URL state + Server Actions are the state model.
- No Prisma — Supabase JS client is the only data access path.

## Conventions

- Components: `kebab-case.tsx` filename, `PascalCase` export, named props interface (`type FooProps`), no inline anonymous prop types, no `any`.
- Custom UI uses `compass-*` design tokens (defined in `tailwind.config.js` and `app/globals.css`). Never use arbitrary color values like `bg-[#F5A83A]`.
- Server Actions are async, validate input with Zod, throw on auth failure, call `revalidatePath` after mutations.
- Generated files are **read-only for Claude**: `lib/supabase/types.ts`, `components/ui/*` (shadcn). To regenerate types after migrations: `supabase gen types typescript --local > lib/supabase/types.ts`.

## Where things live

- Server Actions → `app/actions/<entity>.ts`
- Custom UI components → `components/compass/`
- shadcn primitives → `components/ui/` (don't edit, re-add via `npx shadcn`)
- DB schema, migrations, edge functions → `supabase/`
- Domain helpers (`calculateICE`, `inferTaskType`, `cn`, formatters) → `lib/utils.ts`
- Supabase clients → `lib/supabase/{client,server}.ts`

## Need details?

- Database schema and RLS policies → see `supabase/migrations/` (source of truth) and `lib/supabase/types.ts` (generated types)
- Architecture deep-dive → @docs/ARCHITECTURE_AUDIT.md
- Feature status and known gaps → @docs/FEATURES_STATUS.md, @docs/GAPS_AND_ISSUES.md
- Security model → @docs/SECURITY_REVIEW.md
- AI integration specs → @docs/AI_INTEGRATION_PLAN.md
- Roadmap and current sprint plan → @docs/ROADMAP.md
- Design system tokens, typography → @docs/DESIGN_SYSTEM.md (move CSS variables here from this file if not already)

Read these only when the task touches the relevant area.

## Workflow expectations

- Use plan mode (Shift+Tab×2) for any change touching more than 3 files, schema, or `app/actions/`.
- After schema migration, regenerate types **and commit them**. Don't ask Claude to hand-edit `types.ts`.
- Before suggesting a new dependency, check it isn't already a peer of something installed. The team prefers fewer packages.

## Verification

Claude should be able to verify its own work. For this project:
- Type check: `pnpm tsc --noEmit`
- Lint: `pnpm lint`
- Tests (when present): `pnpm test`

If Claude completes a task without running at least the type check, the task is not complete.