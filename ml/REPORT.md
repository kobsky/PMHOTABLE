# U1 — ML Task-Type Classifier: Offline Evaluation Report

> **Scope:** Offline evaluation only. Production serving of U1 is **DEFERRED** by an
> explicit project decision. The Next.js app and its production inference path were
> **not** touched. Everything here lives under `ml/`.
>
> **Run date:** 2026-06-30. All numbers below are from one **actual measured run**
> of `train_eval.py` (captured in `ml/train_eval.log`), `random_state=42`. Nothing
> is fabricated.

---

## 1. What U1 is (and what it is not)

U1 is the **only real machine-learning component** in Hotable Compass. It classifies a
task **title** into one of the 7 Compass `task_type` classes:

```
research, development, outreach, design, marketing, support, ops
```

(class set defined in `supabase/migrations/015_task_type_refactor.sql`)

Every other "AI" feature in the product (assignee recommender, workload balancing,
auto-categorization in `lib/utils.ts`) is **rule-based / decision-support**, not a
trained model. U1 is the single place where a model is fit to data and evaluated with
held-out metrics.

**Approach:** a **frozen** multilingual sentence-transformer produces embeddings; a
**LogisticRegression** head is trained on top. The encoder is never fine-tuned, which
keeps the trained artifact tiny (12 KB `clf.joblib`) and CPU-friendly.

- Encoder: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  (384-dim, 50 languages — so Polish and English share one embedding space).
- Head: `LogisticRegression(class_weight="balanced", C=10, max_iter=2000)`.
- Metric: **macro-F1** (treats all 7 classes equally despite imbalance).

---

## 2. Dataset (honest composition)

There is **no large real labeled Compass dataset**. Production `supabase/seed_history.sql`
contains only ~12 templated synthetic titles. So the eval set was **assembled** and is
written to `ml/data/labeled.csv` (`text,label,source`). Build with `python dataset.py`.

**Total: 1100 rows.**

### By class
| class       | n   |
|-------------|-----|
| development | 220 |
| support     | 220 |
| ops         | 220 |
| marketing   | 140 |
| research    | 100 |
| outreach    | 100 |
| design      | 100 |

### By source
| source             | n   | language | nature         |
|--------------------|-----|----------|----------------|
| `synthetic_en`     | 370 | English  | semi-synthetic |
| `synthetic_pl`     | 370 | Polish   | semi-synthetic |
| `hf_github_issues` | 360 | English  | **real**       |

### Source A — public HuggingFace dataset (real data)
`khanmu2003/issue-classification` — 560,019 GitHub issues, columns `issue title` +
`labels`, 8 categorical labels, English only, predominantly freeCodeCamp-family repos.
Auto-converted to Parquet, 285 MB. **License: not stated on the dataset page → to verify
before any redistribution.** We loaded it via the `datasets` library (HF reachable),
subsampled a balanced cap (120/class after mapping), normalised whitespace, and kept
titles 6–120 chars.

**Label mapping to Compass — imperfect by construction.** A GitHub-issue taxonomy
overlaps only **3 of our 7** classes and carries process labels that are not task types:

| GitHub label                                         | Compass class | rationale                                  |
|------------------------------------------------------|---------------|--------------------------------------------|
| Bug                                                  | support       | matches the regex baseline's `bug→support` |
| Enhancement                                          | development   | new capability                             |
| Documentation                                        | ops           | baseline maps docs/readme → ops            |
| Question                                             | support       | user asking for help                       |
| Duplicate / Invalid / Good First Issue / Help Wanted | **DROPPED**   | process labels, not task **types**         |

=> This real source contributes **only** `{development, support, ops}` and **zero** Polish,
research, outreach, design, marketing. The mapping itself injects label noise (e.g.
`Question→support` and `Documentation→ops` are debatable).

### Source B — semi-synthetic PL + EN (covers all 7 classes)
Hand-written templates x slot fillers, authored **for this evaluation** (clearly marked
semi-synthetic). This is the **only** source of research/outreach/design/marketing and the
**only** source of Polish. Titles realistically code-switch (e.g. *"Implement tryb ciemny"*,
*"Add filtr backlogu"*) as a bilingual team's titles do. 370 PL + 370 EN, deduplicated.

> **Honesty caveat (critical):** the synthetic titles are **lexically separable by design**
> (each template embeds class-signalling words). They are *easy*. They inflate the headline
> macro-F1. The **real** GitHub slice is the trustworthy signal for generalization — see §5.

---

## 3. Headline result (held-out test set, n=220, stratified 80/20)

| system                                | macro-F1 (test) |
|---------------------------------------|-----------------|
| **ML model** (frozen embeds + LogReg) | **0.8975**      |
| **Regex baseline** (`inferTaskType`)  | **0.7621**      |
| **delta (model − baseline)**          | **+0.1354**     |

