-- ============================================================
-- Hotable Compass — Migracja 020: Tier 2 — schemat wspomagania decyzji
-- ============================================================
-- Forward-only. Nie edytuje migracji 001–019.
--
-- Zakres tej migracji (wspólny dla Tier 2):
--   (1) U5 — SAFe WSJF: 4 nullowalne kolumny wejściowe (skala Fibonacciego)
--       w tabeli tasks, używane przez deterministyczne (BEZ LLM) liczenie
--       WSJF = (UserValue + TimeCriticality + RiskReduction) / JobSize.
--   (2) Rozszerzenie CHECK na ai_feedback.feature o nowe nazwy funkcji
--       wspomagania decyzji (Tier 2) oraz nazwę klasyfikatora ML (U1).
--
-- WAŻNE (framing pracy dyplomowej): WSJF (U5) to WSPOMAGANIE DECYZJI oparte
-- na jawnym, deterministycznym wzorze SAFe — NIE jest to model ML ani wywołanie
-- LLM. Jedynym faktycznym ML w systemie jest klasyfikator typu zadania (U1).
-- ============================================================

-- ------------------------------------------------------------
-- U5 (WSJF) — kolumny wejściowe Cost of Delay / Job Size
-- ------------------------------------------------------------
-- Cztery komponenty WSJF wg SAFe (https://scaledagileframework.com/wsjf/):
--   wsjf_user_value       — User-Business Value (komponent CoD)
--   wsjf_time_criticality — Time Criticality      (komponent CoD)
--   wsjf_risk_reduction   — Risk Reduction / Opportunity Enablement (komponent CoD)
--   wsjf_job_size         — Job Size (mianownik; przybliżenie czasu trwania)
--
-- Wszystkie NULLOWALNE → istniejące zadania pozostają nietknięte (brak backfillu),
-- a WSJF jest liczone tylko dla zadań z kompletem 4 wartości (logika w lib/wsjf.ts).
--
-- Wartości na skali "Fibonacci-ish" SAFe (modified Fibonacci): 1,2,3,5,8,13,20.
-- CHECK dopuszcza tę listę LUB NULL — pole opcjonalne. Job Size dodatkowo musi
-- być > 0 (gdyby kiedyś poszerzono listę), aby zabezpieczyć przed dzieleniem
-- przez zero po stronie bazy; nullowalność realizujemy przez `IS NULL OR ...`.

alter table tasks
  add column if not exists wsjf_user_value       integer,
  add column if not exists wsjf_time_criticality integer,
  add column if not exists wsjf_risk_reduction   integer,
  add column if not exists wsjf_job_size         integer;

-- Dozwolone wartości skali (modified Fibonacci SAFe). NULL = nieuzupełnione.
alter table tasks
  add constraint tasks_wsjf_user_value_check
  check (wsjf_user_value is null or wsjf_user_value in (1, 2, 3, 5, 8, 13, 20));

alter table tasks
  add constraint tasks_wsjf_time_criticality_check
  check (wsjf_time_criticality is null or wsjf_time_criticality in (1, 2, 3, 5, 8, 13, 20));

alter table tasks
  add constraint tasks_wsjf_risk_reduction_check
  check (wsjf_risk_reduction is null or wsjf_risk_reduction in (1, 2, 3, 5, 8, 13, 20));

-- Job Size: ta sama skala + jawny warunek > 0 (mianownik nigdy nie może być 0).
alter table tasks
  add constraint tasks_wsjf_job_size_check
  check (wsjf_job_size is null or (wsjf_job_size > 0 and wsjf_job_size in (1, 2, 3, 5, 8, 13, 20)));

-- ------------------------------------------------------------
-- ai_feedback.feature — rozszerzenie listy dozwolonych funkcji
-- ------------------------------------------------------------
-- Tabela ai_feedback powstała w migracji 004 z INLINE (nienazwanym) CHECK na
-- kolumnie feature → PostgreSQL nadał mu nazwę `ai_feedback_feature_check`.
-- (CREATE TABLE IF NOT EXISTS w 005 był no-op, więc to 004 zdefiniował CHECK.)
-- Migracja 018 nie ruszała CHECK (tylko polityki RLS), więc nazwa nadal aktualna.
--
-- Rejestruje WYŁĄCZNIE surowe interakcje (accept/reject/apply/dismiss) — nie
-- liczymy tu "skuteczności". Poszerzamy listę o:
--   sp_estimation_baseline  — U2 (baseline estymacji story points)
--   wsjf_prioritization     — U5 (priorytetyzacja WSJF)
--   task_type_classifier_ml — U1 (jedyny faktyczny model ML)

alter table ai_feedback
  drop constraint if exists ai_feedback_feature_check;

alter table ai_feedback
  add constraint ai_feedback_feature_check
  check (feature in (
    'auto_categorization',
    'assignee_recommender',
    'workload_balancing',
    'sp_estimation_baseline',
    'wsjf_prioritization',
    'task_type_classifier_ml'
  ));
