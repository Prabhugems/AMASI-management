-- Track when delegates download their certificates
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS certificate_downloaded_at TIMESTAMPTZ;

COMMENT ON COLUMN registrations.certificate_downloaded_at IS 'Timestamp when the delegate first downloaded their certificate';

-- Index for querying download status
CREATE INDEX IF NOT EXISTS idx_registrations_certificate_downloaded ON registrations(certificate_downloaded_at) WHERE certificate_downloaded_at IS NOT NULL;
