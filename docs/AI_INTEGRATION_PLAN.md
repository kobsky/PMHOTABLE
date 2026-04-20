# AI INTEGRATION PLAN — Hotable Compass
> Generated: 2026-04-15

---

## Overview

Three AI features planned for the thesis:

| Feature | Complexity | Data Available | Suggested Approach |
|---------|-----------|---------------|-------------------|
| Task Recommender (assignee) | MEDIUM | tasks + profiles | Rule-based + simple ML or Claude API |
| Workload Balancing | LOW-MEDIUM | tasks (status, assignee) | Rule-based heuristics first |
| Auto-Categorization | MEDIUM | task title + description | Claude API / local NLP |

**Recommendation:** Start with rule-based logic for Workload Balancing (fastest to ship, clearly demonstrable), then Assignee Recommender using Claude API (impressive for thesis), then Auto-Categorization as third feature.

---

## FEATURE 1: ASSIGNEE RECOMMENDER

### What it does
When creating a task, suggests which team member should be assigned based on:
- Past task patterns (who worked on similar tasks?)
- Current workload (who has capacity?)
- Project affinity (who is primary on this project?)
- Task type affinity (who usually takes bugs vs. features?)

### Where it lives in the UI

**Trigger point:** `components/compass/task-detail-modal.tsx` (or `quick-add-task.tsx`)
After user enters task title and selects project, show:
```
Suggested assignee: Ania Kowalska (85% match)
  ↳ based on: 12 similar tasks, low current WIP
[Assign Ania] [Assign Marek] [Assign Kasia] [Skip]
```

### Backend implementation

#### Option A: Rule-based scoring (no ML — good for thesis MVP)
```typescript
// app/actions/ai.ts
export async function getAssigneeRecommendation(
  taskTitle: string,
  projectId: string,
  taskType: TaskType
): Promise<{ userId: string; score: number; reason: string }[]>
```

**Algorithm:**
1. Fetch last 60 days of completed tasks
2. For each team member, calculate:
   - `projectScore` = % of their tasks that are in this project (0-10)
   - `typeScore` = % of their tasks of this task type (0-10)
   - `wipScore` = 10 - (current in_progress count * 3) — penalize for WIP
   - `totalScore` = (projectScore * 0.4) + (typeScore * 0.3) + (wipScore * 0.3)
3. Return sorted by totalScore with reason string

**Supabase queries needed:**
```sql
-- Historical task distribution per person
SELECT assignee_id, project_id, type, COUNT(*)
FROM tasks
WHERE status = 'done'
  AND created_at > NOW() - INTERVAL '60 days'
GROUP BY assignee_id, project_id, type;

-- Current WIP per person
SELECT assignee_id, COUNT(*)
FROM tasks
WHERE status = 'in_progress'
GROUP BY assignee_id;
```

#### Option B: Claude API (more impressive for thesis)
```typescript
// app/actions/ai.ts
import Anthropic from '@anthropic-ai/sdk';

export async function getAssigneeRecommendation(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  teamStats: TeamStats[]
): Promise<Recommendation[]>

// Sends to Claude: task context + team workload stats
// Claude returns ranked suggestions with reasoning
// Cache results — same task title → same suggestion
```

**Prompt structure:**
```
You are a PM assistant for a 3-person startup. 
Given this task and team context, recommend the best assignee.

Task: {title}
Description: {description}  
Project: {projectName}

Team members:
- Ania: {wipCount} active tasks, last 10 tasks: {taskTypes}, projects: {projectHistory}
- Marek: {wipCount} active tasks, last 10 tasks: {taskTypes}, projects: {projectHistory}
- Kasia: {wipCount} active tasks, last 10 tasks: {taskTypes}, projects: {projectHistory}

Return JSON: [{userId, name, score, reason}]
```

### Files to create/modify

| File | Change |
|------|--------|
| `app/actions/ai.ts` | NEW — AI server actions |
| `lib/supabase/types.ts` | Add `TeamStats`, `Recommendation` types |
| `components/compass/task-detail-modal.tsx` | Add recommendation display after title input |
| `components/compass/assignee-suggestions.tsx` | NEW — suggestion chips component |

### API key handling
```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```
Never expose this to client. Only call from server actions.

---

## FEATURE 2: WORKLOAD BALANCING

### What it does
On the Team Dashboard, analyzes current task distribution and suggests:
- "Ania has 5 in-progress tasks. Consider moving [Task X] to Marek who has 1."
- "Sprint is 60% done but Kasia has 0 completed tasks — check status."

### Where it lives in the UI

**Location:** `app/(dashboard)/team/page.tsx`
Add a new section below the workload grid:

```
⚡ AI Suggestions
───────────────────────────────────────────
• Ania is overloaded (5 tasks). Move "Write tests for auth" to Kasia? [Move] [Dismiss]
• Sprint ends in 3 days. 8 tasks still in "todo" — reassign to accelerate? [Show tasks]
```

### Backend implementation

```typescript
// app/actions/ai.ts
export async function getWorkloadSuggestions(
  cycleId: string
): Promise<WorkloadSuggestion[]>

interface WorkloadSuggestion {
  type: 'overload' | 'underload' | 'sprint_risk' | 'reassign';
  message: string;
  taskId?: string;   // task to move
  fromUserId?: string;
  toUserId?: string;
  priority: 'high' | 'medium' | 'low';
}
```

**Rules engine (no ML needed):**

