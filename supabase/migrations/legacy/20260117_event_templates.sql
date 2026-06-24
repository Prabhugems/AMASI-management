-- Beautiful Message Templates for Events
-- Professional templates for medical conferences and events
--
-- IDEMPOTENCY GUARD (added 2026-06-24): the body below was originally a
-- DELETE+INSERT, which means a `supabase db push` from a fresh clone (or a
-- rebuild that doesn't know this is already applied) would WIPE every
-- admin-customized message template for the 121 FMAS event before re-seeding
-- the defaults. The DO/IF NOT EXISTS wrapper makes the migration a no-op on
-- any environment where templates already exist for this event_id, so the
-- destructive DELETE can never fire a second time. See companion migration
-- 20260624010000_register_legacy_20260117_migrations.sql which also marks
-- this file as applied in supabase_migrations.schema_migrations.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM message_templates
    WHERE event_id = 'eadf8aa1-9e1d-4f96-b755-217289518709'
  ) THEN
    -- Delete existing event-specific templates for clean insert
    -- (kept inside the guard for symmetry; with the guard this is a no-op
    -- against an empty set, but it preserves the original intent in the
    -- only legitimate "first run" case.)
    DELETE FROM message_templates WHERE event_id = 'eadf8aa1-9e1d-4f96-b755-217289518709';

    -- Insert beautiful templates for 121 FMAS event
    INSERT INTO message_templates (event_id, name, description, channel, email_subject, email_body, message_body, variables, is_system, is_active) VALUES

-- 1. Welcome & Registration Confirmation
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Welcome - Registration Confirmed',
 'Sent immediately after successful registration',
 'email',
 '🎉 Welcome to 121 FMAS, {{name}}! Your Registration is Confirmed',
 'Dear Dr. {{name}},

Greetings from the Association of Minimal Access Surgeons of India (AMASI)!

We are thrilled to confirm your registration for the 121st FMAS (Fellowship in Minimal Access Surgery) Program.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REGISTRATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Event: 121 FMAS
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 WHAT''S NEXT?

1️⃣ Save the date in your calendar
2️⃣ Prepare your travel arrangements
3️⃣ Review the scientific program (coming soon)
4️⃣ Connect with fellow delegates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

We look forward to your active participation in advancing minimal access surgery education.

For any queries, please contact us at info@amasi.org

Warm regards,
The AMASI Organizing Committee

---
"Advancing Surgical Excellence Through Education"',
 NULL,
 '["name", "registration_id", "event_date", "venue"]',
 false, true),

-- 2. WhatsApp Welcome
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'WhatsApp - Registration Confirmed',
 'WhatsApp message after registration',
 'whatsapp',
 NULL,
 NULL,
 '🎉 *Welcome to 121 FMAS!*

Dear Dr. {{name}},

Your registration is confirmed! ✅

📋 *Details:*
• Reg ID: {{registration_id}}
• Date: {{event_date}}
• Venue: {{venue}}

We look forward to seeing you!

_Team AMASI_',
 '["name", "registration_id", "event_date", "venue"]',
 false, true),

-- 3. Event Reminder - 7 Days
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Reminder - 7 Days to Go',
 'Reminder sent 7 days before event',
 'email',
 '⏰ 7 Days to Go! 121 FMAS Awaits You, {{name}}',
 'Dear Dr. {{name}},

The countdown has begun! 🎯

121 FMAS is just ONE WEEK away, and we can''t wait to welcome you.

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
☐ Download the event app (if available)
☐ Connect with speakers on the portal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏨 ACCOMMODATION

If you haven''t booked your stay yet, we have special rates at partner hotels. Contact us for details.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you in 7 days!

Best regards,
AMASI Organizing Committee',
 NULL,
 '["name", "registration_id", "event_date", "venue"]',
 false, true),

-- 4. Event Reminder - 1 Day (Tomorrow)
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Reminder - Event Tomorrow!',
 'Reminder sent 1 day before event',
 'all',
 '🔔 Tomorrow is the Day! 121 FMAS Final Reminder',
 'Dear Dr. {{name}},

This is your final reminder! 121 FMAS begins TOMORROW!

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
✓ Notebook/tablet for notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚗 DIRECTIONS

[Venue Address]
Google Maps: [Link will be shared]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See you tomorrow! 🎉

Warm regards,
AMASI Team',
 '🔔 *Tomorrow: 121 FMAS!*

Dear Dr. {{name}},

Final reminder! Event starts tomorrow.

📍 *Details:*
• Date: {{event_date}}
• Venue: {{venue}}
• Registration: 8:00 AM
• Inauguration: 9:00 AM

✅ *Bring:*
• Photo ID
• Confirmation email

See you there! 🎯

_Team AMASI_',
 '["name", "event_date", "venue"]',
 false, true),

-- 5. Speaker/Faculty Invitation
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Faculty Invitation - Speak at 121 FMAS',
 'Invitation to speakers and faculty members',
 'email',
 '🎤 Invitation to Speak at 121 FMAS - {{name}}',
 'Dear Dr. {{name}},

Warm Greetings from AMASI!

