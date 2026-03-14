-- Abstract Management Enhanced Features Migration
-- Run this migration to add revision workflow, presentation uploads, COI, and blind review features

-- 1. Abstract Revisions Table (Version History)
CREATE TABLE IF NOT EXISTS abstract_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  abstract_text TEXT NOT NULL,
  keywords TEXT[],
  file_url TEXT,
  file_name TEXT,
  revised_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abstract_revisions_abstract ON abstract_revisions(abstract_id);
CREATE INDEX IF NOT EXISTS idx_abstract_revisions_event ON abstract_revisions(event_id);

-- 2. Add new columns to abstracts table for revision/presentation tracking
DO $$ BEGIN
  -- Revision tracking
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS last_revision_at TIMESTAMPTZ;
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS revision_notes TEXT;

  -- Presentation upload
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS presentation_url TEXT;
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS presentation_name TEXT;
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS presentation_type TEXT; -- slides, video, poster
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS presentation_uploaded_at TIMESTAMPTZ;

  -- Withdrawal tracking
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
  ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Conflict of Interest table for reviewers
CREATE TABLE IF NOT EXISTS reviewer_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES abstract_reviewers(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL, -- 'institution', 'co_author', 'personal', 'other'
  conflict_value TEXT NOT NULL, -- institution name, email, etc.
  conflict_reason TEXT,
  declared_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reviewer_id, conflict_type, conflict_value)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_conflicts_reviewer ON reviewer_conflicts(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_conflicts_event ON reviewer_conflicts(event_id);

-- 4. Add COI fields to abstract_reviewers
DO $$ BEGIN
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS institution TEXT;
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS specialties TEXT[];
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS keywords TEXT[];
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS max_assignments INTEGER DEFAULT 10;
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS coi_declared BOOLEAN DEFAULT FALSE;
  ALTER TABLE abstract_reviewers ADD COLUMN IF NOT EXISTS coi_declared_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Add blind review and auto-reminder settings to abstract_settings
DO $$ BEGIN
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS enable_blind_review BOOLEAN DEFAULT FALSE;
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS auto_reminders_enabled BOOLEAN DEFAULT FALSE;
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER[] DEFAULT ARRAY[7, 3, 1];
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS enable_reviewer_matching BOOLEAN DEFAULT FALSE;
  ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS require_coi_declaration BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 6. Abstract Reminders Log
CREATE TABLE IF NOT EXISTS abstract_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- 'submission_deadline', 'review_deadline', 'revision_deadline'
  recipient_type TEXT NOT NULL, -- 'author', 'reviewer'
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  abstract_id UUID REFERENCES abstracts(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT DEFAULT 'email', -- 'email', 'whatsapp', 'sms'
  delivery_status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abstract_reminders_event ON abstract_reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_abstract_reminders_type ON abstract_reminders(reminder_type);

-- 7. Add abstract category keywords for matching
DO $$ BEGIN
  ALTER TABLE abstract_categories ADD COLUMN IF NOT EXISTS keywords TEXT[];
  ALTER TABLE abstract_categories ADD COLUMN IF NOT EXISTS specialty_track TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Done!
SELECT 'Abstract features migration completed successfully' AS status;
