"""
train_eval.py — U1 offline evaluation.

Pipeline:
  1. Load ml/data/labeled.csv (run dataset.py first).
  2. Stratified 80/20 train/test split (fixed random_state).
  3. Embed titles with the FROZEN multilingual sentence-transformer (embed.py).
  4. Fit LogisticRegression(class_weight="balanced") on TRAIN embeddings.
  5. Evaluate on the held-out TEST set:
        - macro-F1, per-class precision/recall/F1, confusion matrix.
  6. Run the regex baseline (baseline.py) on the SAME test set:
        - macro-F1, per-class. "unknown" predictions count as wrong (the
          baseline declined to predict) — this is the fair scoring described
          in the task: the baseline is never forced to guess.
  7. PL vs EN breakdown (using the `source` column).
  8. Save the classifier to ml/models/clf.joblib.

All metrics are PRINTED to stdout (captured into REPORT.md).
Honest framing: small, partly-synthetic N => CASE STUDY, not generalization.
"""

import os
import sys
import io

# force UTF-8 stdout so Polish prints + captured logs are clean on Windows
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    f1_score,
    classification_report,
    confusion_matrix,
)

import embed  # frozen encoder (sets HF cache env on import)
import baseline  # regex port

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_CSV = os.path.join(_HERE, "data", "labeled.csv")
MODEL_DIR = os.path.join(_HERE, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "clf.joblib")

CLASSES = ["research", "development", "outreach", "design", "marketing", "support", "ops"]
SEED = 42


def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def macro_f1_filtered(y_true, y_pred, labels):
    """Macro-F1 over the fixed label set (so 'unknown' preds count as wrong
    for every real class, but 'unknown' is NOT itself a scored class)."""
    return f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)


def text_confusion(y_true, y_pred, labels):
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    # markdown table
    w = max(len(l) for l in labels)
    header = "true\\pred".ljust(12) + "".join(l[:6].rjust(8) for l in labels)
    lines = [header]
    for i, l in enumerate(labels):
        row = l.ljust(12) + "".join(str(cm[i, j]).rjust(8) for j in range(len(labels)))
        lines.append(row)
    return "\n".join(lines), cm


