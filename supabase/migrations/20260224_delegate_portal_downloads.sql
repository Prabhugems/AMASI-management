-- Track delegate portal downloads (badge, certificate, invitation, receipt)
CREATE TABLE IF NOT EXISTS delegate_portal_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  download_type TEXT NOT NULL CHECK (download_type IN ('badge', 'certificate', 'invitation', 'receipt')),
  downloaded_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_delegate_portal_downloads_event_id ON delegate_portal_downloads(event_id);
CREATE INDEX IF NOT EXISTS idx_delegate_portal_downloads_registration_id ON delegate_portal_downloads(registration_id);
CREATE INDEX IF NOT EXISTS idx_delegate_portal_downloads_type ON delegate_portal_downloads(download_type);

-- Track when a delegate downloads their own badge from the portal
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS badge_downloaded_by_delegate_at TIMESTAMPTZ;
