-- Secure Check-in System (Tito-like)
-- Adds secure tokens for QR codes and staff access

-- 1. Add secure token to registrations (for attendee QR codes)
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS checkin_token VARCHAR(64) UNIQUE;

-- 2. Add access token to checkin_lists (for staff access without login)
ALTER TABLE checkin_lists
ADD COLUMN IF NOT EXISTS access_token VARCHAR(64) UNIQUE,
ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

-- 3. Create function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_secure_token(length INTEGER DEFAULT 32)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. Generate tokens for existing registrations that don't have one
UPDATE registrations
SET checkin_token = generate_secure_token(32)
WHERE checkin_token IS NULL;

-- 5. Generate access tokens for existing checkin_lists
UPDATE checkin_lists
SET access_token = generate_secure_token(24)
WHERE access_token IS NULL;

-- 6. Create trigger to auto-generate checkin_token for new registrations
CREATE OR REPLACE FUNCTION set_registration_checkin_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.checkin_token IS NULL THEN
    NEW.checkin_token := generate_secure_token(32);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_registration_checkin_token ON registrations;
CREATE TRIGGER trigger_set_registration_checkin_token
  BEFORE INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION set_registration_checkin_token();

-- 7. Create trigger to auto-generate access_token for new checkin_lists
CREATE OR REPLACE FUNCTION set_checkin_list_access_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.access_token IS NULL THEN
    NEW.access_token := generate_secure_token(24);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_checkin_list_access_token ON checkin_lists;
CREATE TRIGGER trigger_set_checkin_list_access_token
  BEFORE INSERT ON checkin_lists
  FOR EACH ROW
  EXECUTE FUNCTION set_checkin_list_access_token();

-- 8. Add index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_registrations_checkin_token ON registrations(checkin_token);
CREATE INDEX IF NOT EXISTS idx_checkin_lists_access_token ON checkin_lists(access_token);

-- 9. Add checkin audit log table for complete tracking
CREATE TABLE IF NOT EXISTS checkin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  checkin_list_id UUID REFERENCES checkin_lists(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL, -- 'check_in', 'check_out', 'manual_override'
  performed_by TEXT, -- staff name/identifier
  performed_via VARCHAR(20), -- 'qr_scan', 'manual', 'bulk', 'kiosk'
  device_info JSONB, -- user agent, IP, etc.
  token_used VARCHAR(64), -- which token was scanned
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkin_audit_event ON checkin_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_checkin_audit_registration ON checkin_audit_log(registration_id);
CREATE INDEX IF NOT EXISTS idx_checkin_audit_created ON checkin_audit_log(created_at);
