-- Abstract Drafts Table for Auto-Save
-- Date: 2026-03-13

CREATE TABLE IF NOT EXISTS abstract_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  draft_data JSONB NOT NULL,
  last_saved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, user_email)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_abstract_drafts_event_email ON abstract_drafts(event_id, user_email);
CREATE INDEX IF NOT EXISTS idx_abstract_drafts_expires ON abstract_drafts(expires_at);

-- RLS
ALTER TABLE abstract_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abstract_drafts_public_policy" ON abstract_drafts
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "abstract_drafts_auth_policy" ON abstract_drafts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function to auto-delete expired drafts (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_drafts()
RETURNS void AS $$
BEGIN
  DELETE FROM abstract_drafts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

SELECT 'Abstract drafts table created!' AS status;
