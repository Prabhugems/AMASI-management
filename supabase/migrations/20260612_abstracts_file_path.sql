-- Phase A: file upload wiring + private storage for the public submit-abstract wizard.
--
-- Adds abstracts.file_path: the Supabase Storage object path in the private
-- abstract-files bucket. The wizard receives a short-lived signed URL from the
-- upload route for preview; the persisted value is just the path.
--
-- Provisions abstract-files as PRIVATE. Reads must use createSignedUrl().
--
-- The existing file_url column is left in place for legacy data and for the
-- still-unmigrated admin/portal write paths (/api/abstracts, /api/abstracts/[id],
-- /api/my/abstracts, /events/[eventId]/submit-abstract). Read consumers
-- (reviewer-portal, abstract-reviewer, event abstract detail) continue to read
-- file_url and are tracked as Phase A follow-ups.

ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS file_path TEXT;
COMMENT ON COLUMN abstracts.file_path IS
  'Supabase Storage object path in private abstract-files bucket. Read via createSignedUrl; do not persist signed URLs.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('abstract-files', 'abstract-files', false)
ON CONFLICT (id) DO NOTHING;
