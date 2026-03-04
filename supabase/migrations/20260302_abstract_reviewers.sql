-- Abstract Reviewers table for managing registered reviewers per event
CREATE TABLE IF NOT EXISTS abstract_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  institution TEXT,
  city TEXT,
  specialty TEXT,
  years_of_experience TEXT,
  status TEXT DEFAULT 'active',       -- active, inactive
  notes TEXT,
  assigned_abstracts UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_abstract_reviewers_event ON abstract_reviewers(event_id);
CREATE INDEX IF NOT EXISTS idx_abstract_reviewers_email ON abstract_reviewers(event_id, email);

-- Add restrict_reviewers flag to abstract_settings
ALTER TABLE abstract_settings ADD COLUMN IF NOT EXISTS restrict_reviewers BOOLEAN DEFAULT false;
