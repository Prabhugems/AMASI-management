-- Activity Logs Table
-- Tracks all admin actions for audit trail

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  user_name VARCHAR(255),

  -- What was done
  action VARCHAR(100) NOT NULL, -- create, update, delete, send_email, generate_badge, check_in, etc.
  entity_type VARCHAR(50) NOT NULL, -- registration, event, ticket, badge, certificate, speaker, etc.
  entity_id UUID,
  entity_name VARCHAR(255), -- Human readable name for quick display

  -- Context
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_name VARCHAR(255),

  -- Details
  description TEXT, -- Human readable description
  metadata JSONB DEFAULT '{}', -- Additional context (old values, new values, etc.)

  -- Request info
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_activity_logs_event ON activity_logs(event_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- Composite index for filtering
CREATE INDEX idx_activity_logs_event_created ON activity_logs(event_id, created_at DESC);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all activity logs
CREATE POLICY "Admins can view activity logs" ON activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.email = auth.jwt()->>'email'
      AND tm.is_active = true
      AND (tm.role LIKE '%admin%' OR tm.permissions @> '["view_activity_logs"]')
    )
  );

-- Service role can insert logs
CREATE POLICY "Service can insert activity logs" ON activity_logs
  FOR INSERT WITH CHECK (true);

-- Create a function to automatically log changes
CREATE OR REPLACE FUNCTION log_activity(
  p_user_email VARCHAR,
  p_user_name VARCHAR,
  p_action VARCHAR,
  p_entity_type VARCHAR,
  p_entity_id UUID,
  p_entity_name VARCHAR,
  p_event_id UUID,
  p_event_name VARCHAR,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO activity_logs (
    user_email, user_name, action, entity_type, entity_id, entity_name,
    event_id, event_name, description, metadata
  ) VALUES (
    p_user_email, p_user_name, p_action, p_entity_type, p_entity_id, p_entity_name,
    p_event_id, p_event_name, p_description, p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
