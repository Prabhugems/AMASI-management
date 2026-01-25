-- Create waitlist table for sold-out events
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID REFERENCES ticket_types(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  position INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'converted', 'expired', 'cancelled')),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_waitlist_event_id ON waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_event_ticket ON waitlist(event_id, ticket_type_id);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_entry
ON waitlist(event_id, email, COALESCE(ticket_type_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_waitlist_updated_at ON waitlist;
CREATE TRIGGER trigger_waitlist_updated_at
  BEFORE UPDATE ON waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_waitlist_updated_at();

-- RLS policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow insert for anyone (public waitlist join)
CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Allow read for admins and the user themselves
CREATE POLICY "Users can view their own waitlist entries" ON waitlist
  FOR SELECT USING (
    auth.email() = email OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.platform_role IN ('super_admin', 'admin')
    )
  );

-- Allow update/delete for admins only
CREATE POLICY "Admins can update waitlist" ON waitlist
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.platform_role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete waitlist entries" ON waitlist
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.platform_role IN ('super_admin', 'admin')
    )
  );

COMMENT ON TABLE waitlist IS 'Waitlist for sold-out events or tickets';
COMMENT ON COLUMN waitlist.position IS 'Position in the waitlist queue';
COMMENT ON COLUMN waitlist.status IS 'waiting=in queue, notified=spot available notification sent, converted=registered, expired=notification expired, cancelled=user cancelled';
