-- Add auto-certificate settings to event_settings table
ALTER TABLE event_settings
ADD COLUMN IF NOT EXISTS auto_generate_certificate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_email_certificate BOOLEAN DEFAULT false;

-- Add certificate tracking to registrations table
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS certificate_url TEXT,
ADD COLUMN IF NOT EXISTS certificate_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS certificate_template_id UUID REFERENCES certificate_templates(id);

-- Add comments for documentation
COMMENT ON COLUMN event_settings.auto_generate_certificate IS 'Automatically generate certificate when registration is confirmed (requires default certificate template)';
COMMENT ON COLUMN event_settings.auto_email_certificate IS 'Email certificate to attendee after generation';
COMMENT ON COLUMN registrations.certificate_url IS 'URL of the generated certificate PDF';
COMMENT ON COLUMN registrations.certificate_generated_at IS 'Timestamp when certificate was generated';
COMMENT ON COLUMN registrations.certificate_template_id IS 'Certificate template used for generation';

-- Create index for certificate queries
CREATE INDEX IF NOT EXISTS idx_registrations_certificate ON registrations(certificate_url) WHERE certificate_url IS NOT NULL;
