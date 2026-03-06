-- Global Reviewers Pool (not tied to any event)
CREATE TABLE IF NOT EXISTS reviewers_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  institution TEXT,
  city TEXT,
  specialty TEXT,
  years_of_experience TEXT,
  status TEXT DEFAULT 'active',       -- active, inactive
  notes TEXT,
  form_token TEXT UNIQUE,             -- Token for reviewer to fill details
  form_completed_at TIMESTAMPTZ,      -- When reviewer submitted their details
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviewers_pool_email ON reviewers_pool(email);
CREATE INDEX IF NOT EXISTS idx_reviewers_pool_form_token ON reviewers_pool(form_token);
