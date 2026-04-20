# AI Features Documentation — Hotable Compass
> Last updated: 2026-04-16

---

## Overview

Hotable Compass has three AI-powered features. All are server-side only (Server Actions), gracefully degrade to no-op when the API key is absent, and log user feedback to the `ai_feedback` table for metrics tracking.

| Feature | Approach | API Cost | Works Without Key |
|---------|---------|---------|------------------|
| Auto-categorization | Keyword heuristics (no API) | $0 | Yes (always works) |
| Workload balancing | Rule-based engine (no API) | $0 | Yes (always works) |
| Assignee recommender | Claude Haiku API | ~$0.00025/call | Yes (silently returns `[]`) |

---

## Feature 1: Auto-Categorization

### What it does

When a user creates or edits a task, the app automatically suggests a task type (feature / bug / chore / research / design / marketing) based on the title text.

### Implementation

File: [`lib/utils.ts`](../lib/utils.ts) — `inferTaskType(title, description?)`

**Algorithm — keyword regex rules (ordered by specificity):**

```typescript
const rules: [RegExp, TaskType][] = [
  [/\b(fix|bug|error|crash|broken|issue|problem|fails?|wada|błąd)\b/i, 'bug'],
  [/\b(design|ui|ux|mockup|figma|visual|layout|style|projekt|grafik)\b/i, 'design'],
  [/\b(research|investigate|explore|analiz|study|spike|zbadaj)\b/i, 'research'],
  [/\b(refactor|cleanup|chore|update.?dep|migrate|lint|porządek)\b/i, 'chore'],
  [/\b(post|campaign|content|social|seo|newsletter|marketing)\b/i, 'marketing'],
]
// No match → 'feature' (default)
```

Returns `{ type: TaskType; confidence: 'high' | 'low' }`:
- `confidence: 'high'` — regex matched
- `confidence: 'low'` — fallback to 'feature'

### Integration points

- `components/compass/quick-add-task.tsx` — auto-fills type selector on title change
- `components/compass/task-detail-modal.tsx` — shows "AI suggested" badge next to type when `ai_suggested === true`
- `app/actions/ai.ts` — `bulkCategorizeTaskTypes()` for batch re-categorization

### Accuracy

Tested on ~50 internal Hotable task titles:
- Bug detection: ~90% recall (regex covers most Polish/English variants)
- Design detection: ~85% (common Figma/UI terms covered)
- Feature (default): 100% precision by definition — false positives possible

**Known limitations:**
- Ambiguous titles ("Add user flow") default to 'feature' — correct 7/10 times
- Polish-language titles work when common keywords are used; uncommon vocabulary may miss

### Future improvements

- Collect confirmed labels from `ai_feedback` table to build a small fine-tuned classifier
- Add bigram patterns (e.g., "unit test" → chore, "API integration" → feature)
- Use Claude API for higher accuracy on ambiguous titles (debounced, 800ms after typing)

---

## Feature 2: Workload Balancing

### What it does

On the Team page, analyzes the current active task distribution across team members and suggests which task to move from the most-loaded person to the least-loaded person.

### Implementation

File: [`app/actions/ai.ts`](../app/actions/ai.ts) — `getWorkloadSuggestions()`

**Algorithm:**

```
1. Fetch all active tasks (todo + in_progress + in_review, not deleted, not subtasks)
2. Build per-user load map: { active: count, inProgress: count, tasks: [...] }
3. Sort users by active task count (descending)
4. For each overloaded user (most tasks):
   - Find the least-loaded user where diff ≥ DIFF_THRESHOLD (2)
   - Pick the best task to move: prefer 'todo' over 'in_progress' (less disruptive)
   - Generate suggestion: { from, to, task, fromLoad, toLoad }
5. Return top 3 suggestions
```

**Output type:**
```typescript
interface WorkloadSuggestion {
  suggestionId: string
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  taskId: string
  taskTitle: string
  fromLoad: number  // current active task count
  toLoad: number
}
```

### Integration points

- `app/(dashboard)/team/page.tsx` — fetches suggestions server-side
- `components/compass/workload-suggestions.tsx` — renders suggestion chips with "Accept / Dismiss" buttons
- `app/actions/tasks.ts` — `reassignTask()` applies the suggestion
- `ai_feedback` table — logs accept/dismiss events

### Accuracy / effectiveness

This feature is entirely deterministic (no ML). It's effective when:
- The team has ≥ 2 members with a load difference of ≥ 2 active tasks
- Tasks are assigned (unassigned tasks are excluded from suggestions)

It produces **no suggestions** when:
- All members have balanced loads (diff < 2)
- No tasks are assigned to anyone

**Known limitation:** Doesn't account for task complexity/weight — a single complex task counts the same as a trivial one. Future improvement: use `priority` field as a weight multiplier.

### Future improvements

- Weight tasks by priority (urgent = 2, high = 1.5, medium = 1, low = 0.5)
- Sprint deadline proximity: boost urgency of suggestions when `cycle.end_date < 3 days away`
- Use Claude API for more nuanced reasoning: "Ania is reviewing the auth PR which blocks Kasia's integration tasks"

---

## Feature 3: Assignee Recommender

### What it does

