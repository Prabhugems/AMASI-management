-- Access logging for module-level tracking
CREATE TABLE IF NOT EXISTS team_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  module TEXT NOT NULL,  -- e.g., 'registrations', 'speakers', 'flights'
  event_id UUID,
  path TEXT,             -- full URL path accessed
  method TEXT DEFAULT 'PAGE_VIEW',  -- PAGE_VIEW or API method (GET, POST, etc.)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_team_access_logs_user_id ON team_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_team_access_logs_module ON team_access_logs(module);
CREATE INDEX IF NOT EXISTS idx_team_access_logs_event_id ON team_access_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_team_access_logs_created_at ON team_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_access_logs_user_module ON team_access_logs(user_id, module);

-- RLS
ALTER TABLE team_access_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (API routes use admin client)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_full_access_team_access_logs') THEN
    CREATE POLICY service_role_full_access_team_access_logs ON team_access_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Authenticated users can read their own logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_own_team_access_logs') THEN
    CREATE POLICY authenticated_read_own_team_access_logs ON team_access_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- Auto-cleanup: delete logs older than 90 days (optional, can be run as a cron)
-- CREATE INDEX IF NOT EXISTS idx_team_access_logs_cleanup ON team_access_logs(created_at) WHERE created_at < NOW() - INTERVAL '90 days';
