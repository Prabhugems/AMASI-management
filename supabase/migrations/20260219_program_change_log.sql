-- Program Change Log table for tracking speaker swaps and other program changes
CREATE TABLE IF NOT EXISTS program_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL DEFAULT 'speaker_swap',
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  session_name TEXT,
  assignment_id UUID REFERENCES faculty_assignments(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  summary TEXT,
  changed_by_email TEXT,
  changed_by_name TEXT,
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_type TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_program_change_log_event_id ON program_change_log(event_id);
CREATE INDEX IF NOT EXISTS idx_program_change_log_session_id ON program_change_log(session_id);
CREATE INDEX IF NOT EXISTS idx_program_change_log_event_created ON program_change_log(event_id, created_at DESC);

-- RLS
ALTER TABLE program_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to program_change_log"
  ON program_change_log FOR ALL
  USING (true)
  WITH CHECK (true);
