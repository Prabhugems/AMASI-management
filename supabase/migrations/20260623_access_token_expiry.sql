-- Phase 3 / M5: backfill staff access-token expiry for existing check-in lists.
--
-- Until now checkin_lists.access_token_expires_at was never populated — every
-- list's staff link was non-expiring. Tie expiry to the event end (+2-day
-- grace). Lists for past events get a past expiry and thus expire immediately,
-- which is the intended effect (those weak, long-lived links should die).
--
-- New lists receive an expiry at creation (in the checkin-lists POST handler),
-- and any list's token can be rotated/revoked via
-- POST/DELETE /api/checkin-lists/[id]/access-token.
--
-- MANUAL POST-DEPLOY STEP — this repo's build only schema-checks; it does not
-- auto-apply migrations. Run via the Supabase MCP / SQL editor only after
-- confirming no list is mid-event. (Verified idle 2026-06-23: zero check-ins
-- in the prior 24h across all 13 lists; latest activity 2026-03-19.)
UPDATE checkin_lists cl
   SET access_token_expires_at = (e.end_date::date + INTERVAL '2 days')
  FROM events e
 WHERE e.id = cl.event_id
   AND cl.access_token_expires_at IS NULL;