```typescript
const suggestions: WorkloadSuggestion[] = [];

// Rule 1: WIP overload
for (const member of team) {
  if (member.inProgressCount > 3) {
    // find their lowest-priority in-progress task
    // find team member with lowest WIP
    suggestions.push({ type: 'reassign', ... });
  }
}

// Rule 2: Sprint at risk
const daysLeft = differenceInDays(cycle.end_date, today);
const incompleteTasks = tasks.filter(t => t.status !== 'done').length;
if (daysLeft < 3 && incompleteTasks > team.length * 2) {
  suggestions.push({ type: 'sprint_risk', ... });
}

// Rule 3: Idle team member
for (const member of team) {
  if (member.inProgressCount === 0 && incompleteTasks > 0) {
    suggestions.push({ type: 'underload', ... });
  }
}
```

### Files to create/modify

| File | Change |
|------|--------|
| `app/actions/ai.ts` | Add `getWorkloadSuggestions()` |
| `app/(dashboard)/team/page.tsx` | Add suggestions section below grid |
| `components/compass/workload-suggestions.tsx` | NEW — suggestion list with action buttons |

---

## FEATURE 3: AUTO-CATEGORIZATION (Task Type)

### What it does
When user creates a task, automatically suggests the `type` (feature, bug, chore, research, design, marketing) based on the task title and description.

### Where it lives in the UI

**Location:** `components/compass/quick-add-task.tsx` and `task-detail-modal.tsx`

```
Title: [Fix login button not responding on mobile    ]
                                               ↓ auto-detected
Type: [Bug ▼]  ← pre-filled, user can override
```

### Backend implementation

#### Option A: Keyword heuristics (fast, no API cost)
```typescript
// lib/utils.ts
export function inferTaskType(title: string, description?: string): TaskType {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  const rules: [RegExp, TaskType][] = [
    [/\b(fix|bug|error|crash|broken|issue|problem|fails?)\b/, 'bug'],
    [/\b(design|ui|ux|mockup|figma|visual|layout|style)\b/, 'design'],
    [/\b(research|investigate|explore|analyse?|study|spike)\b/, 'research'],
    [/\b(refactor|cleanup|chore|update deps|migrate|lint)\b/, 'chore'],
    [/\b(post|campaign|content|social|seo|newsletter)\b/, 'marketing'],
  ];
  
  for (const [regex, type] of rules) {
    if (regex.test(text)) return type;
  }
  return 'feature'; // default
}
```

#### Option B: Claude API (higher accuracy)
```typescript
export async function categorizeTask(
  title: string,
  description?: string
): Promise<{ type: TaskType; confidence: number }>
```

**Prompt:**
```
Classify this PM task into one category: feature | bug | chore | research | design | marketing

Task: {title}
Description: {description}

Return JSON: {"type": "bug", "confidence": 0.92}
```

**When to call:** Debounced — 800ms after user stops typing the title.

### Files to create/modify

| File | Change |
|------|--------|
| `lib/utils.ts` | Add `inferTaskType()` for heuristic version |
| `app/actions/ai.ts` | Add `categorizeTask()` for Claude version |
| `components/compass/quick-add-task.tsx` | Auto-populate type field |
| `components/compass/task-detail-modal.tsx` | Auto-populate type on title change |

---

## IMPLEMENTATION ARCHITECTURE

### New file: `app/actions/ai.ts`

```typescript
'use server';

import Anthropic from '@anthropic-ai/sdk';
import { getAuthenticatedClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// All three AI features live here
export async function getAssigneeRecommendation(...) {}
export async function getWorkloadSuggestions(...) {}
export async function categorizeTask(...) {}
```

### New component: `components/compass/ai-badge.tsx`

Reusable "AI suggested" badge to mark AI-generated recommendations:
```tsx
<span className="compass-badge-accent font-mono text-xs">
  ✦ AI
</span>
```

---

## DATA REQUIREMENTS FOR AI

| Feature | Data Needed | Minimum Records for Good Results |
|---------|------------|----------------------------------|
| Assignee Recommender | tasks (completed) + profiles | 20+ tasks across team |
| Workload Balancing | tasks (active, current cycle) | Works with 0 historical data |
| Auto-Categorization | task titles | Works day 1 (keyword-based) |

**For thesis demo:** Workload Balancing and Auto-Categorization work immediately. Assignee Recommender needs seeded historical tasks (use `mock-data.ts` as seed basis).

---

## THESIS-RELEVANT METRICS TO TRACK

For each AI feature, track:
1. **Acceptance rate** — did user accept the AI suggestion? (add `ai_suggested: boolean` and `ai_accepted: boolean` to tasks)
2. **Override rate** — user changed the AI-suggested type/assignee
3. **Time saved** — compare task creation time with/without suggestions

These can be logged to a simple `ai_feedback` table:
```sql
CREATE TABLE ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL, -- 'assignee', 'categorize', 'workload'
  task_id UUID REFERENCES tasks(id),
  suggestion JSONB,
  accepted BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## ENVIRONMENT SETUP FOR AI

```bash
# .env.local additions for AI features
ANTHROPIC_API_KEY=sk-ant-...

# Optional: enable/disable each feature
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_AI_ASSIGNEE_RECOMMENDER=true
NEXT_PUBLIC_AI_AUTO_CATEGORIZE=true
NEXT_PUBLIC_AI_WORKLOAD_BALANCING=true
```

---

## RECOMMENDED IMPLEMENTATION ORDER

1. **Week 1:** Auto-Categorization (keyword heuristics) — easy win, zero API cost, visible immediately in task creation
2. **Week 2:** Workload Balancing (rule-based) — high business value, no ML needed, goes in Team view
3. **Week 3-4:** Assignee Recommender (Claude API) — showcase piece for thesis, requires historical data
4. **Week 5:** `ai_feedback` table + acceptance rate tracking
5. **Week 6:** Thesis evaluation metrics, writeup
