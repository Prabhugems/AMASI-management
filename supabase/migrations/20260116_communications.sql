-- Communications Hub Tables
-- Supports Email, WhatsApp, SMS, and Custom Webhooks with per-event credentials

-- 1. Communication Settings (per-event integration credentials)
CREATE TABLE IF NOT EXISTS communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,

  -- Email Provider Configuration
  email_provider TEXT DEFAULT 'default', -- 'default' | 'resend' | 'blastable' | 'sendgrid'
  email_api_key TEXT,
  email_from_address TEXT,
  email_from_name TEXT,

  -- WhatsApp Provider Configuration
  whatsapp_provider TEXT, -- 'meta' | 'twilio' | 'interakt' | 'wati'
  whatsapp_api_key TEXT,
  whatsapp_phone_number_id TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_access_token TEXT,

  -- SMS Provider Configuration
  sms_provider TEXT, -- 'twilio' | 'msg91' | 'textlocal'
  sms_api_key TEXT,
  sms_sender_id TEXT,
  sms_auth_token TEXT,

  -- Twilio (shared for WhatsApp and SMS)
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,

  -- Custom Webhook Configuration
  webhook_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  webhook_headers JSONB DEFAULT '{}',

  -- Channel Toggles
  channels_enabled JSONB DEFAULT '{"email": true, "whatsapp": false, "sms": false, "webhook": false}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(event_id)
);

-- 2. Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  channel TEXT NOT NULL, -- 'email' | 'whatsapp' | 'sms' | 'all'

  -- Email specific fields
  email_subject TEXT,
  email_body TEXT,

  -- WhatsApp/SMS message body
  message_body TEXT,

  -- WhatsApp template (for Meta API pre-approved templates)
  whatsapp_template_name TEXT,
  whatsapp_template_namespace TEXT,
  whatsapp_template_language TEXT DEFAULT 'en',

  -- Template variables (for personalization)
  variables JSONB DEFAULT '[]', -- ['name', 'event_name', 'date', 'ticket_type']

  -- Metadata
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Message Logs (unified logging for all channels)
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES registrations(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,

  -- Channel & Provider
  channel TEXT NOT NULL, -- 'email' | 'whatsapp' | 'sms' | 'webhook'
  provider TEXT, -- 'resend' | 'blastable' | 'twilio' | 'meta' | 'interakt' | 'wati' | 'msg91' | 'custom'

  -- Recipient info
  recipient TEXT NOT NULL, -- email address or phone number
  recipient_name TEXT,

  -- Message content
  subject TEXT, -- for email
  message_body TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending | queued | sent | delivered | read | failed | bounced
  provider_message_id TEXT,
  error_message TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_communication_settings_event_id ON communication_settings(event_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_event_id ON message_templates(event_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_channel ON message_templates(channel);
CREATE INDEX IF NOT EXISTS idx_message_logs_event_id ON message_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_registration_id ON message_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_channel ON message_logs(channel);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at DESC);

-- Enable RLS
ALTER TABLE communication_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users)
CREATE POLICY "Allow authenticated access to communication_settings" ON communication_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to message_templates" ON message_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to message_logs" ON message_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_communication_settings_updated_at
  BEFORE UPDATE ON communication_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system templates
INSERT INTO message_templates (event_id, name, description, channel, email_subject, email_body, message_body, variables, is_system) VALUES
(NULL, 'Registration Confirmation', 'Sent after successful registration', 'all',
 'Registration Confirmed - {{event_name}}',
 'Dear {{name}},\n\nYour registration for {{event_name}} has been confirmed.\n\nEvent Date: {{event_date}}\nVenue: {{venue}}\nRegistration ID: {{registration_id}}\n\nWe look forward to seeing you!\n\nBest regards,\nThe Organizing Team',
 'Hi {{name}}! Your registration for {{event_name}} on {{event_date}} is confirmed. Registration ID: {{registration_id}}. See you there!',
 '["name", "event_name", "event_date", "venue", "registration_id"]',
 true),

(NULL, 'Event Reminder', 'Reminder sent before the event', 'all',
 'Reminder: {{event_name}} is Tomorrow!',
 'Dear {{name}},\n\nThis is a friendly reminder that {{event_name}} is happening tomorrow!\n\nDate: {{event_date}}\nTime: {{event_time}}\nVenue: {{venue}}\n\nDon''t forget to bring your ID for check-in.\n\nSee you soon!',
 'Hi {{name}}! Reminder: {{event_name}} is tomorrow at {{event_time}}. Venue: {{venue}}. See you there!',
 '["name", "event_name", "event_date", "event_time", "venue"]',
 true),

(NULL, 'Speaker Invitation', 'Invitation sent to speakers/faculty', 'email',
 'Speaker Invitation - {{event_name}}',
 'Dear {{name}},\n\nWe are honored to invite you as a speaker at {{event_name}}.\n\nYour session: {{session_name}}\nDate: {{session_date}}\nTime: {{session_time}}\n\nPlease respond to this invitation using your speaker portal.\n\nBest regards,\nThe Organizing Team',
 NULL,
 '["name", "event_name", "session_name", "session_date", "session_time"]',
 true),

(NULL, 'Payment Reminder', 'Reminder for pending payments', 'all',
 'Payment Pending - {{event_name}}',
 'Dear {{name}},\n\nYour registration for {{event_name}} is pending payment.\n\nAmount Due: {{amount}}\nDeadline: {{deadline}}\n\nPlease complete your payment to confirm your spot.\n\nBest regards,\nThe Organizing Team',
 'Hi {{name}}! Your payment of {{amount}} for {{event_name}} is pending. Please pay by {{deadline}} to confirm your registration.',
 '["name", "event_name", "amount", "deadline"]',
 true),

(NULL, 'Certificate Ready', 'Notification when certificate is ready', 'all',
 'Your Certificate is Ready - {{event_name}}',
 'Dear {{name}},\n\nThank you for attending {{event_name}}!\n\nYour certificate of participation is now ready for download.\n\nBest regards,\nThe Organizing Team',
 'Hi {{name}}! Your certificate for {{event_name}} is ready. Check your email or portal to download it.',
 '["name", "event_name"]',
 true);

COMMENT ON TABLE communication_settings IS 'Per-event configuration for communication channels (Email, WhatsApp, SMS, Webhooks)';
COMMENT ON TABLE message_templates IS 'Reusable message templates for all communication channels';
COMMENT ON TABLE message_logs IS 'Unified log of all messages sent across all channels';
