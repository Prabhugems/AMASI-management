-- Email Templates Table
-- Stores customizable email templates for different event communications

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,

  -- Template identification
  name VARCHAR(100) NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- registration_confirmation, payment_receipt, badge_email, certificate_email, speaker_invitation, speaker_reminder, custom

  -- Email content
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT, -- Plain text fallback

  -- Settings
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Default template for this type

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure unique default per event and type
  UNIQUE(event_id, template_type, is_default) WHERE is_default = true
);

-- Index for faster lookups
CREATE INDEX idx_email_templates_event ON email_templates(event_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_email_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_templates_updated
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_timestamp();

-- Default system templates (global, event_id = NULL)
INSERT INTO email_templates (event_id, name, template_type, subject, body_html, is_default) VALUES
(NULL, 'Registration Confirmation', 'registration_confirmation',
'Registration Confirmed - {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">Registration Confirmed!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{attendee_name}}</strong>,</p>
    <p>Thank you for registering for <strong>{{event_name}}</strong>.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #374151;">Registration Details</h3>
      <p><strong>Registration #:</strong> {{registration_number}}</p>
      <p><strong>Ticket Type:</strong> {{ticket_type}}</p>
      <p><strong>Amount Paid:</strong> {{amount}}</p>
    </div>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #374151;">Event Details</h3>
      <p><strong>Date:</strong> {{event_date}}</p>
      <p><strong>Venue:</strong> {{venue_name}}</p>
      <p><strong>Location:</strong> {{venue_address}}</p>
    </div>

    <p>Please keep this email for your records. You will receive your event badge closer to the event date.</p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      If you have any questions, please contact us at {{organizer_email}}.
    </p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true),

(NULL, 'Payment Receipt', 'payment_receipt',
'Payment Receipt - {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #059669; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">Payment Received</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{attendee_name}}</strong>,</p>
    <p>We have received your payment for <strong>{{event_name}}</strong>.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin-top: 0; color: #374151;">Payment Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Registration #</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{registration_number}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Ticket Type</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{ticket_type}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Amount</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Payment ID</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">{{payment_id}}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Status</strong></td>
          <td style="padding: 8px 0; text-align: right; color: #059669;"><strong>PAID</strong></td>
        </tr>
      </table>
    </div>

    <p style="color: #6b7280; font-size: 14px;">This email serves as your payment receipt.</p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true),

(NULL, 'Badge Email', 'badge_email',
'Your Event Badge - {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">Your Badge is Ready!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{attendee_name}}</strong>,</p>
    <p>Your badge for <strong>{{event_name}}</strong> is ready for download.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{badge_url}}" style="background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Download Badge
      </a>
    </div>

    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>Tip:</strong> Print your badge at home and bring it to the event for faster check-in!
      </p>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      If the button doesn''t work, copy this link: {{badge_url}}
    </p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true),

(NULL, 'Certificate Email', 'certificate_email',
'Your Certificate - {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">Congratulations!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{attendee_name}}</strong>,</p>
    <p>Thank you for attending <strong>{{event_name}}</strong>. Your certificate of participation is ready!</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{certificate_url}}" style="background: #f59e0b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Download Certificate
      </a>
    </div>

    <p>We hope you found the event valuable. We look forward to seeing you at our future events!</p>

    <p style="color: #6b7280; font-size: 14px;">
      If the button doesn''t work, copy this link: {{certificate_url}}
    </p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true),

(NULL, 'Speaker Invitation', 'speaker_invitation',
'Invitation to Speak at {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">You''re Invited to Speak!</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{speaker_name}}</strong>,</p>
    <p>We are delighted to invite you to speak at <strong>{{event_name}}</strong>.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
      <h3 style="margin-top: 0; color: #374151;">Session Details</h3>
      <p><strong>Session:</strong> {{session_name}}</p>
      <p><strong>Role:</strong> {{speaker_role}}</p>
      <p><strong>Date:</strong> {{session_date}}</p>
      <p><strong>Time:</strong> {{session_time}}</p>
      <p><strong>Venue:</strong> {{hall_name}}</p>
    </div>

    <p>Please confirm your participation by clicking the button below:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{response_url}}" style="background: #8b5cf6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Respond to Invitation
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      If you have any questions, please contact us at {{organizer_email}}.
    </p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true),

(NULL, 'Speaker Reminder', 'speaker_reminder',
'Reminder: Please Respond - {{event_name}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #dc2626; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">Response Needed</h1>
  </div>
  <div style="padding: 30px; background: #f9fafb;">
    <p>Dear <strong>{{speaker_name}}</strong>,</p>
    <p>This is a friendly reminder that we are awaiting your response for <strong>{{event_name}}</strong>.</p>

    <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
      <h3 style="margin-top: 0; color: #374151;">Session Details</h3>
      <p><strong>Session:</strong> {{session_name}}</p>
      <p><strong>Role:</strong> {{speaker_role}}</p>
      <p><strong>Date:</strong> {{session_date}}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{response_url}}" style="background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
        Respond Now
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">
      Please respond at your earliest convenience so we can finalize the program schedule.
    </p>
  </div>
  <div style="background: #1f2937; padding: 20px; text-align: center;">
    <p style="color: #9ca3af; margin: 0; font-size: 12px;">© {{year}} {{organizer_name}}. All rights reserved.</p>
  </div>
</div>',
true);

-- RLS Policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view email templates" ON email_templates
  FOR SELECT USING (
    event_id IS NULL OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.email = auth.jwt()->>'email'
      AND tm.is_active = true
    )
  );

CREATE POLICY "Admins can manage email templates" ON email_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.email = auth.jwt()->>'email'
      AND tm.is_active = true
      AND (tm.role LIKE '%admin%' OR tm.permissions @> '["manage_emails"]')
    )
  );
