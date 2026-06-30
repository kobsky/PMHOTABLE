"""
dataset.py — Assemble the labeled evaluation set for U1.

Writes ml/data/labeled.csv with columns: text,label,source

The 7 Compass task_type classes:
    research, development, outreach, design, marketing, support, ops

Two sources, both DOCUMENTED with their caveats:

(A) PUBLIC HuggingFace dataset  -> source tag "hf_github_issues"
    khanmu2003/issue-classification  (~560k GitHub issues, EN only)
    columns: 'issue title', 'labels'
    Label mapping to Compass (imperfect — a GitHub-issue taxonomy only
    overlaps 3 of our 7 classes, and is English-only):
        Bug           -> support       (matches baseline's bug->support)
        Enhancement   -> development
        Documentation -> ops           (baseline maps docs/readme -> ops)
        Question      -> support        (user asking for help)
        Duplicate / Invalid / Good First Issue / Help Wanted -> DROPPED
            (these are PROCESS labels, not task TYPES)
    => This source can only populate {support, development, ops} and adds
       ZERO coverage for research / outreach / design / marketing, and ZERO
       Polish. We subsample it (balanced cap per class) to stay CPU-friendly
       and to avoid swamping the smaller classes.

(B) SEMI-SYNTHETIC PL+EN titles  -> source tag "synthetic_pl_en"
    Hand-written templates x slot fillers, in BOTH Polish and English,
    covering ALL 7 classes. Explicitly marked semi-synthetic: these are
    realistic Compass-style task titles but were authored for this eval,
    NOT drawn from real production data (production has only ~12 templated
    seed rows). This is the ONLY source of research/outreach/design/
    marketing and the ONLY source of Polish.

Honesty note: N is small and partly synthetic => this is a CASE STUDY, not a
basis for generalization. See REPORT.md.
"""

import os
import csv
import random
from collections import Counter

_HERE = os.path.dirname(os.path.abspath(__file__))
_CACHE = os.path.join(_HERE, "hf_cache")
os.environ.setdefault("HF_HOME", _CACHE)
os.environ.setdefault("HF_DATASETS_CACHE", os.path.join(_CACHE, "datasets"))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

DATA_DIR = os.path.join(_HERE, "data")
OUT_CSV = os.path.join(DATA_DIR, "labeled.csv")

CLASSES = ["research", "development", "outreach", "design", "marketing", "support", "ops"]

SEED = 42
random.seed(SEED)

# Cap per (class) drawn from the HF source so it doesn't swamp synthetic data.
HF_CAP_PER_CLASS = 120

HF_LABEL_MAP = {
    "Bug": "support",
    "Enhancement": "development",
    "Documentation": "ops",
    "Question": "support",
}
HF_DROP = {"Duplicate", "Invalid", "Good First Issue", "Help Wanted"}


# ---------------------------------------------------------------------------
# (A) HuggingFace public dataset
# ---------------------------------------------------------------------------
def load_hf_rows():
    """Return list of (text,label,'hf_github_issues') or [] if unavailable."""
    try:
        from datasets import load_dataset
    except Exception as e:
        print("[dataset] datasets import failed:", repr(e)[:200])
        return []

    try:
        print("[dataset] loading khanmu2003/issue-classification ...")
        ds = load_dataset("khanmu2003/issue-classification", split="train")
    except Exception as e:
        print("[dataset] HF load FAILED -> falling back to synthetic only:", repr(e)[:300])
        return []

    titles = ds["issue title"]
    labels = ds["labels"]

    buckets = {c: [] for c in set(HF_LABEL_MAP.values())}
    seen = set()
    # iterate in a shuffled order so we don't only take the first repo's issues
    idx = list(range(len(titles)))
    random.shuffle(idx)
    for i in idx:
        raw = labels[i]
        if raw is None or raw in HF_DROP:
            continue
        compass = HF_LABEL_MAP.get(raw)
        if compass is None:
            continue
        if len(buckets[compass]) >= HF_CAP_PER_CLASS:
            if all(len(buckets[c]) >= HF_CAP_PER_CLASS for c in buckets):
                break
            continue
        title = (titles[i] or "").strip()
        # normalise whitespace; drop junk / too short / too long
        title = " ".join(title.split())
        if len(title) < 6 or len(title) > 120:
            continue
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        buckets[compass].append(title)

    rows = []
    for compass, items in buckets.items():
        for t in items:
            rows.append((t, compass, "hf_github_issues"))
    print("[dataset] HF rows by class:", Counter(r[1] for r in rows))
    return rows


