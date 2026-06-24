-- Add auto-send functionality to message_templates
-- Allows templates to be automatically triggered on specific events

-- Add columns for auto-send configuration
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS auto_send BOOLEAN DEFAULT false;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS trigger_type TEXT;
-- Trigger types: 'on_registration', 'on_payment', 'on_checkin', 'days_before_event', 'on_certificate_ready'
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS trigger_value INT DEFAULT 0;
-- For 'days_before_event': number of days (e.g., 7 = 7 days before, 1 = 1 day before)

-- Create index for quick lookup of auto-send templates
CREATE INDEX IF NOT EXISTS idx_message_templates_auto_send ON message_templates(event_id, auto_send, trigger_type) WHERE auto_send = true;

-- Update existing templates with appropriate trigger types
UPDATE message_templates SET trigger_type = 'on_registration', trigger_value = 0
WHERE name LIKE '%Registration Confirmed%' AND trigger_type IS NULL;

UPDATE message_templates SET trigger_type = 'days_before_event', trigger_value = 7
WHERE name LIKE '%7 Days%' AND trigger_type IS NULL;

UPDATE message_templates SET trigger_type = 'days_before_event', trigger_value = 1
WHERE name LIKE '%Tomorrow%' AND trigger_type IS NULL;

UPDATE message_templates SET trigger_type = 'on_certificate_ready', trigger_value = 0
WHERE name LIKE '%Certificate Ready%' AND trigger_type IS NULL;

UPDATE message_templates SET trigger_type = 'manual', trigger_value = 0
WHERE trigger_type IS NULL;

-- Reload schema
NOTIFY pgrst, 'reload schema';
