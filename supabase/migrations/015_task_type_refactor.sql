-- ============================================================
-- Hotable Compass — Migracja 015: Nowe kategorie zadań
-- Zastępuje: feature, bug, chore
-- Dodaje: development, outreach, support, ops
-- ============================================================

-- Krok 1: Zmień kolumnę na text żeby można było przebudować enum
ALTER TABLE tasks ALTER COLUMN type DROP DEFAULT;
ALTER TABLE tasks ALTER COLUMN type TYPE text;

-- Krok 2: Migracja danych (stare → nowe wartości)
UPDATE tasks SET type = 'development' WHERE type IN ('feature', 'bug');
UPDATE tasks SET type = 'ops'         WHERE type = 'chore';

-- Krok 3: Usuń stary enum i utwórz nowy
DROP TYPE task_type;

CREATE TYPE task_type AS ENUM (
  'research',
  'development',
  'outreach',
  'design',
  'marketing',
  'support',
  'ops'
);

-- Krok 4: Przywróć kolumnę z nowym typem
ALTER TABLE tasks ALTER COLUMN type TYPE task_type USING type::task_type;
ALTER TABLE tasks ALTER COLUMN type SET DEFAULT 'development';
