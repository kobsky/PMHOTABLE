# Performance Implementation Plan (Lighthouse 45 -> 90+)

This document provides a step-by-step technical guide for optimizing the application's performance, focusing on LCP, TBT, and Network Payload.

## 🎯 Goals
- **LCP:** Reduce from 4.7s to < 2.5s (Optimize SSR & Data Fetching).
- **TBT:** Reduce from 1390ms to < 200ms (Reduce Main-thread blocking).
- **Payload:** Reduce from 3.5MB (Implement Code Splitting & Dynamic Imports).

---

## 🛠️ Step-by-Step Implementation

### 1. Server-Side Optimization (LCP & Document Latency)
**Problem:** High document request latency (~700ms) and slow SSR due to sequential data fetching.

#### A. Implement `unstable_cache` for Heavy Queries
Wrap the following Server Actions/Functions in `unstable_cache` to avoid redundant Supabase hits on every request:
- [`app/actions/cycles.ts`](app/actions/cycles.ts): `getAllCycles`, `getActiveCycle`.
- [`app/actions/projects.ts`](app/actions/projects.ts): `getProjects`.
- [`app/actions/users.ts`](app/actions/users.ts): `getProfiles`.

**Instruction:** Use a tag-based cache (e.g., `tags: ['cycles']`) and call `revalidateTag` in the corresponding mutation actions (e.g., `createCycle`, `updateCycle`).

#### B. Parallelize Data Fetching
In [`app/(dashboard)/board/page.tsx`](app/(dashboard)/board/page.tsx), the current `Promise.all` is a good start, but ensure that `getCycleById` is not blocking the initial render if it can be handled inside the `Suspense` boundary.

---

### 2. Client-Side Bundle Reduction (TBT & Payload)
**Problem:** Too much JavaScript blocking the main thread. Heavy components are loaded upfront.

#### A. Move `"use client"` Down the Tree
Identify components that wrap large sections of the page in `"use client"` and move the directive to the smallest possible leaf component.
- **Target:** [`app/(dashboard)/layout.tsx`](app/(dashboard)/layout.tsx) and [`app/(dashboard)/board/page.tsx`](app/(dashboard)/board/page.tsx).
- **Action:** Ensure the Page and Layout remain Server Components. Only the interactive elements (like `SprintBoard`) should be Client Components.

#### B. Implement `next/dynamic` for Heavy Components
The following components are "heavy" (large dependencies or complex logic) and are not needed for the initial paint. Wrap them in `dynamic()` with `ssr: false` where appropriate:

| Component | File Path | Reason |
| :--- | :--- | :--- |
| `TaskDetailModal` | [`components/compass/task-detail-modal.tsx`](components/compass/task-detail-modal.tsx) | Massive file (~1100 lines), only needed on click. |
| `GanttView` | [`components/compass/gantt-view.tsx`](components/compass/gantt-view.tsx) | Complex calculations and DOM manipulation. |
| `SprintBoard` | [`components/compass/sprint-board.tsx`](components/compass/sprint-board.tsx) | Uses `@hello-pangea/dnd` (heavy JS). |
| `NewSprintModal` | [`components/compass/new-sprint-modal.tsx`](components/compass/new-sprint-modal.tsx) | Only needed on user interaction. |

**Example Implementation:**
```tsx
const TaskDetailModal = dynamic(() => import('./task-detail-modal').then(mod => mod.TaskDetailModal), { 
  ssr: false,
  loading: () => <ModalSkeleton /> 
});
```

---

### 3. Configuration & Build Optimization
**Problem:** Potential for unused CSS/JS and suboptimal compiler settings.

#### A. `next.config.ts` Enhancements
Add the following to [`next.config.ts`](next.config.ts):
- **Compiler Optimization:** Enable `swcMinify: true` (default in newer Next.js, but explicit is better).
- **Bundle Analysis:** (Optional) Add `@next/bundle-analyzer` to identify remaining large chunks.

#### B. Tailwind CSS Purging
Verify that [`tailwind.config.ts`](tailwind.config.ts) `content` array is strictly limited to used directories to ensure the smallest possible CSS bundle. (Current config looks correct, but monitor for unused utility classes).

---

## 📈 Verification Checklist
- [ ] Run Lighthouse in Incognito mode.
- [ ] Check Network tab: `sprint-board.js` and `task-detail-modal.js` should be separate chunks loaded on demand.
- [ ] Verify that `unstable_cache` reduces the number of requests to Supabase in the server logs.
- [ ] Confirm TBT is below 200ms.
