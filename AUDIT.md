# AUDYT ARCHITEKTURY — Hotable Compass

> Audyt niezależny, read-only. Data: 2026-06-30. Nic nie zostało naprawione ani zmienione w kodzie aplikacji — to wyłącznie diagnoza.
> Stack zweryfikowany w kodzie: Next.js 15.5.15 (App Router), React 19.2, TypeScript 5.7 (`strict: true`), Supabase (PostgreSQL + Auth + Realtime + RLS + Edge Functions), Anthropic SDK, hosting Netlify (`@netlify/plugin-nextjs`), nie Vercel jak zakładał brief.

---

## 1. Streszczenie wykonawcze

Repozytorium jest **funkcjonalnie bogate i zaskakująco dojrzałe jak na narzędzie 3-osobowe**: build przechodzi (`next build` ✓), `tsc --noEmit` jest czysty (0 błędów), nie ma `any`/`as any`, nie ma zależności cyklicznych, RLS jest włączone na wszystkich 10 tabelach, a sekrety server-side (`service_role`, `ANTHROPIC_API_KEY`) nie wyciekają do bundla klienta. Sprint Board ma poprawnie zrobiony streaming (`Suspense`), `cache()` na hot-queries i jedyną subskrypcję Realtime z czyszczeniem kanału. To nie jest projekt w stanie krytycznym.

Natomiast pod powierzchnią są **realne problemy bezpieczeństwa i poprawności**, które brief słusznie kazał szukać:

