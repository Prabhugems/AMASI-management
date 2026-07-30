-- Agenda Builder Phase 1: halls become a real entity instead of free-text
-- sessions.hall. Additive only -- do NOT apply until explicit user go-ahead
-- (see CLAUDE.md's migration pipeline section). Backfill of existing halls
-- happens via scripts/agenda-backfill-halls.mjs, run separately after this
-- migration is applied -- not part of this file.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists halls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  capacity integer,
  floor text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_halls_event on halls(event_id);

alter table sessions add column if not exists hall_id uuid references halls(id);
alter table hall_coordinators add column if not exists hall_id uuid references halls(id);
