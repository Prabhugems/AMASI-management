-- Email tracking table for YAMM-like functionality
-- Tracks: sent, delivered, opened, clicked, bounced, complained

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resend email ID for webhook matching
  resend_email_id TEXT UNIQUE,

  -- Email details
  email_type TEXT NOT NULL, -- 'registration_confirmation', 'speaker_invitation', 'travel_itinerary', 'travel_request', etc.
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- Related entities
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,

  -- Tracking status
  status TEXT NOT NULL DEFAULT 'sent', -- sent, delivered, opened, clicked, bounced, complained, failed

  -- Tracking timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  first_clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  complained_at TIMESTAMPTZ,

  -- Tracking counts
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Click tracking details
  clicked_links JSONB DEFAULT '[]'::jsonb, -- Array of {url, clicked_at}

  -- Error details (for bounced/failed)
  error_message TEXT,
  bounce_type TEXT, -- hard, soft

  -- Response tracking (for forms/actions)
  responded_at TIMESTAMPTZ,
  response_type TEXT, -- 'form_submitted', 'travel_details_submitted', etc.

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON email_logs(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_event_id ON email_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_registration_id ON email_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (admins)
CREATE POLICY "Admins can view all email logs" ON email_logs
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update email logs" ON email_logs
  FOR UPDATE USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_email_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_email_logs_updated_at();

-- View for email statistics per event
CREATE OR REPLACE VIEW email_stats_by_event AS
SELECT
  event_id,
  email_type,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'delivered' OR delivered_at IS NOT NULL) as delivered,
  COUNT(*) FILTER (WHERE status = 'opened' OR opened_at IS NOT NULL) as opened,
  COUNT(*) FILTER (WHERE status = 'clicked' OR clicked_at IS NOT NULL) as clicked,
  COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
  COUNT(*) FILTER (WHERE responded_at IS NOT NULL) as responded,
  ROUND(COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as open_rate,
  ROUND(COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as click_rate
FROM email_logs
GROUP BY event_id, email_type;
