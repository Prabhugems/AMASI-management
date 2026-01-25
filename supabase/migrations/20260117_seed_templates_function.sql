-- Function to seed templates for an event
-- This bypasses PostgREST cache issues

CREATE OR REPLACE FUNCTION seed_event_templates(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_name TEXT;
  v_count INT;
BEGIN
  -- Get event name
  SELECT COALESCE(short_name, name, 'Event') INTO v_event_name
  FROM events WHERE id = p_event_id;

  IF v_event_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Check if templates already exist
  SELECT COUNT(*) INTO v_count FROM message_templates WHERE event_id = p_event_id;
  IF v_count > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Templates already exist for this event');
  END IF;

  -- Insert templates
  INSERT INTO message_templates (event_id, name, description, channel, email_subject, email_body, message_body, variables, is_system, is_active)
  VALUES
  (p_event_id, 'Welcome - Registration Confirmed', 'Sent immediately after successful registration', 'email',
   '🎉 Welcome to ' || v_event_name || ', {{name}}! Your Registration is Confirmed',
   'Dear Dr. {{name}},

Greetings from AMASI!

We are thrilled to confirm your registration for ' || v_event_name || '.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REGISTRATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Event: ' || v_event_name || '
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 WHAT''S NEXT?

1️⃣ Save the date in your calendar
2️⃣ Prepare your travel arrangements
3️⃣ Review the scientific program (coming soon)
4️⃣ Connect with fellow delegates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We look forward to your active participation!

Warm regards,
The Organizing Committee',
   NULL, '["name", "registration_id", "event_date", "venue"]', false, true),

  (p_event_id, 'WhatsApp - Registration Confirmed', 'WhatsApp message after registration', 'whatsapp',
   NULL, NULL,
   '🎉 *Welcome to ' || v_event_name || '!*

Dear Dr. {{name}},

Your registration is confirmed! ✅

📋 *Details:*
• Reg ID: {{registration_id}}
• Date: {{event_date}}
• Venue: {{venue}}

We look forward to seeing you!

_Team AMASI_',
   '["name", "registration_id", "event_date", "venue"]', false, true),

  (p_event_id, 'Reminder - 7 Days to Go', 'Reminder sent 7 days before event', 'email',
   '⏰ 7 Days to Go! ' || v_event_name || ' Awaits You, {{name}}',
   'Dear Dr. {{name}},

The countdown has begun! 🎯

' || v_event_name || ' is just ONE WEEK away!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date: {{event_date}}
Venue: {{venue}}
Your Registration: {{registration_id}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PRE-EVENT CHECKLIST

☐ Confirm your travel bookings
☐ Pack your conference essentials
☐ Review the scientific program
☐ Download the event app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you in 7 days!

Best regards,
Organizing Committee',
   NULL, '["name", "registration_id", "event_date", "venue"]', false, true),

  (p_event_id, 'Reminder - Event Tomorrow!', 'Reminder sent 1 day before event', 'all',
   '🔔 Tomorrow is the Day! ' || v_event_name || ' Final Reminder',
   'Dear Dr. {{name}},

This is your final reminder! ' || v_event_name || ' begins TOMORROW!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 VENUE & TIMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: {{event_date}}
🏛️ Venue: {{venue}}
⏰ Registration Desk Opens: 8:00 AM
🎯 Inauguration: 9:00 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PLEASE BRING

✓ Government Photo ID
✓ Registration confirmation
✓ Business cards for networking

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you tomorrow! 🎉

Warm regards,
AMASI Team',
   '🔔 *Tomorrow: ' || v_event_name || '!*

Dear Dr. {{name}},

Final reminder! Event starts tomorrow.

📍 *Details:*
• Date: {{event_date}}
• Venue: {{venue}}
• Registration: 8:00 AM

✅ *Bring:*
• Photo ID
• Confirmation

See you there! 🎯

_Team AMASI_',
   '["name", "event_date", "venue"]', false, true),

  (p_event_id, 'Faculty Invitation', 'Invitation to speakers and faculty members', 'email',
   '🎤 Invitation to Speak at ' || v_event_name || ' - {{name}}',
   'Dear Dr. {{name}},

Warm Greetings from AMASI!

We are honored to invite you as a distinguished faculty member for ' || v_event_name || '.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: ' || v_event_name || '
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 YOUR SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: {{session_name}}
Date: {{session_date}}
Time: {{session_time}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌟 AS A FACULTY MEMBER, YOU WILL RECEIVE:

✓ Complimentary registration
✓ Travel assistance
✓ Accommodation arrangement
✓ Certificate of appreciation
✓ Faculty dinner invitation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please confirm your participation through your Speaker Portal.

With warm regards,
AMASI Scientific Committee',
   NULL, '["name", "event_date", "venue", "session_name", "session_date", "session_time"]', false, true),

  (p_event_id, 'Payment Reminder', 'Reminder for pending payment', 'all',
   '⚠️ Action Required: Complete Your ' || v_event_name || ' Registration Payment',
   'Dear Dr. {{name}},

We noticed that your registration payment for ' || v_event_name || ' is still pending.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Amount Due: ₹{{amount}}
Payment Deadline: {{deadline}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Secure your spot before seats fill up!

Best regards,
AMASI Registration Team',
   '⚠️ *Payment Reminder*

Dear Dr. {{name}},

Your ' || v_event_name || ' payment is pending.

💳 *Details:*
• Amount: ₹{{amount}}
• Deadline: {{deadline}}

Please complete payment to confirm your seat.

_Team AMASI_',
   '["name", "registration_id", "amount", "deadline"]', false, true),

  (p_event_id, 'Certificate Ready', 'Notification when certificate is generated', 'all',
   '🎓 Your ' || v_event_name || ' Certificate is Ready, {{name}}!',
   'Dear Dr. {{name}},

Congratulations on completing ' || v_event_name || '! 🎉

Your Certificate of Participation is now ready for download.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 CERTIFICATE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: ' || v_event_name || '
Date: {{event_date}}
Certificate Type: Participation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Download your certificate from your portal.

With best wishes,
AMASI Team',
   '🎓 *Certificate Ready!*

Dear Dr. {{name}},

Your ' || v_event_name || ' certificate is ready.

📜 Download from your portal.

Thank you for joining us!

_Team AMASI_',
   '["name", "event_date"]', false, true),

  (p_event_id, 'Thank You - Post Event', 'Thank you message after event', 'email',
   '🙏 Thank You for Attending ' || v_event_name || ', {{name}}!',
   'Dear Dr. {{name}},

Thank you for being part of ' || v_event_name || '!

Your presence made this event truly special.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 WE VALUE YOUR FEEDBACK

Help us improve! Share your experience:
[Feedback Form Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 CERTIFICATE

Your participation certificate will be emailed within 7 days.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Until we meet again!

With gratitude,
AMASI Organizing Committee',
   NULL, '["name"]', false, true),

  (p_event_id, 'SMS - Quick Reminder', 'Short SMS reminder', 'sms',
   NULL, NULL,
   'AMASI: Dear Dr. {{name}}, Reminder: ' || v_event_name || ' on {{event_date}} at {{venue}}. See you there! -AMASI',
   '["name", "event_date", "venue"]', false, true),

  (p_event_id, 'General Announcement', 'Template for general announcements', 'all',
   '📢 Important Update: ' || v_event_name,
   'Dear Dr. {{name}},

We have an important update regarding ' || v_event_name || '.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📢 ANNOUNCEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Your announcement content here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For queries, contact: info@amasi.org

Best regards,
AMASI Team',
   '📢 *Update: ' || v_event_name || '*

Dear Dr. {{name}},

[Your announcement here]

_Team AMASI_',
   '["name"]', false, true);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'message', 'Created ' || v_count || ' templates for ' || v_event_name, 'count', v_count);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION seed_event_templates(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_event_templates(UUID) TO service_role;