On behalf of the Scientific Committee, we are honored to invite you as a distinguished faculty member for the 121st FMAS Program.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 EVENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: 121 FMAS
Date: {{event_date}}
Venue: {{venue}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 YOUR SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Topic: {{session_name}}
Date: {{session_date}}
Time: {{session_time}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your expertise in the field would immensely benefit our delegates and contribute to advancing surgical education in India.

🌟 AS A FACULTY MEMBER, YOU WILL RECEIVE:

✓ Complimentary registration
✓ Travel assistance (as per AMASI policy)
✓ Accommodation arrangement
✓ Certificate of appreciation
✓ Faculty dinner invitation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please confirm your participation by clicking the button below. You can also submit your travel requirements through your Speaker Portal.

We sincerely hope you will accept this invitation and join us in making 121 FMAS a grand success.

With warm regards,

Dr. [Scientific Chairman]
Scientific Chairman, 121 FMAS

Dr. [Organizing Chairman]
Organizing Chairman, 121 FMAS',
 NULL,
 '["name", "event_date", "venue", "session_name", "session_date", "session_time"]',
 false, true),

-- 6. Payment Reminder
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Payment Reminder - Complete Registration',
 'Reminder for pending payment',
 'all',
 '⚠️ Action Required: Complete Your 121 FMAS Registration Payment',
 'Dear Dr. {{name}},

We noticed that your registration payment for 121 FMAS is still pending.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 PAYMENT DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Registration ID: {{registration_id}}
Amount Due: ₹{{amount}}
Payment Deadline: {{deadline}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ COMPLETE YOUR PAYMENT NOW

Click below to complete your payment securely:
[Payment Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 PAYMENT OPTIONS

• Credit/Debit Card
• UPI (Google Pay, PhonePe, Paytm)
• Net Banking
• Bank Transfer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Secure your spot before seats fill up! Limited seats available.

For payment assistance, contact: finance@amasi.org

Best regards,
AMASI Registration Team',
 '⚠️ *Payment Reminder*

Dear Dr. {{name}},

Your 121 FMAS registration payment is pending.

💳 *Details:*
• Amount: ₹{{amount}}
• Deadline: {{deadline}}

Please complete payment to confirm your seat.

Need help? Reply to this message.

_Team AMASI_',
 '["name", "registration_id", "amount", "deadline"]',
 false, true),

-- 7. Certificate Ready
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Certificate Ready - Download Now',
 'Notification when certificate is generated',
 'all',
 '🎓 Your 121 FMAS Certificate is Ready, {{name}}!',
 'Dear Dr. {{name}},

Congratulations on successfully completing the 121 FMAS Program! 🎉

Your Certificate of Participation is now ready for download.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📜 CERTIFICATE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Event: 121 FMAS
Date: {{event_date}}
Certificate Type: Participation Certificate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⬇️ DOWNLOAD YOUR CERTIFICATE

Click the button below to download your certificate:
[Download Certificate]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for being part of this enriching educational experience. We hope the knowledge and connections you gained will serve you well in your surgical practice.

We look forward to seeing you at future AMASI events!

With best wishes,
AMASI Team

---
"Advancing Surgical Excellence Through Education"',
 '🎓 *Certificate Ready!*

Dear Dr. {{name}},

Congratulations! Your 121 FMAS participation certificate is ready.

📜 Download from your portal or check your email.

Thank you for joining us!

_Team AMASI_',
 '["name", "event_date"]',
 false, true),

-- 8. Thank You - Post Event
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Thank You - Post Event',
 'Thank you message sent after event concludes',
 'email',
 '🙏 Thank You for Attending 121 FMAS, {{name}}!',
 'Dear Dr. {{name}},

Thank you for being part of the 121 FMAS Program!

Your presence and participation made this event truly special. We hope the sessions provided valuable insights and the networking opportunities were fruitful.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EVENT HIGHLIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 25+ Distinguished Faculty
• 15+ Scientific Sessions
• 200+ Delegates
• Hands-on Workshops

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 WE VALUE YOUR FEEDBACK

Help us improve! Please take 2 minutes to share your experience:
[Feedback Form Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📸 EVENT PHOTOS & VIDEOS

Relive the moments! Access photos and videos:
[Gallery Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 CERTIFICATE

Your participation certificate will be emailed within 7 days.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗓️ UPCOMING EVENTS

Stay connected for future AMASI events and CME programs.
Follow us: @AMASI_India

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Until we meet again!

With gratitude,
AMASI Organizing Committee

---
"Advancing Surgical Excellence Through Education"',
 NULL,
 '["name"]',
 false, true),

-- 9. Travel Details Request
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'Travel Details Request',
 'Request travel information from speakers',
 'email',
 '✈️ Submit Your Travel Details for 121 FMAS',
 'Dear Dr. {{name}},

Thank you for confirming your participation as faculty at 121 FMAS!

To assist you with travel arrangements, please submit your travel details at your earliest convenience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 REQUIRED INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✈️ Flight Preferences:
• Departure city
• Preferred travel dates
• Flight timing preferences (morning/evening)

🏨 Accommodation:
• Check-in date
• Check-out date
• Room preferences
• Any special requirements

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ DEADLINE

Please submit your details by: {{deadline}}

This helps us book the best options for you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 SUBMIT NOW

Click below to access your Speaker Portal:
[Speaker Portal Link]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For any queries, contact: travel@amasi.org

Best regards,
AMASI Travel Desk',
 NULL,
 '["name", "deadline"]',
 false, true),

-- 10. General Announcement
('eadf8aa1-9e1d-4f96-b755-217289518709',
 'General Announcement',
 'Template for general announcements',
 'all',
 '📢 Important Update: 121 FMAS',
 'Dear Dr. {{name}},

We have an important update regarding 121 FMAS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📢 ANNOUNCEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Your announcement content here]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For queries, contact: info@amasi.org

Best regards,
AMASI Team',
 '📢 *Important Update*

Dear Dr. {{name}},

[Your announcement here]

For queries, contact us.

_Team AMASI_',
 '["name"]',
 false, true);
  END IF;
END $$;

-- Verify insertion (runs unconditionally; harmless on any state)
SELECT name, channel, is_active FROM message_templates
WHERE event_id = 'eadf8aa1-9e1d-4f96-b755-217289518709'
ORDER BY name;
