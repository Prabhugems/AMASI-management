-- Device tokens for kiosk/print station mode
-- Long-lived tokens that authenticate devices without human login

CREATE TABLE IF NOT EXISTS team_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  module TEXT NOT NULL DEFAULT 'print_station',
  event_ids UUID[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by UUID REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON team_device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_status ON team_device_tokens(status);

-- RLS: only service_role (admin client) can access device tokens
ALTER TABLE team_device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to device tokens"
  ON team_device_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
