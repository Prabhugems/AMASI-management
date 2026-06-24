-- Speaker & Content Management — Phase 1 (Normalization foundation)
-- Plan: /Users/prabhubalasubramaniam/.claude/plans/speaker-content-management-reactive-brooks.md
--
-- Pre-flight findings (2026-06-24):
--   • faculty_assignments (1,127 rows) is the working session↔speaker junction — extend it
--     instead of creating a parallel session_speakers table.
--   • faculty already has linkedin/twitter/researchgate/orcid_id/pubmed_id/areas_of_interest/bio/photo_url
--     — only 4 additive columns needed for rich profiles.
--   • amasi-membership does NOT read sessions.speakers/chairpersons/moderators text columns
--     (grep returned 0 hits) — no dual-write trigger required.
--   • All 1,127 faculty_assignments rows have NULL faculty_id (created from text parsing).
--     event_faculty activation for honoraria deferred to Phase 3 after email→faculty_id
--     matching pass.
--
-- This migration is purely additive. No data is modified.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Extend faculty_assignments (the working session↔speaker junction)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE faculty_assignments
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topic_description TEXT,
  ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES faculty_assignments(id) ON DELETE SET NULL;

-- Expand role CHECK to include keynote + discussant (superset of existing values).
ALTER TABLE faculty_assignments DROP CONSTRAINT IF EXISTS faculty_assignments_role_check;
ALTER TABLE faculty_assignments
  ADD CONSTRAINT faculty_assignments_role_check
  CHECK (role IN ('speaker','chairperson','moderator','panelist','keynote','discussant'));

CREATE INDEX IF NOT EXISTS idx_faculty_assignments_session_order
  ON faculty_assignments(session_id, display_order);

CREATE INDEX IF NOT EXISTS idx_faculty_assignments_event_role
  ON faculty_assignments(event_id, role);

COMMENT ON COLUMN faculty_assignments.display_order IS
  'Speaking order within a session (0-based). Tie-break by created_at.';
COMMENT ON COLUMN faculty_assignments.topic_description IS
  'Long-form description of the speaker''s topic for this session.';
COMMENT ON COLUMN faculty_assignments.replaced_by IS
  'Self-FK: if this assignment was replaced (e.g. last-minute substitute), points to the new row.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Extend faculty with rich-profile columns
-- ──────────────────────────────────────────────────────────────────────────
-- Already present on faculty: linkedin, twitter, researchgate, orcid_id, pubmed_id,
-- areas_of_interest (ARRAY), bio (TEXT plain), photo_url, is_reviewer, reviewer_specialties.

ALTER TABLE faculty
  ADD COLUMN IF NOT EXISTS bio_markdown TEXT,
  ADD COLUMN IF NOT EXISTS expertise_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS headshot_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS youtube_reel_url TEXT;

CREATE INDEX IF NOT EXISTS idx_faculty_expertise_tags_gin
  ON faculty USING GIN (expertise_tags);

COMMENT ON COLUMN faculty.bio_markdown IS
  'Markdown-formatted long bio. Render to HTML at read time. Distinct from legacy plain-text bio column.';
COMMENT ON COLUMN faculty.expertise_tags IS
  'Curated taxonomy tags for filtering/discovery. Distinct from free-form areas_of_interest.';
COMMENT ON COLUMN faculty.headshot_urls IS
  'Headshot library: [{url, label, uploaded_at, is_primary}]. photo_url remains the primary fallback.';
COMMENT ON COLUMN faculty.youtube_reel_url IS
  'Optional speaker introduction video (YouTube or other embed URL).';

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Storage bucket: speaker-headshots (public read, service-role write)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-headshots',
  'speaker-headshots',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg','image/png','image/webp','image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for headshots (anon + authenticated).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for speaker headshots'
  ) THEN
    CREATE POLICY "Public read access for speaker headshots"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'speaker-headshots');
  END IF;
END $$;

-- Uploads go through the API via signed URLs (service role bypasses RLS),
-- so no INSERT/UPDATE/DELETE policy needed for anon/authenticated roles.