# ---------------------------------------------------------------------------
# (B) Semi-synthetic PL + EN templates  (covers ALL 7 classes)
# ---------------------------------------------------------------------------
# Each entry: (template_with_{slot}, language). Slots filled from SLOTS.
SLOTS = {
    "feature": ["onboarding wizard", "kreator onboardingu", "dashboard KPI", "panel KPI",
                "eksport CSV", "CSV export", "powiadomienia email", "email digest",
                "filtr backlogu", "backlog filter", "tryb ciemny", "dark mode",
                "wyszukiwarkę zadań", "task search", "widok Gantt", "Gantt view"],
    "area": ["logowania", "login", "autoryzacji", "auth flow", "paginacji", "pagination",
             "realtime", "sprint board", "tablicy sprintu", "formularza", "the form",
             "kalendarza", "the calendar", "edytora", "the editor"],
    "topic": ["konkurencji", "competitor pricing", "third-party APIs", "API dostawców",
              "rynku hotelowego", "the hotel market", "narzędzi PM", "PM tools",
              "wydajności", "performance", "bezpieczeństwa", "security posture",
              "frameworka", "the framework", "modelu cenowego", "the pricing model"],
    "asset": ["kartę zadania", "task card", "landing page", "stronę docelową",
              "logo", "system ikon", "icon set", "paletę kolorów", "color palette",
              "makietę dashboardu", "dashboard mockup", "prototyp w Figmie", "Figma prototype",
              "typografię", "typography"],
    "channel": ["LinkedIn", "newsletter", "blog", "Instagram", "X (Twitter)",
                "kampanię SEO", "SEO campaign", "kampanię email", "email campaign",
                "media społecznościowe", "social media"],
    "target": ["20 hoteli", "20 hotels", "potencjalnych partnerów", "potential partners",
               "inwestorów", "investors", "early adopters", "wczesnych użytkowników",
               "klientów enterprise", "enterprise leads", "sieci hotelowe", "hotel chains"],
    "infra": ["Next.js do v15", "Next.js to v15", "zależności", "dependencies",
              "CI/CD pipeline", "konfigurację ESLint", "ESLint config", "Dockerfile",
              "migrację bazy", "the DB migration", "deploy na Netlify", "Netlify deploy",
              "README", "dokumentację API", "API docs"],
}

