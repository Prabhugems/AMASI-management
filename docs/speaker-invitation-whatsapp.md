# Speaker Invitation - WhatsApp Template

## Overview
When a speaker invitation email is sent via `/api/email/speaker-invitation`, a WhatsApp message is also sent automatically (if Gallabox is configured).

## Gallabox Template Setup

### Template Name
```
speaker_invitation
```
(Configurable via env var: `GALLABOX_TEMPLATE_SPEAKER_INVITATION`)

### Template Parameters (Body)

| Parameter | Variable | Example |
|-----------|----------|---------|
| `{{1}}`   | Speaker Name | Dr. Prabhu |
| `{{2}}`   | Event Name | FMAS 2026 Annual Conference |
| `{{3}}`   | Portal URL | https://collegeofmas.org.in/speaker/abc-123-token |

### Sample Template Message

```
Hello {{1}},

You are cordially invited to speak at *{{2}}*.

We are honored to have you share your expertise and insights at our event. Please use the link below to view your session details and respond to this invitation:

{{3}}

Through the portal you can:
- Accept or decline the invitation
- View your assigned sessions
- Request travel & accommodation assistance
- Update your contact information

Please respond at your earliest convenience so we can finalize the event schedule.

Warm regards,
AMASI Organizing Committee
```

### Template Category
- **Category**: UTILITY (transactional)
- **Language**: English (en)

## How It Works

### Flow
1. Admin sends speaker invitation from the Speakers page
2. API route `POST /api/email/speaker-invitation` is called
3. Email is sent via Blastable/Resend
4. If Gallabox is configured, WhatsApp template message is sent (non-blocking)
5. Registration `custom_fields` is updated with invitation status

### Code Location
- **API Route**: `src/app/api/email/speaker-invitation/route.ts`
- **Gallabox Helper**: `src/lib/gallabox.ts`
- **WhatsApp Service**: `src/lib/services/whatsapp.ts`

### Relevant Code (from route.ts)
```typescript
const templateName = (process.env.GALLABOX_TEMPLATE_SPEAKER_INVITATION || "speaker_invitation").trim()
const waResult = await sendGallaboxTemplate(
  reg.attendee_phone,
  speaker_name || "Speaker",
  templateName,
  { "1": speaker_name, "2": event_name, "3": portalUrl }
)
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GALLABOX_API_KEY` | Yes | - | Gallabox API key |
| `GALLABOX_API_SECRET` | Yes | - | Gallabox API secret |
| `GALLABOX_CHANNEL_ID` | Yes | - | WhatsApp channel ID |
| `GALLABOX_TEMPLATE_SPEAKER_INVITATION` | No | `speaker_invitation` | Template name in Gallabox |

## Steps to Enable

1. **Create template in Gallabox Dashboard**
   - Go to Gallabox > Templates > Create Template
   - Name: `speaker_invitation`
   - Category: Utility
   - Language: English
   - Add the message body with `{{1}}`, `{{2}}`, `{{3}}` parameters
   - Submit for WhatsApp approval

2. **Set environment variables in Vercel**
   ```
   GALLABOX_API_KEY=your-api-key
   GALLABOX_API_SECRET=your-api-secret
   GALLABOX_CHANNEL_ID=your-channel-id
   ```

3. **Redeploy** the app on Vercel

4. **Test** by sending a speaker invitation from the Speakers page

## Notes
- WhatsApp sending is **non-blocking** - if it fails, the email still goes through
- Phone numbers are auto-formatted: 10-digit numbers get `91` prefix (India)
- The portal URL sent via WhatsApp is the **full URL** (not shortened), since WhatsApp templates have character limits for URL parameters
- Template must be **approved by WhatsApp** before it can be sent via Gallabox
