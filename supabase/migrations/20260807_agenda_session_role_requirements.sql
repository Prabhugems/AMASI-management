-- Agenda Builder Phase 1: declare what a session NEEDS, so "unfilled" becomes
-- a queryable fact rather than a guess.
--
-- Nothing today records that a session expected a chairperson. `faculty_assignments`
-- records who was ADDED, never what was REQUIRED, so absence is undetectable --
-- which is why the Open Slots view cannot be built without this table. The
-- 2026-08-07 audit confirmed no `open_slot`/`unfilled`/`required_role` concept
-- exists anywhere in the schema or the code.
--
-- Additive only -- do NOT apply until explicit user go-ahead (see CLAUDE.md's
-- migration pipeline section).
--
-- ##########################################################################
-- DO NOT APPLY THIS FILE AS WRITTEN. It encodes the FLAT agenda model, which
-- was superseded on 2026-08-07 when the two-level design (a block holds its
-- talks -- "Session Builder.html" states 2a-2g) was chosen.
--
-- Under the two-level model a role requirement hangs off whichever level owns
-- it: a chairperson belongs to the BLOCK, while a speaker, moderator or
-- panellist belongs to a TALK inside it. Before this is applied it must gain:
--
--   talk_id uuid references talks(id) on delete cascade   -- nullable
--
-- and the `unique (session_id, role)` below must be replaced by two partial
-- unique indexes, because Postgres treats NULLs as distinct and a plain
-- composite unique would let the same block-level role be declared twice:
--
--   create unique index session_role_requirements_block_key
--     on session_role_requirements (session_id, role) where talk_id is null;
--   create unique index session_role_requirements_talk_key
--     on session_role_requirements (talk_id, role) where talk_id is not null;
--
-- That change is blocked on the `talks` table existing (Phase 1, remainder).
-- Keeping one table across both grains means the Open Slots query in
-- src/lib/agenda-open-slots.ts stays a single query rather than a union.
--
-- Nothing has been applied, so this is a design revision, not a correction.
-- ##########################################################################

create table if not exists session_role_requirements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  role text not null check (role in ('speaker','chairperson','moderator','panelist','keynote','discussant')),
  required_count integer not null default 1 check (required_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per (session, role). "3 speakers" is required_count = 3, not three rows.
  unique (session_id, role)
);

-- The Open Slots query drives off session_id; the Role Requirements editor
-- reads a single session at a time.
create index if not exists idx_session_role_requirements_session
  on session_role_requirements(session_id);

-- The role CHECK deliberately mirrors `faculty_assignments_role_check` exactly
-- (verified live 2026-08-07: speaker, chairperson, moderator, panelist, keynote,
-- discussant). Both are kept in step with src/lib/agenda-roles.ts -- if a role is
-- ever added, all three change together or Open Slots silently stops counting it.

comment on table session_role_requirements is
  'What a session needs, per role. Left-joined against faculty_assignments to compute Open Slots. Seeded from src/lib/agenda-roles.ts DEFAULT_ROSTERS on session create, then edited per session.';
comment on column session_role_requirements.required_count is
  'How many people this session needs in this role. 0 is legal and meaningful: an explicit "this session needs no chair", distinct from having no row at all (never declared).';
comment on column session_role_requirements.notes is
  'Free text for the coordinator, e.g. "must be a paediatric surgeon". Not used in matching.';

alter table session_role_requirements enable row level security;
-- No policies -- default-deny. Only ever read/written via the admin
-- (service-role) Supabase client, matching the posture of kiosk_stations,
-- halls, agenda_settings and agenda_approval_log.

-- Keep updated_at honest.
--
-- Uses `update_updated_at_column()`, which was CONFIRMED PRESENT in production
-- on 2026-08-07 via pg_proc. Do NOT switch this to
-- `update_faculty_assignment_timestamp()` -- that function is declared in
-- 20260113_faculty_assignments.sql but does not exist live (that file was only
-- partially applied; its view and two other functions are missing too). Naming
-- it here would make this migration fail on apply. This is the repo's standing
-- "the SQL files lie, check information_schema first" hazard, hit in practice.
drop trigger if exists update_session_role_requirements_timestamp on session_role_requirements;
create trigger update_session_role_requirements_timestamp
  before update on session_role_requirements
  for each row
  execute function update_updated_at_column();
