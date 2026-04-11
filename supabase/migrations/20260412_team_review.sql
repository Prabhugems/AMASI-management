-- 90-day permission review tracking for team members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