# (label, [ (template, lang) ... ])
TEMPLATES = {
    "research": [
        ("Research: evaluate {topic}", "en"),
        ("Investigate {topic}", "en"),
        ("Analysis of {topic}", "en"),
        ("Spike: explore {topic}", "en"),
        ("Audit {topic}", "en"),
        ("Zbadaj {topic}", "pl"),
        ("Analiza {topic}", "pl"),
        ("Badanie {topic} przed decyzją", "pl"),
        ("Rozeznanie rynku: {topic}", "pl"),
        ("POC dla {topic}", "pl"),
    ],
    "development": [
        ("Implement {feature}", "en"),
        ("Build {feature}", "en"),
        ("Add {feature} to the app", "en"),
        ("Create new {feature}", "en"),
        ("Integrate {feature}", "en"),
        ("Zaimplementuj {feature}", "pl"),
        ("Dodaj {feature}", "pl"),
        ("Zbuduj {feature}", "pl"),
        ("Nowa funkcja: {feature}", "pl"),
        ("Wdróż {feature}", "pl"),
    ],
    "outreach": [
        ("Cold outreach to {target}", "en"),
        ("Sales pitch for {target}", "en"),
        ("Schedule demo with {target}", "en"),
        ("Partnership outreach: {target}", "en"),
        ("Growth: acquire {target}", "en"),
        ("Cold mailing do {target}", "pl"),
        ("Pitch sprzedażowy dla {target}", "pl"),
        ("Umów demo z {target}", "pl"),
        ("Partnerstwo: {target}", "pl"),
        ("Pozyskanie {target}", "pl"),
    ],
    "design": [
        ("Design {asset}", "en"),
        ("Redesign {asset}", "en"),
        ("Create mockup for {asset}", "en"),
        ("Wireframe {asset}", "en"),
        ("Prototype {asset} in Figma", "en"),
        ("Zaprojektuj {asset}", "pl"),
        ("Przeprojektuj {asset}", "pl"),
        ("Makieta: {asset}", "pl"),
        ("Prototyp {asset}", "pl"),
        ("Grafika i layout dla {asset}", "pl"),
    ],
    "marketing": [
        ("Launch {channel} campaign", "en"),
        ("Write blog post about {topic}", "en"),
        ("Plan marketing campaign on {channel}", "en"),
        ("SEO optimization for {channel}", "en"),
        ("Prepare press release about {feature}", "en"),
        ("Run promo on {channel}", "en"),
        ("Email campaign for {target}", "en"),
        ("Kampania marketingowa na {channel}", "pl"),
        ("Napisz artykuł na {channel}", "pl"),
        ("Promocja produktu przez {channel}", "pl"),
        ("Optymalizacja SEO dla {channel}", "pl"),
        ("Przygotuj newsletter o {feature}", "pl"),
        ("Reklama na {channel}", "pl"),
        ("Kampania email do {target}", "pl"),
    ],
    "support": [
        ("Fix bug in {area}", "en"),
        ("Hotfix: {area} is broken", "en"),
        ("Resolve crash in {area}", "en"),
        ("Handle customer feedback on {area}", "en"),
        ("Error in {area} reported by user", "en"),
        ("Napraw błąd w {area}", "pl"),
        ("Hotfix: zepsute {area}", "pl"),
        ("Rozwiąż problem z {area}", "pl"),
        ("Zgłoszenie klienta dotyczące {area}", "pl"),
        ("Błąd w obszarze {area}", "pl"),
    ],
    "ops": [
        ("Refactor {area} code", "en"),
        ("Upgrade {infra}", "en"),
        ("Setup {infra}", "en"),
        ("Configure {infra}", "en"),
        ("Update documentation for {infra}", "en"),
        ("Refaktoryzacja {area}", "pl"),
        ("Aktualizacja {infra}", "pl"),
        ("Konfiguracja {infra}", "pl"),
        ("Wdrożenie {infra}", "pl"),
        ("Dokumentacja {infra}", "pl"),
    ],
}

PER_TEMPLATE = 10  # how many filled variants per template (deduped)


def _fill(template: str) -> str:
    out = template
    for slot, options in SLOTS.items():
        token = "{" + slot + "}"
        while token in out:
            out = out.replace(token, random.choice(options), 1)
    return out


def build_synthetic():
    rows = []
    seen = set()
    for label, templates in TEMPLATES.items():
        for template, lang in templates:
            made = 0
            attempts = 0
            while made < PER_TEMPLATE and attempts < PER_TEMPLATE * 8:
                attempts += 1
                text = _fill(template)
                key = text.lower()
                if key in seen:
                    continue
                seen.add(key)
                # encode language into the source tag so PL/EN is separable later
                rows.append((text, label, f"synthetic_{lang}"))
                made += 1
    print("[dataset] synthetic rows by class:", Counter(r[1] for r in rows))
    print("[dataset] synthetic rows by lang :",
          Counter(r[2] for r in rows))
    return rows


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    hf_rows = load_hf_rows()
    syn_rows = build_synthetic()
    all_rows = hf_rows + syn_rows
    random.shuffle(all_rows)

    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "label", "source"])
        for text, label, source in all_rows:
            w.writerow([text, label, source])

    print(f"\n[dataset] wrote {len(all_rows)} rows -> {OUT_CSV}")
    print("[dataset] TOTAL by class :", Counter(r[1] for r in all_rows))
    print("[dataset] TOTAL by source:", Counter(r[2] for r in all_rows))


if __name__ == "__main__":
    main()