Baseline declined to predict (returned `null`/"unknown", scored as wrong) on
**49/220 = 22.3%** of test titles — that is the main reason it trails the model.

**Verdict vs reversal thresholds:** the model's absolute macro-F1 is **0.8975 >= 0.70 →
"STRONG" / reversal candidate.** BUT this headline is **inflated by the easy synthetic
majority of the test set** and must be read together with §5. The honest production-relevant
number on real data is ~0.58 (marginal), not 0.90.

---

## 4. Per-class results (held-out test set)

### Model (`LogisticRegression` on frozen embeddings)
| class       | precision | recall | F1    | support |
|-------------|-----------|--------|-------|---------|
| research    | 1.000     | 1.000  | 1.000 | 20      |
| development | 0.821     | 0.727  | 0.771 | 44      |
| outreach    | 1.000     | 1.000  | 1.000 | 20      |
| design      | 0.909     | 1.000  | 0.952 | 20      |
| marketing   | 1.000     | 0.964  | 0.982 | 28      |
| support     | 0.787     | 0.841  | 0.813 | 44      |
| ops         | 0.756     | 0.773  | 0.764 | 44      |
| **macro avg** | **0.896** | **0.901** | **0.898** | 220 |
| accuracy    |           |        | 0.864 | 220     |

The synthetic-only classes (research, outreach, design, marketing) score ~0.95–1.00
(easy). The three classes that include **real** GitHub data (development, support, ops)
are the weakest (0.76–0.81) — they carry all the real-world difficulty and the mapping noise.

### Regex baseline (`inferTaskType`; "unknown" = wrong)
| class       | precision | recall | F1    | support |
|-------------|-----------|--------|-------|---------|
| research    | 0.944     | 0.850  | 0.895 | 20      |
| development | 0.714     | 0.455  | 0.556 | 44      |
| outreach    | 1.000     | 0.900  | 0.947 | 20      |
| design      | 0.867     | 0.650  | 0.743 | 20      |
| marketing   | 1.000     | 0.964  | 0.982 | 28      |
| support     | 0.674     | 0.659  | 0.667 | 44      |
| ops         | 0.818     | 0.409  | 0.545 | 44      |
| **macro avg (7 cls)** | **0.752** | **0.611** | **0.667** | 220 |
| accuracy    |           |        | 0.645 | 220     |

The baseline is competitive on the keyword-rich synthetic classes (marketing 0.982,
outreach 0.947) but its **recall collapses** on development (0.455) and ops (0.409):
real titles rarely contain its trigger words, so it returns "unknown".

> macro-F1 in §3 (0.7621) is computed over the 7 real classes; the per-class table above
> additionally lists "unknown" only for transparency, which is why the macro avg printed by
> sklearn over 8 rows (0.667) differs from the 7-class macro-F1 of 0.7621.

---

## 5. PL vs EN breakdown — the result that matters

Macro-F1 computed **only over the classes present in each subset** (the HF source has just
3 of 7), so subsets are not unfairly penalised for absent classes.

| subset                              | n  | #classes | model mF1 | baseline mF1 |
|-------------------------------------|----|----------|-----------|--------------|
| `synthetic_pl` (Polish)             | 76 | 7        | **1.000** | 0.834        |
| `synthetic_en` (English)            | 78 | 7        | **0.972** | **0.992**    |
| `hf_github_issues` (English, real)  | 66 | 3        | **0.581** | **0.139**    |

**Three things this table tells the thesis:**

1. **Multilingual embeddings handle Polish.** On synthetic Polish the model is perfect
   (1.000) and clearly beats regex (0.834). The regex baseline was written with mostly
   English keyword stems, so it is weaker on PL.
2. **On clean English synthetic data, regex slightly *wins* (0.992 vs 0.972).** When the
   keyword is literally present, the hand-tuned regex is hard to beat. This is an honest
   point *against* over-claiming the model.
3. **On REAL data the picture flips and humbles both systems:** the model scores **0.581**
   and the regex **0.139**. The model generalizes to messy, keyword-free titles far better
   (~4x), but **0.58 is only "marginal"** in absolute terms. The regex baseline essentially
   fails on real titles (22% "unknown" overall; on the real slice it predicts the wrong
   class or nothing most of the time).

> **Bottom line on honesty:** the **0.90 headline is inflated by easy synthetic data.** The
> production-relevant number — performance on real, unseen issue titles — is **~0.58 for the
> model vs ~0.14 for regex.** The model is the better generalizer by a wide margin, but its
> absolute real-world accuracy is **marginal, not strong.**

---

## 6. Confusion matrices (held-out test set)

