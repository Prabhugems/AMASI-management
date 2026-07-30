-- Agenda Builder Phase 1: per-event capability toggles, kept separate from
-- the already-large event_settings table. All-false defaults -- creating
-- this row has zero behavioral effect on any existing event until a
-- coordinator explicitly turns something on. Additive only -- do NOT apply
-- until explicit user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists agenda_settings (
  event_id uuid primary key references events(id) on delete cascade,
  enable_session_checkin boolean not null default false,
  enable_session_registration boolean not null default false,
  enable_capacity_limits boolean not null default false,
  enable_feedback boolean not null default false,
  enable_attendance_points boolean not null default false,
  enable_certificates boolean not null default false,
  enable_virtual_delivery boolean not null default false,
  enable_public_programme boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
