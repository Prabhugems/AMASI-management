-- Speaker & Content Management — Phase 2 (Self-serve content portal)
-- Plan: /Users/prabhubalasubramaniam/.claude/plans/speaker-content-management-reactive-brooks.md
--
-- Pre-flight findings (2026-06-24):
--   • Existing buckets: abstract-files, badges, downloads, event-assets, form-uploads,
--     speaker-headshots, uploads. The `presentations` bucket I originally planned to
--     reuse does NOT exist. Adding a new `speaker-content` bucket is cleaner than
--     overloading `uploads` since the content has its own MIME allow-list + size limit.
--   • `/speaker/[token]/page.tsx` is already a dual-flow router that resolves both
--     registrations.custom_fields.portal_token and faculty_assignments.invitation_token.
--     Phase 2 builds new sub-routes under that path; no changes to the dual router.
--   • No existing `presentation_deadline` column on events. Adding speaker_content_deadline
--     to event_settings (where other feature toggles + deadlines already live).
--
-- Purely additive. No data is modified.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. speaker_content table — versioned per (faculty_assignment, content_type)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS speaker_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_assignment_id UUID NOT NULL REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES faculty(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'slides', 'handout', 'video', 'poster', 'supplementary'
  )),
  storage_bucket TEXT NOT NULL DEFAULT 'speaker-content',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  uploaded_by_token TEXT,
  uploaded_by_email TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_content_assignment
  ON speaker_content(faculty_assignment_id);
CREATE INDEX IF NOT EXISTS idx_speaker_content_event
  ON speaker_content(event_id);
CREATE INDEX IF NOT EXISTS idx_speaker_content_faculty
  ON speaker_content(faculty_id);

-- At most one CURRENT version per (assignment, content_type). Old versions stay
-- with is_current=false for audit/rollback.
CREATE UNIQUE INDEX IF NOT EXISTS idx_speaker_content_current
  ON speaker_content(faculty_assignment_id, content_type)
  WHERE is_current;

ALTER TABLE speaker_content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'speaker_content'
      AND policyname = 'Service role full access speaker_content'
  ) THEN
    CREATE POLICY "Service role full access speaker_content"
      ON speaker_content FOR ALL TO service_role
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

COMMENT ON COLUMN speaker_content.faculty_assignment_id IS
  'The session×speaker assignment this content belongs to. Cascading delete protects against orphan content.';
COMMENT ON COLUMN speaker_content.is_current IS
  'True for the latest version of each (assignment, content_type). On re-upload, the prior row is marked is_current=false and superseded_at is set.';
COMMENT ON COLUMN speaker_content.uploaded_by_token IS
  'Which invitation_token (faculty_assignments) was used to upload. Audit trail for token-based portal access.';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. speaker_portal_actions — audit log for the public speaker portal
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS speaker_portal_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_assignment_id UUID REFERENCES faculty_assignments(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'viewed_portal',
    'confirmed_times',
    'uploaded_content',
    'replaced_content',
    'deleted_content',
    'signed_disclosure',
    'requested_change'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speaker_portal_actions_assignment
  ON speaker_portal_actions(faculty_assignment_id);
CREATE INDEX IF NOT EXISTS idx_speaker_portal_actions_event
  ON speaker_portal_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_speaker_portal_actions_created
  ON speaker_portal_actions(created_at DESC);

ALTER TABLE speaker_portal_actions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'speaker_portal_actions'
      AND policyname = 'Service role full access speaker_portal_actions'
  ) THEN
    CREATE POLICY "Service role full access speaker_portal_actions"
      ON speaker_portal_actions FOR ALL TO service_role
      USING (TRUE) WITH CHECK (TRUE);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Deadline column on event_settings (consistent with existing toggles there)
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE event_settings
  ADD COLUMN IF NOT EXISTS speaker_content_deadline TIMESTAMPTZ;

COMMENT ON COLUMN event_settings.speaker_content_deadline IS
  'Hard deadline for speaker slide/handout uploads via the portal. After this, the upload endpoint returns 403. NULL = no deadline.';

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Storage bucket: speaker-content (public read, service-role write via signed URLs)
-- ──────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'speaker-content',
  'speaker-content',
  TRUE,
  104857600,  -- 100 MB; matches abstracts upload-presentation tolerance
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for speaker content'
  ) THEN
    CREATE POLICY "Public read access for speaker content"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'speaker-content');
  END IF;
END $$;
