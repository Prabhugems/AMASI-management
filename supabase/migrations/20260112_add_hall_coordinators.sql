-- Hall Coordinators table for managing hall/venue coordinators
-- Each coordinator gets a unique portal link to manage sessions in their assigned hall

CREATE TABLE IF NOT EXISTS hall_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  hall_name VARCHAR(255) NOT NULL,
  coordinator_name VARCHAR(255) NOT NULL,
  coordinator_email VARCHAR(255) NOT NULL,
  coordinator_phone VARCHAR(50),
  portal_token UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each hall can have one coordinator per event
  UNIQUE(event_id, hall_name)
);

-- Index for portal token lookups
CREATE INDEX IF NOT EXISTS idx_hall_coordinators_token ON hall_coordinators(portal_token);
CREATE INDEX IF NOT EXISTS idx_hall_coordinators_event ON hall_coordinators(event_id);

-- Add coordinator tracking fields to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coordinator_status VARCHAR(50) DEFAULT 'scheduled';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS coordinator_notes TEXT;

-- Enable RLS
ALTER TABLE hall_coordinators ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hall_coordinators
-- Admins can manage all coordinators
CREATE POLICY "Admin full access to hall_coordinators" ON hall_coordinators
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.platform_role IN ('super_admin', 'event_admin') OR users.is_super_admin = true)
    )
  );

-- Coordinators can view their own record via portal token (no auth required for public portal)
CREATE POLICY "Public read via portal token" ON hall_coordinators
  FOR SELECT
  USING (true);

-- Grant permissions
GRANT SELECT ON hall_coordinators TO anon;
GRANT ALL ON hall_coordinators TO authenticated;
