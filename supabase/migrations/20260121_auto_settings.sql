-- Add automation settings to event_settings table
-- These control automatic actions after registration/payment

ALTER TABLE event_settings
ADD COLUMN IF NOT EXISTS auto_send_receipt BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_generate_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_email_badge BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN event_settings.auto_send_receipt IS 'Automatically send confirmation/receipt email after payment';
COMMENT ON COLUMN event_settings.auto_generate_badge IS 'Automatically generate badge when registration is confirmed (requires default badge template)';
COMMENT ON COLUMN event_settings.auto_email_badge IS 'Email badge download link to attendee after generation';
