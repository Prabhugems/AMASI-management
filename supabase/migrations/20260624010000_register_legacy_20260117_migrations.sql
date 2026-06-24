-- Reconcile migration drift: register the four 20260117_*.sql files that
-- exist on prod (applied out-of-band via SQL editor, January 2026) but are
-- absent from supabase_migrations.schema_migrations.
--
-- WHY THIS MATTERS
-- The prod DB and the migration history have drifted in BOTH directions:
--   - the file lied (20260117_seed_templates_function.sql claimed to exist
--     but its function `seed_event_templates` was never created — removed
--     in the same commit)
--   - the table lied (the schema we depend on — checkin_token trigger,
--     badge-lock columns, auto-send template columns, and the 121 FMAS
--     templates — has been running in prod for ~5 months without any
--     supabase_migrations row to acknowledge it)
-- Without this reconciliation, a fresh staging clone or environment rebuild
-- would re-process the 20260117_*.sql files. Three of them are idempotent
-- (IF NOT EXISTS / CREATE OR REPLACE) so re-running is safe. The fourth —
-- 20260117_event_templates.sql — was DELETE+INSERT, and a re-run would have
-- wiped every admin-customized message template for the 121 FMAS event.
-- That file is now wrapped in an IF NOT EXISTS guard (in the same PR), and
-- this migration records it as applied so the schema_migrations table
-- agrees with reality.
--
-- WHY SYNTHETIC VERSIONS
-- The four legacy files share the literal version prefix "20260117" (no time
-- suffix). schema_migrations.version is a unique key, so we cannot insert
-- four rows that all use "20260117" — they would collide. We synthesize
-- "20260117<NN>0000" versions per file (NN = file order) so chronological
-- ordering is preserved while the rows are distinct. The `name` matches the
-- original filename suffix for traceability.
--
-- WHERE THE FILES NOW LIVE
-- The four colliding 20260117_*.sql files have been MOVED to
-- supabase/migrations/legacy/ in the same commit. They are NOT renamed —
-- filenames and git history are preserved — but the supabase CLI ignores
-- subdirectories of supabase/migrations/, so `supabase db push` will not
-- try to re-apply them (which would error on duplicate version PK and would
-- also re-trigger the now-guarded event_templates DELETE+INSERT). They
-- remain in the repo as documentation of the schema that prod was built on.
-- From this point forward, all NEW migrations live in supabase/migrations/
-- directly and use full timestamp versions (e.g. 20260623140455) which
-- never collide.
--
-- IDEMPOTENT: ON CONFLICT DO NOTHING — safe on environments where these
-- markers already exist.

INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260117010000', 'secure_checkin'),
  ('20260117020000', 'badge_locking'),
  ('20260117030000', 'auto_send_templates'),
  ('20260117040000', 'event_templates')
ON CONFLICT (version) DO NOTHING;
