-- Agenda Builder: the second level of the agenda. A block holds its talks.
--
-- `sessions` becomes the BLOCK ("GALL BLADDER", 09:30-11:30, Hall 1 > Screen A,
-- chaired). A `talk` is one item inside it, with its own time, title and roles.
-- A block with no talks is legitimate and common -- that is LUNCH.
--
-- Deliberately a SEPARATE TABLE rather than making `sessions` self-nesting.
-- Self-nesting would have been symmetrical with the halls tree, but 65 query
-- sites across 39 files do `from("sessions")` and would silently start
-- returning talks as if they were sessions -- the public programme, the
-- delegate view, the CSV exports, the conflicts page, the check-in lists. Every
-- one would need a `kind = 'block'` filter added, and a single missed site
-- double-counts the programme. A new table is additive and cannot break a
-- query that does not know about it.
--
-- Additive only -- do NOT apply until explicit user go-ahead (see CLAUDE.md's
-- migration pipeline section).

create table if not exists talks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,

  -- Denormalised from the parent block so every talk-scoped query can filter by
  -- event without a join. Matches how faculty_assignments already carries
  -- event_id alongside session_id.
  event_id uuid not null references events(id) on delete cascade,

  title text,

  -- 'talk'       -- one speaker presenting
  -- 'panel'      -- a moderator plus panellists
  -- 'discussion' -- open discussion; each response is an assignment with its
  --                own duration_minutes, role 'discussant'
  -- 'video'      -- a video session
  -- 'break'      -- a gap inside a block that is not a talk
  talk_type text not null default 'talk'
    check (talk_type in ('talk','panel','discussion','video','break')),

  -- A talk's own time, inside its block's range. Nullable because the Session
  -- Builder lets you add a talk before deciding when it runs -- the design
  -- shows "1h 30m of the block still unscheduled" rather than blocking.
  start_time time,
  end_time time,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),

  -- Running order within the block. Ties break by start_time then created_at.
  display_order integer not null default 0,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_talks_session on talks(session_id, display_order);
create index if not exists idx_talks_event on talks(event_id);

comment on table talks is
  'The second level of the agenda: one item inside a session block, with its own time, title and roles. A block with no talks is legitimate (breaks, lunch).';
comment on column talks.event_id is
  'Denormalised from the parent block. Kept in step by the API, never written independently.';
comment on column talks.start_time is
  'Nullable on purpose -- a talk can be added before it is scheduled. Times outside the block''s range are a warning in the Session Builder, not a rejection, because a real programme routinely contains them mid-edit.';

alter table talks enable row level security;
-- No policies -- default-deny. Only ever read/written via the admin
-- (service-role) Supabase client, matching halls, agenda_settings and
-- agenda_approval_log.

drop trigger if exists update_talks_timestamp on talks;
create trigger update_talks_timestamp
  before update on talks
  for each row
  execute function update_updated_at_column();
-- update_updated_at_column() confirmed present in production via pg_proc
-- (2026-08-07). Do NOT use update_faculty_assignment_timestamp() -- it is
-- declared in 20260113_faculty_assignments.sql but does not exist live.

-- ---------------------------------------------------------------------------
-- faculty_assignments gains the talk grain
-- ---------------------------------------------------------------------------
--
-- An assignment keeps its session_id (the block) AND gains a talk_id when it
-- belongs to a talk. Both, not either: existing queries that ask "who is in
-- this block?" -- the invitation email, the speaker portal -- keep working
-- unchanged and now correctly include the block's talk speakers.
--
--   chairperson of the block  -> session_id set, talk_id null
--   speaker of a talk         -> session_id set, talk_id set

alter table faculty_assignments
  add column if not exists talk_id uuid references talks(id) on delete cascade;

create index if not exists idx_faculty_assignments_talk on faculty_assignments(talk_id);

comment on column faculty_assignments.talk_id is
  'Set when this assignment belongs to a talk rather than to the block as a whole. session_id always points at the containing block either way.';

-- ---------------------------------------------------------------------------
-- session_role_requirements gains the same grain
-- ---------------------------------------------------------------------------
--
-- Requires 20260807_agenda_session_role_requirements.sql to have been applied
-- first. That file is currently marked DO-NOT-APPLY precisely because it needs
-- what follows; apply the two together, in that order.

alter table session_role_requirements
  add column if not exists talk_id uuid references talks(id) on delete cascade;

-- The plain `unique (session_id, role)` cannot express this. Postgres treats
-- NULLs as distinct in a unique constraint, so once talk_id exists,
-- (s1, NULL, 'chairperson') could be inserted twice. Two partial indexes do it
-- correctly: one row per role per block, and one row per role per talk.
alter table session_role_requirements drop constraint if exists session_role_requirements_session_id_role_key;

create unique index if not exists session_role_requirements_block_key
  on session_role_requirements (session_id, role) where talk_id is null;

create unique index if not exists session_role_requirements_talk_key
  on session_role_requirements (talk_id, role) where talk_id is not null;

create index if not exists idx_session_role_requirements_talk
  on session_role_requirements(talk_id);
