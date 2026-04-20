-- ============================================================
-- Hotable Compass — Migracja 003: Indeksy wydajnościowe
-- Dodaje brakujące indeksy wg CLAUDE.md dla tabel documents i ideas
-- ============================================================

-- Filtrowanie dokumentów po typie (ADR / RFC / spec / brief / weekly)
create index if not exists documents_type_idx on documents (type);

-- Filtrowanie pomysłów po statusie (inbox / accepted / rejected / converted)
create index if not exists ideas_status_idx on ideas (status);