### Model (rows = true, cols = pred)
```
true\pred    resear develo outrea design market suppor    ops
research         20      0      0      0      0      0      0
development       0     32      0      0      0      4      8
outreach          0      0     20      0      0      0      0
design            0      0      0     20      0      0      0
marketing         0      1      0      0     27      0      0
support           0      2      0      2      0     37      3
ops               0      4      0      0      0      6     34
```
The only meaningful confusion is the **development / support / ops** triangle — exactly
the three classes that contain real GitHub data with noisy mapping (e.g. a "fix typo in
docs" issue is legitimately ambiguous between support and ops). The four synthetic-only
classes are essentially never confused.

### Regex baseline (rows = true, cols = pred; note the "unknow" column)
```
true\pred    resear develo outrea design market suppor    ops unknow
research         17      0      0      0      0      0      0      3
development       0     20      0      0      0     10      3     11
outreach          0      0     18      0      0      0      0      2
design            0      0      0     13      0      0      0      7
marketing         0      0      0      1     27      0      0      0
support           1      1      0      0      0     29      1     12
ops               0      7      0      1      0      4     18     14
```
The heavy "unknow" column (49 total) is the baseline's structural weakness: it abstains on
real titles whose vocabulary it was not authored for. Note also ops to development (7): the
baseline's `development` rule fires on generic verbs ("add", "update"), stealing ops cases.

---

## 7. Verdict

- **Against the spec's reversal thresholds (judging the model's absolute macro-F1):**
  the **overall** 0.8975 reads as **STRONG (>=0.70)**. Taken at face value, U1 would be a
  reversal candidate.
- **But the honest production read is more cautious.** That 0.90 is **driven by easy
  semi-synthetic data**. On the only **real, unseen** slice we have, the model scores
  **0.581 — "marginal" (0.50–0.65)** — while still crushing the regex baseline (0.139)
  on that same slice.
- **Recommendation:** treat the model as a **promising but not-yet-proven** replacement.
  Because production serving is **deferred** anyway, the regex baseline stays in production
  for now. Before any reversal, U1 must be re-evaluated on **real labeled Compass titles**
  (not synthetic), which do not yet exist in sufficient quantity.

> **N is small and partly synthetic => this is a CASE STUDY, not evidence of generalization.**
> Headline metrics from a synthetic-heavy set overstate real performance. The real-data
> subset (n=66, 3 classes) is the trustworthy — and sobering — signal.

---

## 8. Deferred production integration (how adoption would be measured later)

When/if U1 is promoted to production (currently **deferred**), predictions should be logged
to the existing `ai_feedback` table (`supabase/migrations/005_ai_feedback.sql`) under a
**distinct feature key**, so its adoption is measurable and clearly separated from the
rule-based features:

```
feature        = 'task_type_classifier_ml'   -- NEW key, distinct from the rule-based
                                             -- 'auto_categorization' value
task_id        = <the created task's id>
suggestion     = { "type": "<predicted_class>",
                   "confidence": <max softmax prob>,
                   "source": "u1_logreg_minilm" }
accepted       = <true if the user kept the suggested type>
override_value = { "type": "<class the user actually chose>" }  -- when overridden
```

> The table's current `CHECK` constraint only allows
> `('auto_categorization','assignee_recommender','workload_balancing')`. Adding
> `'task_type_classifier_ml'` requires a **new migration** to widen that constraint —
> **out of scope tonight** (no app/DB changes were made), but noted for the future.

Tracking acceptance rate per `feature` then yields the real-world adoption metric the
offline macro-F1 only approximates — and would distinguish the **one true ML feature**
(U1) from the rule-based decision-support features.

---

## 9. Reproducibility & artifacts
- Build data: `python dataset.py` -> `ml/data/labeled.csv` (1100 rows).
- Train + evaluate: `python train_eval.py` -> prints all metrics; saves `ml/models/clf.joblib`.
- Full captured stdout of the measured run: `ml/train_eval.log`.
- Encoder cache (gitignored, ~1.6 GB): `ml/hf_cache/`.
- See `ml/README.md` for exact commands using `ml/.venv`.

## 10. Citations (verified)
- **Sentence-BERT / sentence-transformers** — Reimers, N. & Gurevych, I. (2019).
  *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.* EMNLP 2019.
  arXiv:1908.10084 — https://arxiv.org/abs/1908.10084 (verified on the model card).
- **Encoder model card** —
  https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  (384-dim, 50 languages — verified).
- **Issue dataset** — `khanmu2003/issue-classification`,
  https://huggingface.co/datasets/khanmu2003/issue-classification
  (560,019 rows; columns `issue title`,`labels`,`body`,`repository`; 8 labels; mostly
  freeCodeCamp-family repos; **license not stated on page -> to verify**).
- **scikit-learn** LogisticRegression / metrics — Pedregosa et al. (2011), *Scikit-learn:
  Machine Learning in Python*, JMLR 12:2825-2830 — https://jmlr.org/papers/v12/pedregosa11a.html
  (standard library citation; to verify exact pagination if cited formally).
