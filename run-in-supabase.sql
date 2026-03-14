CREATE TABLE IF NOT EXISTS abstract_reviewer_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  institution TEXT,
  designation TEXT,
  expertise_areas TEXT[] DEFAULT '{}',
  specialty TEXT,
  max_assignments INT DEFAULT 20,
  current_assignments INT DEFAULT 0,
  completed_reviews INT DEFAULT 0,
  avg_review_time_hours DECIMAL(5,1),
  avg_score_given DECIMAL(3,1),
  status TEXT DEFAULT 'active',
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, email)
);

CREATE TABLE IF NOT EXISTS abstract_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  abstract_id UUID NOT NULL REFERENCES abstracts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES abstract_reviewer_pool(id) ON DELETE CASCADE,
  review_round INT DEFAULT 1,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES team_members(id),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  reminder_count INT DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(abstract_id, reviewer_id, review_round)
);

CREATE INDEX IF NOT EXISTS idx_reviewer_pool_event ON abstract_reviewer_pool(event_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_pool_email ON abstract_reviewer_pool(email);
CREATE INDEX IF NOT EXISTS idx_review_assignments_abstract ON abstract_review_assignments(abstract_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_reviewer ON abstract_review_assignments(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_assignments_status ON abstract_review_assignments(status);

ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ;
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0;
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS declined_reason TEXT;
ALTER TABLE abstract_review_assignments ADD COLUMN IF NOT EXISTS declined_notes TEXT;

ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS total_emails_sent INT DEFAULT 0;
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS total_emails_opened INT DEFAULT 0;
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMPTZ;
ALTER TABLE abstract_reviewer_pool ADD COLUMN IF NOT EXISTS decline_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_review_assignments_email_opened ON abstract_review_assignments(email_opened_at);
CREATE INDEX IF NOT EXISTS idx_review_assignments_last_viewed ON abstract_review_assignments(last_viewed_at);
CREATE INDEX IF NOT EXISTS idx_review_assignments_declined_reason ON abstract_review_assignments(declined_reason) WHERE declined_reason IS NOT NULL;