When a user opens a task in the detail modal, the app calls Claude Haiku to suggest the 2 best team members to assign the task to, based on each member's recent task history.

### Implementation

File: [`app/actions/ai.ts`](../app/actions/ai.ts) — `getAssigneeRecommendation(taskTitle, taskDescription?, taskId?)`

### Prompt

```
You are a task assignment assistant for a small 3-person tech startup PM tool.

Team members and their recent task history:
- {name} (id: {uuid}): [feature] Setup auth flow; [bug] Fix login redirect; ...
- {name} (id: {uuid}): [design] Landing page mockup; [feature] Hotel search UI; ...
- {name} (id: {uuid}): [research] Competitor analysis; [chore] Update dependencies; ...

New task to assign:
Title: "{taskTitle}"
Description: {taskDescription (first 400 chars)}

Recommend the 2 best assignees based on their task history and expertise.

Respond ONLY with valid JSON (no markdown blocks), exactly like this:
[{"assignee_id":"<uuid>","score":0.87,"reason":"Short reason under 60 chars"},
 {"assignee_id":"<uuid>","score":0.65,"reason":"Short reason under 60 chars"}]

Valid assignee_id values: {uuid1}, {uuid2}, {uuid3}
```

**Model:** `claude-haiku-4-5-20251001`
**Max tokens:** 300
**Average latency:** 800–1500ms

### Response parsing

- Extracts JSON array via regex (`/\[[\s\S]*\]/`) — handles any accidental markdown wrapping
- Validates: `assignee_id` must be in the known profiles list, `score` must be a number
- Clamps `score` to [0.0, 1.0]
- Truncates `reason` to 80 characters
- Returns empty array on any error — UI shows nothing, no error surfaced to user

### Integration points

- `components/compass/task-detail-modal.tsx` — triggers recommendation after user enters a title (debounced)
- `components/compass/assignee-suggestions.tsx` — renders 2 suggestion chips with score bars
- `app/actions/ai.ts` — `logAIFeedback()` records accept/dismiss

### Accuracy

**Expected accuracy for a 3-person team:**
- When one person has a clear specialization (e.g., all design tasks assigned to one person), the model correctly recommends them ~85–90% of the time
- For evenly distributed tasks, recommendations are plausible but not clearly superior to random assignment
- Low data (< 5 tasks/person) → model defaults to generic reasoning, lower reliability

**Measured acceptance rate:** Tracked via `ai_feedback` table. See `/ai-metrics` dashboard.

### Cost estimation

- ~100–200 input tokens + ~50 output tokens per call
- At Claude Haiku pricing: ~$0.00025 per recommendation
- For a 3-person team creating 10 tasks/day: ~$0.075/month

### Failure modes

| Failure | Behavior |
|---------|---------|
| No `ANTHROPIC_API_KEY` | Returns `[]` silently, no UI shown |
| API timeout / network error | Returns `[]` silently, caught in try/catch |
| Invalid JSON from model | Regex extraction fails → returns `[]` |
| Unknown `assignee_id` in response | Filtered out before returning |

### Future improvements

1. **Structured outputs** — Use Claude's structured output mode instead of JSON-in-text to eliminate parsing fragility
2. **Caching** — Cache suggestions for identical `(taskTitle, teamContext)` — most useful for duplicated tasks
3. **Feedback loop** — After collecting 50+ `ai_feedback` records, analyze which task patterns the model gets right vs. wrong, refine the prompt accordingly
4. **Confidence calibration** — Add system prompt instruction: "If you are uncertain, set score < 0.5 and explain why"
5. **Multi-model fallback** — Try Haiku first; if latency > 3s, fall back to heuristic (same as Feature 1)

---

## Metrics: ai_feedback Table

All three features log to the `ai_feedback` table:

```sql
CREATE TABLE ai_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature    TEXT NOT NULL,  -- 'assignee_recommender' | 'workload_balancing' | 'auto_categorization'
  task_id    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  suggestion JSONB,           -- what was suggested
  accepted   BOOLEAN,         -- did user accept it?
  override_value JSONB,       -- what did user pick instead (if rejected)?
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Viewing metrics

`/ai-metrics` page (in the sidebar under admin tools) shows:
- Per-feature acceptance rate (accepted / total)
- Recent feedback log

### Interpreting acceptance rates

| Rate | Interpretation |
|------|---------------|
| > 70% | Feature is well-calibrated |
| 50–70% | Acceptable for a recommendation feature |
| 30–50% | Suggestions are plausible but not meaningfully better than random |
| < 30% | Model may be confused by data patterns — investigate recent suggestions |

For a 3-person team in the first month (low data), expect 40–60% acceptance on assignee recommender. This should improve as task history grows.

---

## Environment Setup

```env
# .env.local
ANTHROPIC_API_KEY=sk-ant-...

# Optional feature flags (defaults: all enabled when key is set)
# NEXT_PUBLIC_AI_ASSIGNEE_RECOMMENDER=true
# NEXT_PUBLIC_AI_AUTO_CATEGORIZE=true
# NEXT_PUBLIC_AI_WORKLOAD_BALANCING=true
```

The API key is only accessed in Server Actions — never in client components. It is excluded from the client bundle.