def main():
    if not os.path.exists(DATA_CSV):
        print("ERROR: run dataset.py first to create", DATA_CSV)
        sys.exit(1)

    df = pd.read_csv(DATA_CSV, encoding="utf-8")
    df = df.dropna(subset=["text", "label"]).reset_index(drop=True)

    section("DATASET")
    print("total rows:", len(df))
    print("\nby class:")
    print(df["label"].value_counts().to_string())
    print("\nby source:")
    print(df["source"].value_counts().to_string())

    X_text = df["text"].tolist()
    y = df["label"].tolist()
    src = df["source"].tolist()

    # ---- stratified 80/20 split (carry source along for PL/EN breakdown) ----
    idx = np.arange(len(df))
    tr_idx, te_idx = train_test_split(
        idx, test_size=0.20, random_state=SEED, stratify=y
    )
    print(f"\ntrain={len(tr_idx)}  test={len(te_idx)}  (stratified, seed={SEED})")

    # ---- embed (frozen) ----
    section("EMBEDDING (frozen multilingual encoder)")
    print("model:", embed.MODEL_NAME)
    all_emb = embed.embed_texts(X_text)  # embed once, then index
    print("embedding matrix:", all_emb.shape)

    Xtr = all_emb[tr_idx]
    Xte = all_emb[te_idx]
    ytr = [y[i] for i in tr_idx]
    yte = [y[i] for i in te_idx]
    src_te = [src[i] for i in te_idx]
    text_te = [X_text[i] for i in te_idx]

    # ---- train LogisticRegression ----
    section("MODEL: LogisticRegression on frozen embeddings")
    clf = LogisticRegression(
        class_weight="balanced",
        max_iter=2000,
        C=10.0,
        random_state=SEED,
    )
    clf.fit(Xtr, ytr)
    y_model = clf.predict(Xte).tolist()

    model_macro = macro_f1_filtered(yte, y_model, CLASSES)
    print(f"\n>>> MODEL macro-F1 (test) = {model_macro:.4f}\n")
    print("per-class report (MODEL):")
    print(classification_report(yte, y_model, labels=CLASSES, zero_division=0, digits=3))

    cm_txt, _ = text_confusion(yte, y_model, CLASSES)
    print("confusion matrix (MODEL, rows=true, cols=pred):")
    print(cm_txt)

    # ---- regex baseline on SAME test set ----
    section("BASELINE: regex inferTaskType (same test set)")
    y_base = [baseline.predict(t) for t in text_te]
    n_unknown = sum(1 for p in y_base if p == "unknown")
    print(f"baseline 'unknown' (no-prediction) count: {n_unknown}/{len(y_base)} "
          f"({100*n_unknown/len(y_base):.1f}%)")

    base_macro = macro_f1_filtered(yte, y_base, CLASSES)
    print(f"\n>>> BASELINE macro-F1 (test) = {base_macro:.4f}\n")
    print("per-class report (BASELINE; 'unknown' counts as wrong):")
    # include 'unknown' as a possible pred label in the report for transparency
    report_labels = CLASSES + ["unknown"]
    print(classification_report(yte, y_base, labels=report_labels, zero_division=0, digits=3))

    cm_b_txt, _ = text_confusion(yte, y_base, report_labels)
    print("confusion matrix (BASELINE, rows=true, cols=pred):")
    print(cm_b_txt)

    # ---- head-to-head ----
    section("HEAD-TO-HEAD (same held-out test set)")
    print(f"MODEL    macro-F1 = {model_macro:.4f}")
    print(f"BASELINE macro-F1 = {base_macro:.4f}")
    delta = model_macro - base_macro
    print(f"DELTA (model - baseline) = {delta:+.4f}")
    if model_macro >= 0.70:
        verdict = "STRONG (>=0.70): reversal candidate."
    elif model_macro >= 0.65:
        verdict = "STRONG-ish (0.65-0.70): reversal candidate."
    elif model_macro >= 0.50:
        verdict = "MARGINAL (0.50-0.65)."
    else:
        verdict = "WEAK (<0.50): regex stays production."
    print("model verdict vs thresholds:", verdict)
    print("(NOTE: thresholds judge the MODEL's absolute macro-F1, per task spec.)")

    # ---- PL vs EN breakdown ----
    section("PL vs EN BREAKDOWN (test set)")
    def subset_macro(pred, want_sources):
        ii = [k for k, s in enumerate(src_te) if s in want_sources]
        if not ii:
            return None, 0, []
        yt = [yte[k] for k in ii]
        yp = [pred[k] for k in ii]
        # macro-F1 ONLY over classes actually PRESENT in this subset, so a
        # subset that only contains 3 of 7 classes is not unfairly penalised
        # with zeros for absent classes. This is the honest per-subset number.
        present = sorted(set(yt))
        return macro_f1_filtered(yt, yp, present), len(ii), present

    groups = {
        "synthetic_pl (Polish)": {"synthetic_pl"},
        "synthetic_en (English)": {"synthetic_en"},
        "hf_github_issues (English, real)": {"hf_github_issues"},
    }
    print("macro-F1 below is computed over the classes PRESENT in each subset")
    print("(HF source only covers development/support/ops).\n")
    print(f"{'group':40s} {'n':>5s} {'#cls':>5s} {'model_mF1':>10s} {'base_mF1':>10s}")
    for name, srcs in groups.items():
        m_f1, n, present = subset_macro(y_model, srcs)
        b_f1, _, _ = subset_macro(y_base, srcs)
        mm = f"{m_f1:.3f}" if m_f1 is not None else "  -  "
        bb = f"{b_f1:.3f}" if b_f1 is not None else "  -  "
        print(f"{name:40s} {n:>5d} {len(present):>5d} {mm:>10s} {bb:>10s}")

    # ---- save model ----
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(
        {"clf": clf, "classes": CLASSES, "encoder": embed.MODEL_NAME, "seed": SEED},
        MODEL_PATH,
    )
    section("ARTIFACT")
    print("saved classifier ->", MODEL_PATH)
    print("(encoder is frozen + downloaded on demand from HuggingFace, not bundled)")


if __name__ == "__main__":
    main()
