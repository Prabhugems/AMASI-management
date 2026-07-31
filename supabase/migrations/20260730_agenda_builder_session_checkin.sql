-- Agenda Builder Phase 1: session-level check-in, reusing the existing
-- checkin_lists / kiosk_station_lists scheduling machinery rather than
-- forking it. Additive only, default false -- do NOT apply until explicit
-- user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

alter table sessions add column if not exists checkin_enabled boolean not null default false;

alter table checkin_lists add column if not exists session_id uuid references sessions(id) on delete cascade;

create unique index if not exists checkin_lists_session_id_key
  on checkin_lists (session_id) where session_id is not null;

alter table checkin_lists drop constraint if exists checkin_lists_list_purpose_check;
alter table checkin_lists add constraint checkin_lists_list_purpose_check
  check (list_purpose in ('entry', 'collection', 'session'));
