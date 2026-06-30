"""
baseline.py — Faithful Python port of `inferTaskType` from lib/utils.ts.

This replicates the production regex baseline EXACTLY:
  - same regex patterns
  - same evaluation ORDER (research -> design -> marketing -> outreach ->
    support -> ops -> development)
  - same `length < 3 => no match` guard
  - returns "unknown" where the TS version returns `null`

"unknown" is treated downstream as an explicit "no prediction" so the baseline
is scored fairly (it is never forced to guess a class it didn't match).

The 7 Compass task_type classes (see migration 015_task_type_refactor.sql):
  research, development, outreach, design, marketing, support, ops
"""

import re
from typing import Optional

# IMPORTANT: order matters and mirrors lib/utils.ts exactly.
# Python's `re` does not support the `\b` word-boundary identically for
# non-ASCII (e.g. Polish "ł", "ż") characters under the default (str) engine,
# but JS `\b` has the same ASCII-only limitation, so behaviour matches the
# production baseline. We use re.IGNORECASE to mirror `title.toLowerCase()`.

RULES = [
    (
        "research",
        r"\b(research|badani[ea]|zbadaj|investigat(e|ion)|analiz[aeuy]|analys[ei]s|audit|poc|proof of concept|spike|explore?|discover|learn|onboard)\b",
    ),
    (
        "design",
        r"\b(design|mockup|wireframe|prototype|figma|ui|ux|layout|visual|branding|logo|typography|ilustracj[ae]|grafik[ai]|content|copy|tekst|artykuł)\b",
    ),
    (
        "marketing",
        r"\b(marketing|kampani[ae]|campaign|newsletter|social([ -]media)?|seo|blog|landing page|copywrite?|email campaign|promo(cj[ae])?|reklam[ae]|pr\b|press release|media)\b",
    ),
    (
        "outreach",
        r"\b(outreach|growth|partnerstwo|partnership|lead|akwizycj[ae]|acquisition|sprzedaż|sales|konferencj[ae]|conference|event|demo|pitch|cold)\b",
    ),
    (
        "support",
        r"\b(support|fix(ed|ing|uj|uję)?|bug|błąd|error|crash\w*|broken|hotfix|glitch\w*|feedback|zgłoszeni[ae]|issue|problem|napraw\w*|klient|customer)\b",
    ),
    (
        "ops",
        r"\b(refactor|refaktoryz|cleanup|clean[ -]up|setup|set[ -]up|konfiguracja|configur(e|ation)|deploy|migrat(e|ion)|upgrade|maintenance|readme|dokumentacj[ae]|documentation|ci\/cd|linting|dependency|dependencies|admin|ops|operacj[ae])\b",
    ),
    (
        "development",
        r"\b(add|dodaj|implement(uj)?|zbuduj|build|create|utwórz|now[ay]|new|feature|funkcj[ae]|integracj[ae]|integrat(e|ion)|develop|wdróż|introduce)\b",
    ),
]

_COMPILED = [(label, re.compile(pat, re.IGNORECASE)) for label, pat in RULES]


def infer_task_type(title: str) -> Optional[str]:
    """Return one of the 7 classes, or None when no rule matches (== TS null)."""
    t = title.lower().strip()
    if len(t) < 3:
        return None
    for label, rx in _COMPILED:
        if rx.search(t):
            return label
    return None


def predict(title: str) -> str:
    """Wrapper returning 'unknown' instead of None for scoring convenience."""
    out = infer_task_type(title)
    return out if out is not None else "unknown"


if __name__ == "__main__":
    samples = [
        "Research: evaluate third-party APIs",
        "Zbadaj konkurencyjne narzedzia PM",
        "Fix race condition in auth flow",
        "Napraw blad w logowaniu",
        "Design sprint board card redesign",
        "Kampania marketingowa na LinkedIn",
        "Cold outreach do 20 hoteli",
        "Refactor cycles server action",
        "Implement onboarding wizard step 1",
        "Spotkanie z zespolem",  # expect no match -> unknown
    ]
    for s in samples:
        print(f"{predict(s):12s}  <-  {s}")
