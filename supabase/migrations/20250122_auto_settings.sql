-- Auto Receipt & Auto Badge Settings
-- Add automation toggles to event_settings table

ALTER TABLE event_settings
ADD COLUMN IF NOT EXISTS auto_send_receipt BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_generate_badge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_email_badge BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN event_settings.auto_send_receipt IS 'Automatically send confirmation email after payment';
COMMENT ON COLUMN event_settings.auto_generate_badge IS 'Automatically generate badge when registration is confirmed';
COMMENT ON COLUMN event_settings.auto_email_badge IS 'Automatically email badge to attendee after generation';
