# U1 — ML Task-Type Classifier (offline evaluation)

Isolated research/ML workspace. **Not** part of the Next.js app. Production serving of U1
is **deferred**; this directory only produces an *offline* evaluation comparing a frozen
multilingual sentence-transformer + LogisticRegression against the existing regex baseline
(`inferTaskType` in `../lib/utils.ts`) on the 7 Compass `task_type` classes
(research, development, outreach, design, marketing, support, ops).

See `REPORT.md` for the measured results and the honest interpretation.

## Files
- `baseline.py` — faithful Python port of `inferTaskType` (same regex, same order, returns
  `"unknown"` where the TS version returns `null`).
- `embed.py` — loads the frozen encoder
  `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` and encodes titles.
- `dataset.py` — assembles `data/labeled.csv` (real HF GitHub issues mapped to Compass
  classes + semi-synthetic PL/EN titles covering all 7 classes).
- `train_eval.py` — stratified 80/20 split, embed, fit LogisticRegression, evaluate
  (macro-F1, per-class, confusion matrix) and run the regex baseline on the same test set.
- `data/labeled.csv` — the assembled eval set (`text,label,source`).
- `models/clf.joblib` — saved classifier head (tiny; encoder is downloaded on demand).
- `train_eval.log` — captured stdout of the measured run.
- `REPORT.md` — the report.

## Environment
The venv is already provisioned at `ml/.venv` (scikit-learn 1.9, sentence-transformers 5.6,
torch 2.12 CPU, datasets 5.0, pandas, numpy). The encoder caches inside the repo at
`ml/hf_cache/` (gitignored). The scripts set `HF_HOME` / `SENTENCE_TRANSFORMERS_HOME`
automatically before importing sentence-transformers — no manual env setup needed.

## Reproduce (Windows)
Run from inside the `ml/` directory.

```bash
# 1. sanity-check the baseline port
.venv/Scripts/python.exe baseline.py

# 2. build the labeled eval set -> data/labeled.csv  (needs internet for HF first time)
.venv/Scripts/python.exe dataset.py

# 3. embed + train + evaluate (downloads the encoder on first run; CPU is fine)
#    PYTHONUTF8=1 keeps Polish characters clean in stdout on Windows.
PYTHONUTF8=1 .venv/Scripts/python.exe train_eval.py
```

PowerShell equivalent for step 3:
```powershell
$env:PYTHONUTF8=1; .\.venv\Scripts\python.exe train_eval.py
```

Determinism: `random_state=42` for both the split and the classifier. The embedding model
is frozen, so re-running reproduces the same metrics (modulo tiny float noise).

## Notes / honesty
- `data/labeled.csv` is **partly semi-synthetic** and small. Results are a **case study**,
  not evidence of generalization. The **real** GitHub-issues subset is the trustworthy
  signal — see `REPORT.md` §5.
- The HF dataset (`khanmu2003/issue-classification`) is English-only and covers only 3 of
  the 7 classes; its license is **not stated** on the dataset page (to verify before reuse).
- No file outside `ml/` is touched. The Next.js app, DB, and production serving are unchanged.