1. **`profiles` czytane bez logowania (PII dla anon).** Polityka `profiles_select ... using (true)` ([001_initial_schema.sql:240](supabase/migrations/001_initial_schema.sql#L240)) pozwala każdemu posiadaczowi publicznego klucza anon (jest w bundlu) odczytać maile, role i umiejętności całego zespołu bez sesji. **Krytyczny.**
2. **Auth fail-OPEN poza produkcją + „cichy sukces" mutacji.** Middleware i layout przepuszczają wszystko w dev/bez-ENV ([middleware.ts:6](middleware.ts#L6), [layout.tsx:13-25](app/(dashboard)/layout.tsx#L13)), a kilkanaście Server Actions przy braku auth zwraca `{ error: null }` (UI pokazuje sukces, nic się nie zapisuje). Produkcja zależy w 100% od poprawnego ENV + RLS. **Wysoki/Krytyczny.**
3. **Edge Function bez uwierzytelnienia, CORS `*`, z `service_role`.** [generate-weekly-summary/index.ts:9](supabase/functions/generate-weekly-summary/index.ts#L9) — każdy znający URL może wstawiać wiersze do `documents` z pominięciem RLS. **Wysoki.**
4. **Reset hasła: enumeracja kont + token w odpowiedzi.** [auth.ts:70-112](app/actions/auth.ts#L70) zwraca inny komunikat dla istniejącego/nieistniejącego maila, a w fallbacku (brak Resend) zwraca żywy `hashed_token` do wywołującego. **Wysoki.**
5. **„AI" to w większości reguły, nie ML, a wydajność listy jest słaba.** Klasyfikacja typu zadania to czysty regex z zaszytymi „confidence" ([utils.ts:18-58](lib/utils.ts#L18)) — nie TF-IDF/model. Backlog renderuje wszystkie wiersze bez wirtualizacji i bez memoizacji, a React Compiler jest wyłączony ([backlog-view.tsx:423-668](components/compass/backlog-view.tsx#L423)). **Wysoki.**

**Stan zdrowia repo:** dobry fundament inżynierski (typy, build, RLS-on, brak `any`, brak cykli), ale **warstwa autoryzacji jest płytka** (wszędzie „zalogowany = pełny CRUD", brak `WITH CHECK`, brak ról), **spójność transakcyjna kuleje** (read-modify-write na JSONB, nieatomowy „jeden aktywny sprint", nieatomowy promote pomysłu), a **dokumentacja (CLAUDE.md) rozjechała się ze stanem migracji i tras** (9 vs realnych 16 tras; seed niezgodny z enumem po migracji 015 → `supabase db reset` się wywali). Testy są **czerwone: 7/158 failuje**. Większość długu jest typu „średni" i dobrze izolowana — to repo do uporządkowania, nie do przepisania.

---

## 2. Mapa repozytorium (Faza 0)

### 2.1 Drzewo katalogów (odpowiedzialności)

```
PMHOTABLE/
├── app/
│   ├── (auth)/            ← trasy publiczne: login, invite/[token], reset-password (+ layout siatki)
│   ├── auth/              ← route handlery: callback (OAuth/OTP), signout
│   ├── (dashboard)/       ← trasy chronione (guard w layout.tsx) — 16 realnych tras
│   └── actions/           ← Server Actions ('use server'): tasks, cycles, projects, goals,
│                             ideas, documents, invites, team, users, weekly, ai, auth
├── components/compass/    ← wszystkie komponenty UI (29 plików). BRAK components/ui (shadcn nieobecny)
├── lib/
│   ├── supabase/          ← client.ts (browser), server.ts (RSC+getAuthenticatedClient), types.ts (generated)
│   ├── velocity/          ← tolerance.ts (strefy zielona/żółta/czerwona)
│   ├── utils.ts           ← cn(), formatery PL, calculateICE(), inferTaskType() (regex „AI")
│   ├── capacity.ts        ← obliczenia pojemności story points
│   ├── team-constants.ts  ← stałe zespołu
│   └── mock-data.ts       ← fallback gdy brak auth/ENV
├── supabase/
│   ├── migrations/        ← 001–017 (17 migracji)
│   ├── functions/         ← generate-weekly-summary (Deno edge fn, cron)
│   ├── seed.sql           ← dane demo (NIEZGODNE z enumem po 015)
│   └── seed_history.sql   ← dane historyczne dla AI (też niezgodne z enumem)
├── __tests__/             ← 4 pliki testów (actions/cycles, ideas, tasks; lib/utils) — 7 failuje
├── docs/                  ← 8 dokumentów (audyty, roadmap, security review — część nieaktualna)
├── middleware.ts          ← auth gate (BYPASS w dev)
├── next.config.ts         ← nagłówki bezpieczeństwa + CSP, optimizePackageImports
└── (eslint/tailwind/tsconfig/vitest config)
```

### 2.2 Mapa tras (App Router) — 16 realnych tras dashboardu

| Trasa | Typ | Dane (tabele) | Uwaga |
|---|---|---|---|
| `/` | RSC | — | redirect → /my-day |
| `/login`, `/reset-password`, `/invite/[token]` | RSC/Client | auth | publiczne |
| `/auth/callback`, `/auth/signout` | Route Handler | auth | |
| `/my-day` | RSC | cycles, projects, profiles (×2), tasks | **wodospad 3-falowy** (PERF) |
| `/board` | RSC + Suspense | cycles ×3, projects, tasks, profiles | wzorcowy (cache+stream+realtime) |
| `/backlog` | RSC + Suspense | tasks, projects (×2), cycles (×2), profiles | **podwójny fetch projects** |
| `/sprints` | RSC | cycles | brak loading/suspense |
| `/team` | RSC | profiles (×2), tasks (×2), cycles | **podwójny fetch profiles+tasks** |
| `/team/members` | **Client (useEffect)** | profiles | powinno być RSC |
| `/team/invite` | Client | invites | |
| `/capacity` | RSC | — | redirect → /team |
| `/ideas` | RSC | ideas, projects | |
| `/goals` | RSC | goals, projects | |
| `/goals/[id]` | **Client (useEffect)** | goals, projects | powinno być RSC |
| `/gantt` | RSC (`revalidate=60`) | cycles, goals, tasks | GanttView nie lazy-loaded |
| `/ai-metrics` | RSC | ai_feedback | |
| `/ai-testing` | Client | tasks/profiles (AI) | narzędzie deweloperskie |
| `/settings/account` | Client | auth | |
| `/settings/team` | **Client (useEffect)** | profiles | powinno być RSC |

CLAUDE.md deklaruje **9 tras** i wymienia `/decisions` oraz `/weekly`, które **nie istnieją** (choć `documents.ts` i `weekly.ts` są zaimplementowane → martwy kod / niezrealizowany plan). `loading.tsx` istnieje tylko dla 7 z 16 tras.

### 2.3 Inwentarz komponentów (kluczowe)

- **God components (client):** `task-detail-modal.tsx` (1138 linii), `goals-view.tsx` (1109), `backlog-view.tsx` (734), `sprint-board.tsx` (610), `gantt-view.tsx` (521), `ideas-view.tsx` (408).
- **Server Component (dobrze):** `team-capacity-view.tsx` (brak `'use client'`).
- **Współdzielone prymitywy:** `task-card.tsx`, `page-header.tsx`, `wip-warning.tsx`, `skeletons.tsx`, `cycle-selector.tsx`.
- **Code-split:** `TaskDetailModal` ładowany przez `next/dynamic({ ssr:false })` z `sprint-board` i `backlog-view`.
- `'use client'` w 32 plikach; `useEffect` tylko w 7 plikach (mało — dobry znak, dane głównie w RSC).
- **Brak `components/ui/` (shadcn).** UI to surowy Tailwind + autorskie klasy `.compass-*`. Stąd nieużywane paczki Radix (patrz 2.7).

### 2.4 Warstwa danych

- Klient przeglądarki: `lib/supabase/client.ts` (`createBrowserClient`, non-null assertion na ENV).
- Serwer: `lib/supabase/server.ts` — `createClient()` (zwraca `null` bez ENV) + `getAuthenticatedClient()` (`getUser()` + zwraca `{ supabase, userId }` lub `null`).
- Wszystkie zapytania przez Server Actions w `app/actions/*`. Brak bezpośrednich zapytań z komponentów poza Realtime.
- **Realtime:** dokładnie jeden kanał — `sprint-board.tsx:62` (`board-cycle-${cycleId}`, filtr po `cycle_id`), z czyszczeniem `removeChannel` (brak wycieku kanałów). Backlog NIE ma realtime (rozjazd zachowań board vs backlog).
- Cache: `getActiveCycle`, `getAllCycles` (cycles.ts), `getProjects` (projects.ts), `getProfiles` (users.ts) owinięte w `react.cache()`. **Ale** istnieje DRUGI `getProjects` w `tasks.ts:139` **bez** `cache()`, i to jego importują board/backlog.

### 2.5 Warstwa „AI" — weryfikacja bez taryfy ulgowej

| Funkcja | Deklaracja briefu | Stan faktyczny |
|---|---|---|
| Klasyfikacja typu zadania | „TF-IDF + klasyfikator" | **Nieprawda.** Czysty regex `inferTaskType()` ([utils.ts:18-58](lib/utils.ts#L18)). „Confidence" 0.88/0.85/… są **zaszyte na sztywno**, niezwiązane z danymi. Brak modelu, treningu, metryk. Gubi formy fleksyjne („crashed", „fixes") — potwierdzone czerwonym testem. |
| Rekomendacja przydziału | „scoring skille × obciążenie × historia" | **To realny LLM**, nie formuła. `getAssigneeRecommendation` ([ai.ts:114](app/actions/ai.ts#L114)) buduje prompt z historią ostatnich 20 zadań/osobę i woła Claude `haiku-4-5`, parsuje JSON, waliduje id. Zwraca uzasadnienie. Odpalane z `useEffect` przy każdym otwarciu modala (bez cache/debounce); **błędy łykane po cichu** (`catch {}`). |
| Balansowanie obciążenia | „heurystyka" | **Zgodne.** `getWorkloadSuggestions` ([ai.ts:30](app/actions/ai.ts#L30)) — ranking po liczbie aktywnych zadań, próg różnicy ≥2, max 3 sugestie. Liczone server-side per wejście na `/team` (z ponownym pobraniem profiles+tasks). |
| `ai_feedback` | „każda interakcja logowana" | **Zgodne i podłączone.** `logAIFeedback` wołane z `assignee-suggestions`, `task-detail-modal` (accept/reject typu), `workload-suggestions` (apply/dismiss). Schemat: feature/task_id/suggestion/accepted/override_value. Acceptance rate liczalny (`getAIFeedbackStats`). Tabela utworzona **dwukrotnie** (migracje 004 i 005). |

### 2.6 Konfiguracja i sekrety

- ENV (nazwy): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ANTHROPIC_API_KEY`.
- `.env.local` **nie jest** śledzony przez git i **nigdy nie był** commitowany (`git log --all -- .env.local` pusty) — ale zawiera realny, długoterminowy `service_role` JWT na dysku.
- `next.config.ts`: pełny zestaw nagłówków bezpieczeństwa + CSP (z `unsafe-inline`/`unsafe-eval` wymaganymi przez Next), `optimizePackageImports` dla `lucide-react` i `@hello-pangea/dnd`.
- `tsconfig.json`: `strict: true`, alias `@/*`. **Brak** `eslint.ignoreDuringBuilds`/`typescript.ignoreBuildErrors` (dobrze — build naprawdę sprawdza typy i lint).

### 2.7 Stan zależności

- Główne: next 15.5.15, react 19.2, @supabase/ssr 0.5, @supabase/supabase-js 2.47, @hello-pangea/dnd 18, zod 4, @anthropic-ai/sdk 0.89, resend 6.
- **Nieużywane (depcheck):** `@radix-ui/react-{avatar,label,select,separator,slot,tooltip}`, `class-variance-authority` — pozostałość po nigdy-niewdrożonym shadcn/ui. (devDeps zgłoszone jako nieużywane — eslint/postcss/autoprefixer/supabase/testing-library — to **false positives**, używane przez konfigi/CLI/testy.)
- Brakująca zależność: `@eslint/eslintrc` (importowane w `eslint.config.mjs`, działa tranzytywnie).
- Brak cykli (`madge --circular` → „No circular dependency found", 85 plików).

---

## 3. Findingi (Fazy 1–5 + rozszerzenia)

> Skala: Krytyczny / Wysoki / Średni / Niski. Typ: `[BŁĄD/RYZYKO]` vs `[PREFERENCJA]`. ID zunifikowane globalnie.

### 3.1 Bezpieczeństwo i integralność danych (rozszerzenie A — priorytet)

#### BEZP-001 — `profiles` czytane bez logowania (PII dla anon)
- **Waga:** Krytyczny · **Typ:** [RYZYKO] · **Lokalizacja:** [supabase/migrations/001_initial_schema.sql:240](supabase/migrations/001_initial_schema.sql#L240)
- **Opis:** Polityka SELECT używa `using (true)` — odczyt profili (email, full_name, role, skills, bio) dozwolony dla roli `anon`, w przeciwieństwie do reszty tabel (`auth.uid() is not null`).
- **Dowód:** `create policy "profiles_select" on profiles for select using (true);`
- **Wpływ:** Każdy z publicznym kluczem anon (jest w bundlu klienta) odczytuje całą tabelę `profiles` bez sesji — wyciek PII zespołu.
- **Rekomendacja:** `using (auth.uid() is not null)` lub ograniczenie kolumn dla anon. · **Wysiłek:** S

#### BEZP-002 — Edge Function bez auth, CORS `*`, z `service_role`
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [supabase/functions/generate-weekly-summary/index.ts:9](supabase/functions/generate-weekly-summary/index.ts#L9)
- **Opis:** `Access-Control-Allow-Origin: '*'` i brak weryfikacji JWT/sekretu cron; klient tworzony z `service_role` (omija RLS) i robi INSERT do `documents`.
- **Dowód:** `'Access-Control-Allow-Origin': '*'` + `createClient(supabaseUrl, serviceRoleKey)` bez sprawdzenia `Authorization`.
- **Wpływ:** Nieautoryzowane tworzenie wierszy w `documents` (spam/DoS) z uprawnieniami service_role, jeśli `verify_jwt=false`.
- **Rekomendacja:** Wymusić sekret w nagłówku, zawęzić CORS, włączyć `verify_jwt`. · **Wysiłek:** M

#### BEZP-003 — Reset hasła: enumeracja kont
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/auth.ts:70-73](app/actions/auth.ts#L70)
- **Opis:** Zwraca `'Nie znaleziono konta z tym adresem email'` tylko gdy mail nie istnieje, a sukces gdy istnieje — endpoint pre-auth pozwala sprawdzać, które maile mają konto.
- **Wpływ:** Enumeracja kont/rekonesans. · **Rekomendacja:** Zawsze generyczny komunikat sukcesu. · **Wysiłek:** S

#### BEZP-004 — Reset hasła: token zwracany do wywołującego
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/auth.ts:77,104-112](app/actions/auth.ts#L104)
- **Opis:** Gdy brak/awaria Resend, action zwraca `{ resetLink }` z żywym `hashed_token` (recovery) do wywołującego. Action jest wołalny pre-auth dla dowolnego maila.
- **Wpływ:** Potencjalne przejęcie konta, jeśli ścieżka fallback jest osiągalna w produkcji. · **Rekomendacja:** Nigdy nie zwracać tokenu do klienta w produkcji; fallback tylko dev. · **Wysiłek:** S

#### BEZP-005 — `service_role` JWT na dysku, długoterminowy
- **Waga:** Krytyczny (warunkowo) · **Typ:** [RYZYKO] · **Lokalizacja:** `.env.local:3`
- **Opis:** Plik zawiera realny `service_role` JWT (omija RLS, `exp` w 2091). Plik jest w `.gitignore` i **nigdy nie był commitowany** (zweryfikowane), więc nie ma wycieku w historii — ryzyko dotyczy ekspozycji pliku (backup, screen-share).
- **Wpływ:** Wyciek pliku = pełny dostęp do bazy z pominięciem RLS. · **Rekomendacja:** Potwierdzić brak ekspozycji; rozważyć rotację i krótszy TTL/Vault. · **Wysiłek:** M

#### BEZP-006 — Host-header injection w mailach (invite/reset)
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/invites.ts:72-76](app/actions/invites.ts#L72), [auth.ts:53-57](app/actions/auth.ts#L53)
- **Opis:** Gdy `NEXT_PUBLIC_APP_URL` nieustawione, link budowany z nagłówków `Host`/`x-forwarded-proto` (sterowalne przez atakującego) i wstawiany do HTML maila bez escapowania.
- **Wpływ:** Phishingowe linki w mailach, możliwa iniekcja HTML. · **Rekomendacja:** Wymagać `NEXT_PUBLIC_APP_URL` w produkcji; escapować wartości. · **Wysiłek:** S

#### BEZP-007 — Brak autoryzacji aplikacyjnej (tylko „zalogowany")
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [invites.ts:40-108](app/actions/invites.ts#L40), [team.ts](app/actions/team.ts), [projects.ts:122](app/actions/projects.ts#L122), [cycles.ts:215](app/actions/cycles.ts#L215)
- **Opis:** Wszystkie destrukcyjne i ekspansywne akcje (zapraszanie, usuwanie członków/projektów/cykli/celów) gated wyłącznie przez „jest zalogowany" (RLS = `auth.uid() is not null`). Każdy zalogowany (w tym świeżo zaproszony) może zapraszać kolejnych i usuwać cudze dane.
- **Wpływ:** Eskalacja/nieograniczona ekspansja bazy użytkowników; usuwanie danych. (Per CLAUDE.md „3 osoby = równe prawa" — akceptowalne świadomie, ale zapraszanie jest niebezpieczne.) · **Rekomendacja:** Minimalny allowlist/rola na invite i destrukcyjne delete, albo świadomie udokumentować. · **Wysiłek:** M

#### BEZP-008 — Polityki RLS bez `WITH CHECK`
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [001_initial_schema.sql:244-259](supabase/migrations/001_initial_schema.sql#L244)
- **Opis:** Polityki `*_all` mają tylko `USING (auth.uid() is not null)` bez jawnego `WITH CHECK`. INSERT/UPDATE dziedziczą warunek niejawnie — kruche przy modyfikacjach.
- **Rekomendacja:** Dodać jawne `WITH CHECK`. · **Wysiłek:** S

#### BEZP-009 — Słabe hasło + wyścig akceptacji zaproszenia
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/invites.ts:20,114-217](app/actions/invites.ts#L114)
- **Opis:** Min. długość hasła = 6. Wyszukanie tokenu i oznaczenie `accepted_at` nie są atomowe — dwa równoległe accept przechodzą sprawdzenie `accepted_at IS NULL` zanim którekolwiek zapisze.
- **Wpływ:** Reuse tokenu; słabe hasła. · **Rekomendacja:** Min. 8–12; warunkowy UPDATE `WHERE accepted_at IS NULL` z kontrolą liczby wierszy. · **Wysiłek:** M

#### BEZP-010 — Soft delete obchodzony przez twardą kaskadę FK
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [001_initial_schema.sql:98,100](supabase/migrations/001_initial_schema.sql#L98) + [004_soft_delete.sql](supabase/migrations/004_soft_delete.sql)
- **Opis:** `tasks.project_id`/`parent_task_id` mają `ON DELETE CASCADE`. Usunięcie projektu lub taska-rodzica fizycznie kasuje zadania, omijając `deleted_at`. Brak globalnego egzekwowania filtra `deleted_at IS NULL` (każde zapytanie musi pamiętać ręcznie).
- **Rekomendacja:** `ON DELETE SET NULL/RESTRICT` dla encji z soft delete; widok/RLS filtrujący `deleted_at`. · **Wysiłek:** M

#### BEZP-011 — `ai_feedback` tworzone dwukrotnie (dwie polityki RLS)
- **Waga:** Niski · **Typ:** [BŁĄD] · **Lokalizacja:** [004_soft_delete.sql:38](supabase/migrations/004_soft_delete.sql#L38) + [005_ai_feedback.sql:4](supabase/migrations/005_ai_feedback.sql#L4)
- **Opis:** Tabela tworzona w 004 i 005 (różne `uuid_generate_v4` vs `gen_random_uuid`, różne nazwy polityk). 005 ma `IF NOT EXISTS` (CREATE no-op), ale `CREATE POLICY` daje DWIE nakładające się polityki.
- **Rekomendacja:** Skonsolidować do jednej migracji. · **Wysiłek:** S

#### BEZP-012 — Redundantny indeks + braki indeksów FK
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [006_invite_system.sql:14](supabase/migrations/006_invite_system.sql#L14)
- **Opis:** `CREATE INDEX ON invite_tokens (token)` duplikuje indeks PK (`token` jest PRIMARY KEY). Brak indeksów na `ideas.promoted_to_task_id`, `documents.author_id`, `documents.project_id` (FK używane w filtrach).
- **Rekomendacja:** Usunąć redundantny indeks; dodać brakujące FK-indeksy. · **Wysiłek:** S

#### BEZP-013 — `parent_task_id = id` (self-parent) możliwy
- **Waga:** Niski · **Typ:** [RYZYKO] · **Lokalizacja:** [001_initial_schema.sql:116-134](supabase/migrations/001_initial_schema.sql#L116)
- **Opis:** Trigger `check_task_nesting` blokuje głębokość >1, ale nie samo-referencji. CLAUDE.md wspomina trigger `check_parent_is_not_self()`, który **nie istnieje**.
- **Rekomendacja:** Dodać `if new.parent_task_id = new.id then raise exception`. · **Wysiłek:** S

### 3.2 Logika i poprawność (Faza 2)

#### LOG-001 — „Cichy sukces" mutacji przy braku auth
- **Waga:** Wysoki · **Typ:** [BŁĄD] · **Lokalizacja:** [goals.ts:71,122,156,172](app/actions/goals.ts#L71), [ideas.ts:61,87,115](app/actions/ideas.ts#L61), [documents.ts:57,80,99,123,139](app/actions/documents.ts#L57), [tasks.ts:169,205,248](app/actions/tasks.ts#L205)
- **Opis:** Gdy `getAuthenticatedClient()` zwraca `null` (brak sesji LUB brak kluczy), mutacje robią `return { error: null }` bez zapisu. UI pokazuje sukces, nic się nie utrwala. „Tryb dev mock" jest nieodróżnialny od „użytkownik niezalogowany".
- **Dowód:** `const auth = await getAuthenticatedClient(); if (!auth) return { error: null }`
- **Wpływ:** Cicha utrata danych / fałszywy sukces dla wygasłej sesji; maskowanie błędów auth. (cycles/projects/team robią to dobrze: `'Brak autoryzacji'`.)
- **Rekomendacja:** Zwracać jawny błąd auth; oddzielić gałąź dev-mock od niezalogowanego. · **Wysiłek:** S

#### LOG-002 — Auth fail-OPEN w dev / bez ENV
- **Waga:** Krytyczny · **Typ:** [RYZYKO] · **Lokalizacja:** [middleware.ts:6,13](middleware.ts#L6), [app/(dashboard)/layout.tsx:13-29](app/(dashboard)/layout.tsx#L13)
- **Opis:** Middleware przepuszcza wszystko gdy `NODE_ENV==='development'` lub brak ENV; layout wpuszcza `mockUser` w dev. W deployu bez poprawnego ENV brama jest otwarta, a actions oddają mock zamiast 401. Guard tylko w layoucie grupy nie chroni Route Handlerów/Server Actions (te polegają na RLS + `getUser()`).
- **Wpływ:** Brak fail-closed; produkcja zależy w 100% od ENV+RLS. · **Rekomendacja:** Fail-closed przy braku ENV w produkcji; twarde odrzucanie w mutujących akcjach. · **Wysiłek:** M

#### LOG-003 — Nieatomowy „jeden aktywny sprint"
- **Waga:** Wysoki · **Typ:** [BŁĄD] · **Lokalizacja:** [cycles.ts:93-110,146-169](app/actions/cycles.ts#L146)
- **Opis:** `activateCycle` robi „deaktywuj wszystkie" i „aktywuj jeden" jako dwa osobne UPDATE (awaria drugiego → zero aktywnych). `createCycle` czyta `is_active=true` i wstawia na podstawie nieświeżego wyniku — dwa równoległe create mogą oba ustawić `is_active: true`. `getActiveCycle` używa `.maybeSingle()` (błąd przy dwóch wierszach).
- **Wpływ:** Dwa lub zero aktywnych cykli pod współbieżnością/awarią. · **Rekomendacja:** Transakcja/RPC lub partial-unique index. · **Wysiłek:** M

#### LOG-004 — Read-modify-write na JSONB (lost update)
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [cycles.ts:294-434](app/actions/cycles.ts#L294)
- **Opis:** `addCycleLink`/`removeCycleLink`/`addUnavailableDate`/`removeUnavailableDate` pobierają tablicę/obiekt JSONB, mutują w JS, zapisują całość. Dwie równoległe edycje → ostatni nadpisuje, gubiąc wpis drugiego. Realne przy multi-user board.
- **Rekomendacja:** Znormalizowana tabela dzieci lub atomowy JSONB RPC (`||`/`jsonb_set`). · **Wysiłek:** M

#### LOG-005 — Nieatomowy promote pomysłu + utracony link FK
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [app/actions/ideas.ts:105-143](app/actions/ideas.ts#L105)
- **Opis:** Wstawienie taska i oznaczenie idei `converted` to dwa osobne kroki bez rollbacku. `promoted_to_task_id` (kolumna FK) **nigdy nie jest ustawiane** → utrata powiązania idea→task. Brak walidacji Zod wejścia.
- **Wpływ:** Osierocone taski, podwójny promote, zerwana śledzalność. · **Rekomendacja:** RPC/transakcja; ustawić `promoted_to_task_id`; walidacja. · **Wysiłek:** M

#### LOG-006 — Reorder subtasków nigdy nie zapisywany
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [components/compass/task-detail-modal.tsx:346-354](components/compass/task-detail-modal.tsx#L346)
- **Opis:** `handleMoveSubtask` zmienia tylko stan lokalny — brak wywołania Server Action (w przeciwieństwie do add/toggle/delete). Kolejność ginie po zamknięciu modala.
- **Wpływ:** Cicha utrata danych / zepsuta funkcja. · **Rekomendacja:** Persist przez `reorderSubtasks`. · **Wysiłek:** M

#### LOG-007 — Realtime UPDATE nadpisuje relacje i kłamliwy cast
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [components/compass/sprint-board.tsx:72-79](components/compass/sprint-board.tsx#L72)
- **Opis:** Handler `postgres_changes` robi `{ ...t, ...(payload.new as Partial<TaskWithRelations>) }`. `payload.new` to surowy wiersz BEZ relacji (`project`, `assignee`, `subtasks`); cast jest fałszywy. Zmiana `assignee_id`/`project_id` przez innego użytkownika aktualizuje scalar, ale wyświetlane relacje pozostają nieświeże. Dodatkowo echo Realtime po własnym optimistic update + `setTasks(initialTasks)` ([:98-100](components/compass/sprint-board.tsx#L98)) tworzy ścieżkę na migotanie/rozjazd.
- **Rekomendacja:** Re-fetch wiersza z relacjami przy UPDATE lub łączyć po id z lokalnej mapy relacji; nie castować surowego wiersza na typ z relacjami. · **Wysiłek:** M

#### LOG-008 — Optimistic patch z modala gubi relacje
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [task-detail-modal.tsx:257,874](components/compass/task-detail-modal.tsx#L257)
- **Opis:** `onUpdated(task.id, patch as Partial<TaskWithRelations>)` — patch ma `project_id`/`assignee_id`, ale merge `{...t, ...patch}` nie aktualizuje zagnieżdżonego `project`/`assignee`, więc wiersz pokazuje stary kolor/nazwę do refetchu.
- **Rekomendacja:** Przekazywać też rozwiązane obiekty relacji lub wyświetlać z mapy po id. · **Wysiłek:** M

#### LOG-009 — Brak wymuszenia `rejection_reason` przy odrzuceniu pomysłu
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [app/actions/ideas.ts:80-103](app/actions/ideas.ts#L80)
- **Opis:** `rejection_reason` dodawane tylko `if (status==='rejected' && rejectionReason)`. Odrzucenie bez powodu przechodzi do bazy i odbija się surowym błędem CHECK (a nie przyjaznym komunikatem). Brak walidacji Zod.
- **Rekomendacja:** Wymagać `rejectionReason` w Zod gdy status='rejected'. · **Wysiłek:** S

#### LOG-010 — `in_review` gubione w weekly summary
- **Waga:** Niski · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/weekly.ts:61-67](app/actions/weekly.ts#L61)
- **Opis:** Bucketowanie liczy done/in_progress/todo; `in_review` pobrane (tylko `cancelled` wykluczone) ale nigdzie nie kategoryzowane — znika z raportu.
- **Rekomendacja:** Dodać bucket `in_review`. · **Wysiłek:** S

#### LOG-011 — `tolerance_percent` ustawialny w update, pomijany w create
- **Waga:** Niski · **Typ:** [BŁĄD] · **Lokalizacja:** [app/actions/cycles.ts:101-110](app/actions/cycles.ts#L101)
- **Opis:** `CycleBaseSchema` przyjmuje `tolerance_percent`, `updateCycle` go zapisuje, ale `createCycle` go pomija. Nowy sprint nie może ustawić tolerancji na starcie.
- **Rekomendacja:** Dodać do insertu w create. · **Wysiłek:** S

#### LOG-012 — `getGoalById` używa `.single()` zamiast `.maybeSingle()`
- **Waga:** Niski · **Typ:** [BŁĄD] · **Lokalizacja:** [app/actions/goals.ts:43-58](app/actions/goals.ts#L43)
- **Opis:** Dla „nie znaleziono" `.single()` zwraca błąd PGRST116 do logów (inaczej niż `getCycleById`/`getMemberById`). · **Rekomendacja:** `.maybeSingle()`. · **Wysiłek:** S

### 3.3 Funkcjonalność i warstwa AI (Faza 3)

#### FUNC-001 — Klasyfikacja typu zadania to reguły, nie ML; zaszyte „confidence"
- **Waga:** Wysoki · **Typ:** [BŁĄD] (deklaracja ≠ implementacja) · **Lokalizacja:** [lib/utils.ts:18-58](lib/utils.ts#L18)
- **Opis:** `inferTaskType` to łańcuch regexów; wartości `confidence` (0.88/0.85/0.83/…) są stałymi literałami, nie pochodzą z modelu. Brak TF-IDF, treningu, metryk jakości. Kolejność reguł = priorytet (np. „research" przed „development").
- **Dowód:** `return { type: 'research', confidence: 0.88 }`
- **Wpływ:** „AI klasyfikator" w briefie/CLAUDE.md jest mylący; metryki „confidence" w UI są pozorne. · **Rekomendacja:** Opisać jako heurystykę regułową albo wdrożyć realny klasyfikator z metrykami; nie prezentować stałych jako confidence. · **Wysiłek:** M

#### FUNC-002 — Klasyfikator gubi formy fleksyjne (czerwony test)
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [lib/utils.ts:43](lib/utils.ts#L43) + [__tests__/lib/utils.test.ts:40](__tests__/lib/utils.test.ts#L40)
- **Opis:** `\bcrash\b` nie matchuje „crashed"/„crashes"; test „detects support from crash" failuje (`inferTaskType` zwraca `null`). Granice `\b` przy końcówkach gubią odmiany (PL i EN).
- **Wpływ:** Niska skuteczność na realnych tytułach. · **Rekomendacja:** Rdzenie/`stemming` lub `crash\w*`. · **Wysiłek:** S

#### FUNC-003 — Rekomendacja przydziału: błędy łykane po cichu, brak cache/debounce
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [app/actions/ai.ts:213-216](app/actions/ai.ts#L213), [task-detail-modal.tsx:173-178](components/compass/task-detail-modal.tsx#L173)
- **Opis:** `getAssigneeRecommendation` opakowane w `try { … } catch {}` — każdy błąd (parsowanie, API, limit) znika bez śladu. Wołane z `useEffect` przy każdym otwarciu modala, bez cache per `task.id` ani debounce — koszt tokenów i latencja przy każdym otwarciu.
- **Rekomendacja:** Logować błędy; cache po `task.id`; jawny przycisk „Zasugeruj"; rate-limit server-side. · **Wysiłek:** M

#### FUNC-004 — Trasy `/decisions` i `/weekly` zadeklarowane, nieistniejące (martwy kod)
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** CLAUDE.md vs `app/(dashboard)/` + [sidebar.tsx:33-71](components/compass/sidebar.tsx#L33)
- **Opis:** `app/actions/documents.ts` i `weekly.ts` zaimplementowane, ale brak stron `decisions/` i `weekly/`. Sidebar też ich nie linkuje. Moduły ADR/RFC i Weekly Summary z briefu/CLAUDE.md **nie mają UI**.
- **Wpływ:** Martwy kod akcji; niezrealizowane moduły; mylące docs. · **Rekomendacja:** Wdrożyć UI lub usunąć akcje i zaktualizować docs. · **Wysiłek:** M

### 3.4 Architektura i struktura (Faza 1)

#### STRUKT-001 — God components (1138 / 1109 / 734 linii)
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [task-detail-modal.tsx](components/compass/task-detail-modal.tsx) (1138), [goals-view.tsx](components/compass/goals-view.tsx) (1109), [backlog-view.tsx](components/compass/backlog-view.tsx) (734)
- **Opis:** `TaskDetailModal` ma ~20 `useState` i miesza: edycję tytułu/opisu, meta, AI typ, AI assignee, subtaski CRUD+reorder, story points + warning, RACI, linki, szablony, move-to-sprint, delete. `goals-view.tsx` skupia 10 komponentów (GoalsView+OKR+Grant+modale+budżety) i miesza cele z CRUD projektów.
- **Wpływ:** Trudna testowalność/utrzymanie; każda zmiana stanu re-renderuje cały modal. · **Rekomendacja:** Rozbić na sekcje/pliki; `useReducer` na draft taska. · **Wysiłek:** L

#### STRUKT-002 — Zdublowany `getProjects` (cache vs brak cache)
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [projects.ts:32](app/actions/projects.ts#L32) vs [tasks.ts:139](app/actions/tasks.ts#L139)
- **Opis:** Dwie funkcje `getProjects`: jedna `cache()` (projects.ts), druga bez cache (tasks.ts). Board/backlog importują niecachowaną → realne podwójne zapytanie (patrz PERF-002).
- **Rekomendacja:** Jedna funkcja w `cache()`; usunąć duplikat. · **Wysiłek:** S

#### STRUKT-003 — Komponent `Gridlines` definiowany w ciele renderu
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [gantt-view.tsx:143-159](components/compass/gantt-view.tsx#L143)
- **Opis:** `Gridlines` zdefiniowany wewnątrz `GanttView`, tworzony od nowa co render i instancjonowany per wiersz — łamie referencyjną stabilność i memoizację (patrz PERF-005).
- **Rekomendacja:** Wynieść do modułu z propsami. · **Wysiłek:** S

#### STRUKT-004 — Duplikacja formatera waluty z różnym wynikiem + błąd zaokrąglenia
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [goals-view.tsx:553,905-906](components/compass/goals-view.tsx#L553)
- **Opis:** Dwa `fmt`: GrantView „X 000 zł", BudgetBar „Xk zł". `toFixed(0)` gubi resztę (1500 → „1 000 zł"/„1k zł"). Ta sama kwota inaczej w dwóch miejscach.
- **Rekomendacja:** Jeden `formatPLN()` przez `Intl.NumberFormat('pl-PL',{currency:'PLN'})`. · **Wysiłek:** S

#### STRUKT-005 — Stan serwera kopiowany do `useState` bez resync
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** [backlog-view.tsx:42](components/compass/backlog-view.tsx#L42), [goals-view.tsx:27-28](components/compass/goals-view.tsx#L27), [ideas-view.tsx:27](components/compass/ideas-view.tsx#L27)
- **Opis:** Propsy z serwera kopiowane do `useState` dla optimistic; po `revalidatePath` props się zmienia, ale `useState` ignoruje (brak resync) → możliwy rozjazd.
- **Rekomendacja:** `useOptimistic` (React 19) lub resync efektem/`key`. · **Wysiłek:** M

#### STRUKT-006 — Asercje typów obchodzące typowanie
- **Waga:** Niski · **Typ:** [RYZYKO] · **Lokalizacja:** [tasks.ts:93,115,136](app/actions/tasks.ts#L93) (`as unknown as`), [ideas.ts:44,89](app/actions/ideas.ts#L44)
- **Opis:** Brak `any`/`as any` (zgodnie z CLAUDE.md), ale `as unknown as TaskWithRelations[]` i `Record<string, unknown>` patche obchodzą typy generowane — efekt jak `any` dla bezpieczeństwa typów relacji.
- **Rekomendacja:** Typować join przez relacyjne typy generowane. · **Wysiłek:** M

#### STRUKT-007 — Schema drift CLAUDE.md ↔ migracje ↔ seed
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** CLAUDE.md vs [015_task_type_refactor.sql](supabase/migrations/015_task_type_refactor.sql), [seed.sql:96](supabase/seed.sql#L96)
- **Opis:** Enum `task_type` po 015 to `research/development/outreach/design/marketing/support/ops`, ale `seed.sql`/`seed_history.sql` nadal wstawiają `feature`/`bug`/`chore` → `supabase db reset` po 015 **wywali się** na seedzie. CLAUDE.md opisuje stary enum, `role` jako TEXT (faktycznie `text[]`), wymienia migracje tylko 001-005, nie zna `invite_tokens`, `raci`, `story_points`, `tolerance_percent` itd.
- **Rekomendacja:** Zsynchronizować seed z enumem i CLAUDE.md ze stanem 017. · **Wysiłek:** M

#### STRUKT-008 — Sidebar/docs vs realne trasy (9 vs 16)
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [sidebar.tsx:33-71](components/compass/sidebar.tsx#L33)
- **Opis:** Realnych tras dashboardu jest 16, CLAUDE.md mówi 9. W sidebarze są trasy spoza docs (`/sprints`, `/ai-metrics`, `/ai-testing`, `/settings/team`), a `/settings/account` osiągalne tylko przez sub-nav.
- **Rekomendacja:** Zsynchronizować nawigację i docs. · **Wysiłek:** S

#### STRUKT-009 — Nieużywane zależności Radix/cva (martwy shadcn)
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** `package.json` + brak `components/ui/`
- **Opis:** 6 paczek `@radix-ui/*` + `class-variance-authority` nieużywane (shadcn nigdy nie wdrożony). · **Rekomendacja:** Usunąć z `package.json`. · **Wysiłek:** S

### 3.5 Wizual / UI / dostępność (Faza 4)

#### WIZ-001 — Wiersze backlogu nieoperowalne klawiaturą
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [backlog-view.tsx:533-666](components/compass/backlog-view.tsx#L533)
- **Opis:** Klikalne `div`/`span` z `onClick`, bez `role`/`tabIndex`/obsługi klawiatury — otwarcie szczegółów niedostępne dla klawiatury i czytników (WCAG 2.1.1).
- **Rekomendacja:** `<button>`/`<tr>` z `onKeyDown` Enter/Space. · **Wysiłek:** M

#### WIZ-002 — Checkbox z no-op `onChange`
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [backlog-view.tsx:537-542](components/compass/backlog-view.tsx#L537)
- **Opis:** `<input type="checkbox" onChange={() => {}}>` — toggle jest na nadrzędnym `div onClick`. Z klawiatury checkbox nic nie robi; anti-pattern controlled input.
- **Rekomendacja:** `onChange={onToggleSelect}` na inpucie. · **Wysiłek:** S

#### WIZ-003 — Ręcznie pisane modale bez focus trap / Esc / role="dialog"
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [goals-view.tsx:769,947,1069](components/compass/goals-view.tsx#L769), [ideas-view.tsx:221,311](components/compass/ideas-view.tsx#L221)
- **Opis:** 5 modali to `fixed inset-0` divy bez `role="dialog"`/`aria-modal`, bez pułapki focusu, bez Esc, bez przywrócenia focusu. Tylko `task-detail-modal` używa Radix Dialog (poprawnie).
- **Rekomendacja:** Ujednolicić na Radix Dialog. · **Wysiłek:** M

#### WIZ-004 — Selecty inline bez `aria-label`
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [backlog-view.tsx:575-584,626-639](components/compass/backlog-view.tsx#L575)
- **Opis:** Przezroczysty `<select class="absolute inset-0 opacity-0">` na badge'u, bez etykiety — czytnik czyta nieopisany combobox.
- **Rekomendacja:** `aria-label` na każdym select. · **Wysiłek:** S

#### WIZ-005 — Kolor jako jedyny nośnik informacji + niewalidowany hex
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [goals-view.tsx:1016-1023](components/compass/goals-view.tsx#L1016) (input hex), kropki projektów/statusów
- **Opis:** `style={{ backgroundColor: project.color }}` z wolnego pola hex (bez walidacji); kolor jest jedynym rozróżnikiem (WCAG 1.4.1/1.4.3). Pusty/zły hex psuje render.
- **Rekomendacja:** Walidacja hex, presety, dodatkowy nie-kolorowy wskaźnik. · **Wysiłek:** M

#### WIZ-006 — Custom dropdowny bez obsługi klawiatury
- **Waga:** Niski · **Typ:** [RYZYKO] · **Lokalizacja:** [task-detail-modal.tsx:950-957,1090-1097](components/compass/task-detail-modal.tsx#L950)
- **Opis:** Zamykane tylko na `mousedown`; brak Esc, strzałek, `role="listbox"`/`aria-expanded`. · **Rekomendacja:** Radix `DropdownMenu`/`Select` lub semantyka+Esc. · **Wysiłek:** M

#### WIZ-007 — Język interfejsu: mieszanka PL/EN, hardkodowane stringi
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** wszystkie widoki
- **Opis:** Stringi PL inline wymieszane z terminami EN („Objectives & Key Results", „RACI Matrix", „WIP limit"). Brak warstwy i18n. Akceptowalne dla narzędzia wewnętrznego, ale niespójne.
- **Rekomendacja:** Udokumentować PL-default + terminy domenowe EN jako świadome, lub katalog komunikatów. · **Wysiłek:** L

### 3.6 Wydajność (Faza 5 — priorytet)

> **Kontekst:** React Compiler jest **wyłączony** ([next.config.ts](next.config.ts) nie ma `experimental.reactCompiler`) → brak automatycznej memoizacji; wszystkie braki `useMemo`/`memo` poniżej są realne. Z `next build`: najcięższa trasa to **`/board` — First Load JS 252 kB** (page 61.3 kB), głównie przez `@hello-pangea/dnd`; `/team/members` 152 kB. Reszta ≈ 102–134 kB (zdrowo).

**Najwolniejsze odczuwalne przepływy (diagnoza):**
1. **Wejście na `/backlog`** — pełna lista bez wirtualizacji + re-render wszystkich wierszy przy każdym keystroke + podwójny fetch `projects`.
2. **Wejście na `/team`** — podwójny SELECT `profiles` i `tasks` w jednym renderze.
3. **Wejście na `/my-day`** — 3 sekwencyjne fale zapytań + zbędny osobny SELECT profilu.
4. **`/gantt`** — rows × months absolutnie pozycjonowanych divów, rekomputowane przy każdym ticku ResizeObserver; GanttView nie code-split.
5. **Każdy render RSC dashboardu** — wielokrotne sieciowe `getUser()` (getAuthenticatedClient bez `cache()`).

#### PERF-001 — Backlog bez wirtualizacji + wiersze bez memoizacji
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [backlog-view.tsx:423-434,507-668](components/compass/backlog-view.tsx#L423)
- **Opis:** Cała przefiltrowana lista renderowana naraz; `BacklogRow` nie jest w `memo()`, a rodzic podaje świeże inline arrow-propsy (`onToggleSelect={() => …}`, `onOpen={() => …}`) co render. Bez React Compiler → O(n) re-render wszystkich wierszy przy każdym keystroke w wyszukiwarce. Każdy wiersz ma 2 inline `<select>` ze wszystkimi profilami/opcjami.
- **Rekomendacja:** Wirtualizacja (`@tanstack/react-virtual`), `memo()` wiersza, stabilne `useCallback`. · **Wysiłek:** M

#### PERF-002 — Podwójne pobieranie `projects`/`cycles` na `/backlog`
- **Waga:** Wysoki · **Typ:** [BŁĄD] · **Lokalizacja:** [backlog/page.tsx:18-26,48-53](app/(dashboard)/backlog/page.tsx#L18)
- **Opis:** `getProjects()` wołane w `BacklogPage` i ponownie w `BacklogContent`. Niecachowany `getProjects` z `tasks.ts` (STRUKT-002) → realny podwójny SELECT.
- **Rekomendacja:** `cache()` lub przekazać props. · **Wysiłek:** S

#### PERF-003 — `getAuthenticatedClient` nie w `cache()` → wiele `getUser()`
- **Waga:** Wysoki · **Typ:** [RYZYKO] · **Lokalizacja:** [lib/supabase/server.ts:34-45](lib/supabase/server.ts#L34)
- **Opis:** Każda akcja woła `getUser()` (round-trip do Supabase Auth). Na `/my-day` ≥5× na render. Tylko query-actions w `cache()` dedupują swój własny `getUser`.
- **Rekomendacja:** Owinąć `getAuthenticatedClient` w `cache()`. · **Wysiłek:** S

#### PERF-004 — Podwójne pobieranie `profiles`+`tasks` na `/team`
- **Waga:** Średni · **Typ:** [BŁĄD] · **Lokalizacja:** [team/page.tsx:15-20](app/(dashboard)/team/page.tsx#L15) + [ai.ts:35](app/actions/ai.ts#L35)
- **Opis:** `getProfiles()`+`getAllTasksWithRelations()` oraz ponownie `from('profiles')`/`from('tasks')` wewnątrz `getWorkloadSuggestions()`. · **Rekomendacja:** Liczyć workload z już pobranych danych. · **Wysiłek:** M

#### PERF-005 — Gantt: divy gridlines O(rows×months) + brak code-split
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [gantt-view.tsx:143-159,220-463](components/compass/gantt-view.tsx#L220), [gantt/page.tsx:6](app/(dashboard)/gantt/page.tsx#L6)
- **Opis:** `Gridlines` (definiowany w renderze) instancjonowany per wiersz, każdy mapuje po `months` → setki absolutnych divów regenerowanych przy każdym ticku ResizeObserver. `goals.filter` ×3 bez memo (psuje memo `rows`). `cycleTasks.filter`+`SIZE_ORDER.reduce` per wiersz co render. GanttView importowany statycznie (mimo że wzorzec `next/dynamic` już jest w projekcie).
- **Rekomendacja:** Wynieść `Gridlines`/gridlines jako jeden overlay; memo derywacji; `next/dynamic` na GanttView. · **Wysiłek:** M

#### PERF-006 — `my-day`: wodospad 3-falowy + zbędny SELECT profilu
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** [my-day/page.tsx:14-34](app/(dashboard)/my-day/page.tsx#L14)
- **Opis:** Po `Promise.all` (4 zapytania) sekwencyjnie `await getMyTasks()`, potem jeszcze osobny `await` na profil użytkownika (który już jest w pobranym `profiles`).
- **Rekomendacja:** Wyciągnąć `userName` z `profiles`; zredukować fale. · **Wysiłek:** S

#### PERF-007 — `select('*')` wszędzie, brak paginacji list
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** ~14 zapytań (cycles/goals/documents/team/users/ideas/projects/tasks)
- **Opis:** Pełne kolumny (w tym ciężkie JSONB/Markdown `documents.content`, `cycles.unavailability`) i brak paginacji w `getAllCycles`/`getGoals`/`getDocuments`/`getIdeas`/`getTeamMembers`. Marginalne przy 3 osobach, rośnie z danymi.
- **Rekomendacja:** Projekcja kolumn dla list; paginacja/limit. · **Wysiłek:** M

#### PERF-008 — `reorderColumn`/`bulkCategorize`: N osobnych UPDATE
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** [tasks.ts:479-503](app/actions/tasks.ts#L479), [ai.ts:263-271](app/actions/ai.ts#L263)
- **Opis:** N równoległych UPDATE zamiast jednego `upsert` z tablicą — obciąża pulę połączeń przy długiej kolumnie. · **Rekomendacja:** `upsert([{id,position}])`. · **Wysiłek:** S

#### PERF-009 — Powtarzane `profiles.find`/`cycles.find` w pętlach renderu
- **Waga:** Niski · **Typ:** [RYZYKO] · **Lokalizacja:** [backlog-view.tsx:519](components/compass/backlog-view.tsx#L519), [task-detail-modal.tsx:510,543,575](components/compass/task-detail-modal.tsx#L510)
- **Opis:** `profiles.find(...)`/`cycles.find(...)` per wiersz/render zamiast precomputed `Map`. O(rows×profiles). · **Rekomendacja:** `useMemo(new Map(...))`. · **Wysiłek:** S

### 3.7 Testy i utrzymywalność (rozszerzenie B)

#### TEST-001 — Suite czerwony: 7/158 testów failuje
- **Waga:** Wysoki · **Typ:** [BŁĄD] · **Lokalizacja:** [__tests__/actions/tasks.test.ts](__tests__/actions/tasks.test.ts), [__tests__/lib/utils.test.ts:40](__tests__/lib/utils.test.ts#L40)
- **Opis:** (a) Mock `next/cache` nie eksportuje `revalidateTag` (dodane do kodu, mock nieaktualny) → wywala testy `tasks` używające `updateTask`/`createTask`. (b) Realny bug FUNC-002 („crashed" → null). `vitest run` kończy się 7 failami.
- **Wpływ:** Czerwony suite = brak siatki bezpieczeństwa; CI (gdyby był) blokowałby merge. · **Rekomendacja:** Zaktualizować mock o `revalidateTag`; naprawić regex lub test. · **Wysiłek:** S

#### TEST-002 — Brak CI/CD
- **Waga:** Średni · **Typ:** [RYZYKO] · **Lokalizacja:** brak `.github/workflows/`
- **Opis:** Brak automatycznego uruchamiania build/tsc/lint/test przy push/PR. Przy czerwonym suite i lint-warningach nic nie pilnuje regresji.
- **Rekomendacja:** Workflow: `tsc --noEmit` + `next lint` + `vitest run` + `next build`. · **Wysiłek:** S

#### TEST-003 — Pokrycie wąskie (4 pliki)
- **Waga:** Niski · **Typ:** [PREFERENCJA] · **Lokalizacja:** [__tests__/](__tests__/)
- **Opis:** Testy tylko dla utils + 3 actions (cycles/ideas/tasks). Brak testów komponentów, AI scoringu, ścieżek auth, race conditions. · **Rekomendacja:** Dodać testy na inwarianty (jeden aktywny sprint, promote, workload). · **Wysiłek:** M

---

## 4. Tablica priorytetów

### Szybkie wygrane (duży/średni efekt, mały wysiłek) — zacząć tu
| ID | Problem | Wysiłek |
|---|---|---|
| BEZP-001 | `profiles_select using(true)` → ograniczyć do zalogowanych | S |
| BEZP-003/004 | Reset hasła: generyczny komunikat + nie zwracać tokenu | S |
| LOG-001 | Mutacje: jawny błąd auth zamiast „cichego sukcesu" | S |
| PERF-002/003 | `cache()` na `getProjects`+`getAuthenticatedClient`; usunąć duplikat | S |
| PERF-006 | my-day: usunąć zbędny SELECT profilu, spłaszczyć fale | S |
| TEST-001 | Naprawić mock `revalidateTag` + regex „crashed" | S |
| STRUKT-007 | Zsynchronizować `seed.sql` z enumem (inaczej `db reset` pada) | M |
| BEZP-006 | Wymagać `NEXT_PUBLIC_APP_URL` + escapować maile | S |
| BEZP-011/012 | Skonsolidować `ai_feedback`; usunąć redundantny indeks | S |

### Wielkie kamienie (duży efekt, duży wysiłek) — zaplanować
| ID | Problem | Wysiłek |
|---|---|---|
| LOG-002 | Auth fail-closed (middleware/layout/actions) | M |
| BEZP-002 | Zabezpieczyć Edge Function (auth + CORS) | M |
| BEZP-007 | Model autoryzacji dla invite/delete | M |
| LOG-003/004/005 | Atomowość: aktywny sprint, JSONB, promote (RPC/transakcje) | M |
| PERF-001 | Wirtualizacja + memoizacja backlogu | M |
| PERF-005 | Refaktor wydajnościowy Gantta + code-split | M |
| STRUKT-001 | Rozbicie god components (modal, goals-view) | L |
| FUNC-004 | Wdrożyć lub usunąć moduły decisions/weekly | M |

### Niski priorytet — przy okazji
STRUKT-005/006/009, WIZ-005/006/007, PERF-007/008/009, LOG-010/011/012, BEZP-008/010/013, TEST-003, FUNC-001 (przemianować „confidence"). A11y (WIZ-001..004) — średni: warte zaplanowania, jeśli dostępność jest celem.

---

## 5. Surowe wyniki narzędzi

**`next build`** → ✓ sukces (29.2s). Najcięższe trasy (First Load JS):
```
/board          61.3 kB → 252 kB   ← najcięższa (@hello-pangea/dnd)
/team/members   33.2 kB → 152 kB
/login                  → 176 kB
/settings/team   3.78 kB → 134 kB
/goals/[id]/...         → 114–131 kB
Shared by all                102 kB
Middleware                  87.1 kB
```

**`tsc --noEmit`** → ✓ 0 błędów.

**`next lint`** → 6 warningów (same `no-unused-vars`): ai-testing:301, board/page:16, my-day/page:43, ai.ts:117, ideas.ts:118, goals-view:605/730. 0 errorów.

**`vitest run`** → ✗ **4 pliki / 7 testów failuje**, 151 pass (158). Przyczyny: mock `next/cache` bez `revalidateTag` (tasks.test); `inferTaskType('…crashed…')` → null (utils.test).

**`depcheck`** → nieużywane: `@radix-ui/react-{avatar,label,select,separator,slot,tooltip}`, `class-variance-authority`. Brakująca: `@eslint/eslintrc`. (devDeps eslint/postcss/autoprefixer/supabase/testing-library = false positives.)

**`madge --circular`** → ✓ „No circular dependency found" (85 plików).

**grep anti-wzorce:** `use client` w 32 plikach · `useEffect` w 7 · `: any` / `as any` = **0** · `as unknown as` = 5 · `.select('*')` = 14 · `console.log` = 0 · `console.error` = 27 · `@ts-ignore`/`@ts-expect-error` = 0, `eslint-disable-line` = 3 (task-detail-modal, exhaustive-deps) · empty `catch {}` = 3 (ai.ts, task-detail-modal, server.ts) · `dangerouslySetInnerHTML` = 0 · Realtime kanały = 1 (z cleanup).

**git:** `.env.local` nieśledzony i nigdy niecommitowany (`git log --all -- .env.local` pusty).

---

## 6. Oświadczenie o pokryciu

**Przejrzane w całości (kod otwarty i przeczytany):** `middleware.ts`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `lib/supabase/{client,server}.ts`, `lib/utils.ts`, `lib/capacity.ts`, `app/actions/{tasks,ai,cycles (część)}.ts`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/board/page.tsx`, `components/compass/sprint-board.tsx`, `package.json`. Przez wyspecjalizowanych agentów (z cytatami file:line): wszystkie migracje 001-017 + seedy + edge function; wszystkie pozostałe `app/actions/*` (goals, ideas, documents, invites, projects, team, users, weekly, auth); duże komponenty (`backlog-view`, `goals-view`, `gantt-view`, `task-detail-modal`, `team-capacity-view`, `ideas-view`); wszystkie strony/route handlery dashboardu + `sidebar.tsx`.

**Próbkowane / zweryfikowane punktowo (nie linia-po-linii):** `lib/velocity/tolerance.ts`, `lib/team-constants.ts`, `lib/mock-data.ts`, mniejsze komponenty (`task-card`, `quick-add-task`, `cycle-selector`, modale sprintów), `lib/supabase/types.ts` (generowane). Twierdzenia agentów o RLS, enum drift i edge function **zweryfikowane bezpośrednim grepem** w źródłach.

**Czego nie zrobiono / wymaga pomiaru przez autora:**
- **Runtime perf** (re-rendery, LCP/TTFB, wodospad sieci) — diagnozowane statycznie. Zmierzyć: React DevTools Profiler na `/backlog` i `/gantt`, Network/Lighthouse na `/board`.
- **`EXPLAIN ANALYZE`** na podejrzanych zapytaniach (`getAllTasksWithRelations`, join `TASK_SELECT` z subtaskami) — nie uruchomiono; brak dostępu do żywej bazy z planerem.
- **Edge function `verify_jwt`** — nie potwierdzono ustawienia w `config.toml`/dashboardzie Supabase; BEZP-002 zakłada najgorszy przypadek.
- **Czy ścieżka fallback resetu hasła (BEZP-004) jest osiągalna w produkcji** — zależy od tego, czy `RESEND_API_KEY` jest zawsze ustawione w prod.
- **`@next/bundle-analyzer`** — niezainstalowany; szczegółowy rozkład wagi bundla niedostępny poza tabelą `next build`.
- **Realne dane** — wszystkie obserwacje skali („marginalne przy 3 osobach") zakładają mały zbiór; nie zweryfikowano na produkcyjnym wolumenie.

> Nie wprowadzono żadnych zmian w kodzie aplikacji. Utworzono wyłącznie ten plik `AUDIT.md`.
