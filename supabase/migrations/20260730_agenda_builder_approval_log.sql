-- Agenda Builder Phase 1: append-only approval/publish lifecycle log.
-- Current lifecycle state is derived from the most recent row (see
-- src/lib/agenda-approval-state.ts), never stored redundantly. Additive
-- only -- do NOT apply until explicit user go-ahead.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

create table if not exists agenda_approval_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'changes_requested', 'published')),
  actor_user_id uuid not null references users(id),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_agenda_approval_log_event on agenda_approval_log(event_id, created_at desc);
