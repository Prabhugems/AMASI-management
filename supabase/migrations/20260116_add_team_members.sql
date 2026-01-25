-- Team members table for role-based access
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'travel', -- travel, admin, coordinator, etc.
  notes TEXT,
  event_ids UUID[] DEFAULT '{}', -- Optional: restrict to specific events (empty = all events)
  permissions TEXT[] DEFAULT '{}', -- Module permissions: flights, hotels, transfers, trains (empty = all)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick email lookup
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);

-- Enable RLS
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read team members
CREATE POLICY "Allow authenticated read" ON team_members
  FOR SELECT TO authenticated USING (true);

-- Policy: Allow authenticated users to insert team members
CREATE POLICY "Allow authenticated insert" ON team_members
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow authenticated users to update team members
CREATE POLICY "Allow authenticated update" ON team_members
  FOR UPDATE TO authenticated USING (true);

-- Policy: Allow authenticated users to delete team members
CREATE POLICY "Allow authenticated delete" ON team_members
  FOR DELETE TO authenticated USING (true);

-- Policy: Allow service role full access
CREATE POLICY "Allow service role full access" ON team_members
  FOR ALL TO service_role USING (true);
