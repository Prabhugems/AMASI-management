-- Ensure user_id column exists (may have been added via dashboard)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Timezone for international team members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- Structured tags for searchable categorization
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Backup/deputy member for event-day coverage
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS backup_member_id UUID REFERENCES team_members(id);
