-- Enforce "one podium check-in per abstract" at the DB level so the
-- compare-and-set in api/abstracts/podium-checkin/route.ts has a 23505
-- safety net for any race that slips past the CAS WHERE clause (e.g. a
-- second scan that arrives during the millisecond window between the CAS
-- UPDATE returning and the INSERT firing).
--
-- Pre-flight (PROD, 2026-06-24): abstract_presenter_checkins has 0 rows on
-- prod, so the constraint can be added with no dedupe step. RE-CHECK the
-- count immediately before applying — if any duplicate exists by then,
-- dedupe FIRST using the block below (kept in this comment as a separate,
-- reviewable step; do NOT auto-run it):
--
--   WITH ranked AS (
--     SELECT id, ROW_NUMBER() OVER (
--       PARTITION BY abstract_id
--       ORDER BY presentation_started_at NULLS LAST, id
--     ) AS rn
--     FROM abstract_presenter_checkins
--   )
--   DELETE FROM abstract_presenter_checkins
--   WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
--
-- DEPLOY STATUS WHEN THIS FILE LANDS: the GitHub Action at
-- .github/workflows/migrations.yml is BROKEN at time of PR (pre-existing
-- 63-version drift between remote schema_migrations and supabase/
-- migrations/ — unrelated to this PR; see the separate investigation
-- thread). This migration is committed to the directory so a fresh clone
-- or a fixed CI pipeline picks it up, but it will NOT auto-apply on merge
-- of this PR. The CAS in the route is the race-guard until the constraint
-- lands. Do not hand-apply this via MCP / SQL editor without recording it
-- in supabase_migrations.schema_migrations — out-of-band application is
-- precisely the pattern today's investigation is meant to stop.

ALTER TABLE abstract_presenter_checkins
  ADD CONSTRAINT abstract_presenter_checkins_abstract_id_key
  UNIQUE (abstract_id);
