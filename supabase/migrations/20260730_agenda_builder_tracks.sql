-- Agenda Builder Phase 1: reconcile sessions.specialty_track (free text)
-- with the existing tracks table. Additive only -- do NOT apply until
-- explicit user go-ahead. Backfill via scripts/agenda-backfill-tracks.mjs,
-- run separately after this migration is applied.
-- See docs/superpowers/specs/2026-07-30-agenda-builder-data-model-design.md

alter table sessions add column if not exists track_id uuid references tracks(id);
