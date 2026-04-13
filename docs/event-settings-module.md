# Event Settings Module

> Configure your event details and preferences

## Overview

The Event Settings page is the central configuration hub for each event. It manages everything from basic event info to branding, modules, automation, and advanced options. The page uses a sidebar tab navigation with a sticky save bar that appears when changes are detected.

**Page:** `src/app/events/[eventId]/settings/page.tsx`
**API:** `PATCH /api/events/[eventId]/settings` (event fields) + `POST /api/event-settings` (modules & automation)

---

## Sections & Fields

### 1. General

| Field | Type | Required | DB Column | Notes |
|-------|------|----------|-----------|-------|
| Event Name | Text | Yes | `name` | |
| Short Name | Text | No | `short_name` | Used in navigation/sidebar |
| Edition | Number | No | `edition` | e.g., 5th edition |
| URL Slug | Text | No | `slug` | Auto-lowercased, hyphens. Public URL: `/register/{slug}` |
| Description | Textarea | No | `description` | |
| Event Type | Select/Custom | No | `event_type` | Options: conference, workshop, seminar, webinar, symposium, summit, congress, meetup, or custom |
| Status | Select | No | `status` | draft, planning, ongoing, completed, cancelled |
| Organized By | Text | No | `organized_by` | Used in invitation letters as "organized by ..." |
| Scientific Chairman | Text | No | `scientific_chairman` | |
| Organizing Chairman | Text | No | `organizing_chairman` | |
| Signatory Title | Text | No | `signatory_title` | Label shown below signatory name in invitations (e.g., Course Convenor) |
| Signature Image | Image Upload | No | `signature_image_url` | PNG/JPG, rendered above name in invitation letters |

**Speaker Invitation Sub-section (nested in `settings` JSON):**

| Field | Type | Stored In |
|-------|------|-----------|
| Signer Name | Text | `settings.speaker_invitation.signer_name` |
| Signer Title | Text | `settings.speaker_invitation.signer_title` |
| Signature Image | Image Upload | `settings.speaker_invitation.signature_url` |

---

### 2. Date & Time

| Field | Type | DB Column |
|-------|------|-----------|
| Start Date | Date | `start_date` |
| End Date | Date | `end_date` |
| Timezone | Select | `timezone` |

**Timezone options:** Asia/Kolkata, UTC, America/New_York, America/Los_Angeles, Europe/London

---

### 3. Location

| Field | Type | DB Column |
|-------|------|-----------|
| Venue Name | Text | `venue_name` |
| City | Text | `city` |
| State | Text | `state` |
| Country | Select | `country` |

**Country options:** India, United States, United Kingdom, Singapore, UAE

---

### 4. Registration

| Field | Type | Default | DB Column |
|-------|------|---------|-----------|
| Public Event | Toggle | ON | `is_public` |
| Registration Open | Toggle | ON | `registration_open` |
| Maximum Attendees | Number | None | `max_attendees` |

- **Public Event** = visible to non-authenticated users
- **Registration Open** = accepts new registrations (independent of public visibility)
- Max attendees auto-closes registration when limit reached

---

### 5. Modules (20 toggles)

Stored in `event_settings` table. Saved separately via `POST /api/event-settings`.

| Category | Modules | Default |
|----------|---------|---------|
| **Event Operations** | Speakers, Program Schedule, Check-in, Badges, Certificates, Print Station | All ON |
| **Registration & Forms** | Add-ons, Waitlist, Custom Forms, Delegate Portal, Surveys, Leads | All ON |
| **Travel & Logistics** | Travel Management, Accommodation, Meals, Visa Assistance | All ON |
| **Finance & Sponsors** | Sponsors, Budget Tracking | All ON |
| **Advanced** | Abstracts, Examination | Both OFF |

**Actions:** Enable All, Disable All, Save by Category, Save All Modules

---

### 6. Automation

Stored in `event_settings` table. Saved separately via `POST /api/event-settings`.

| Setting | Default | Dependencies |
|---------|---------|-------------|
| Auto-send Receipt | ON | Recommended |
| Auto-generate Badge | OFF | Requires default badge template |
| Auto-email Badge | OFF | Requires auto-generate badge ON |
| Auto-generate Certificate | OFF | Requires default certificate template |
| Auto-email Certificate | OFF | Requires auto-generate certificate ON |

Template warnings shown if no default template exists when toggle is enabled.

---

### 7. Branding

| Field | Type | DB Column | Notes |
|-------|------|-----------|-------|
| Logo | Image Upload (square 1:1) | `logo_url` | Stored at `events/{eventId}/logo` |
| Banner Image | Image Upload (wide 3:1) | `banner_url` | Stored at `events/{eventId}/banner` |
| Brand Color | Color Picker | `primary_color` | 10 presets + custom hex input |

**Live Preview:** Real-time card showing banner, logo, event name, city, and date with the selected brand color.

**Preset Colors:** Emerald, Blue, Violet, Amber, Red, Pink, Cyan, Lime, Orange, Indigo

---

### 8. Links & Contact

| Field | Type | DB Column |
|-------|------|-----------|
| Contact Email | Email | `contact_email` |
| Event Website | URL | `website_url` |

---

### 9. Advanced

- **Delete Event** - Destructive action with confirmation

---

## API Endpoints

### `PATCH /api/events/[eventId]/settings`

Updates event table fields. Requires event admin access.

**Allowed fields (whitelist):**
```
name, short_name, slug, description, event_type, status,
start_date, end_date, venue_name, city, state, country,
timezone, is_public, registration_open, max_attendees,
contact_email, website_url, banner_url, logo_url, primary_color,
edition, scientific_chairman, organizing_chairman,
organized_by, signatory_title, signature_image_url, settings
```

Auto-adds `updated_at` timestamp. Dispatches `event-settings-saved` custom event on success.

### `GET /api/event-settings?event_id=xxx`

Fetches module + automation settings. Returns defaults if no record exists.

### `POST /api/event-settings`

Upserts module + automation settings (uses `onConflict: "event_id"`).

### `POST /api/upload`

Handles file uploads for logo, banner, signature images.
- Max size: 50MB
- Allowed: PDF, MP4, MOV, JPEG, JPG, PNG, GIF, WebP
- Bucket limit: 500MB total
- Uploads to Supabase Storage bucket "uploads"

---

## Data Flow

### General Settings Save
```
User edits form → formData state updates → change detection → sticky save bar appears
→ Click "Save Changes" → PATCH /api/events/{eventId}/settings
→ Validates whitelist → Updates DB → Invalidates caches → Success toast
```

### Module/Automation Save
```
User toggles → local state updates → Click "Save"
→ POST /api/event-settings with event_id + settings
→ Upserts event_settings table → Invalidates cache → Success toast
```

### Image Upload
```
User selects file or pastes URL → POST /api/upload (FormData)
→ Uploads to Supabase Storage → Returns public URL
→ onChange callback updates form field → Live preview updates
```

---

## Database Tables

### `events` table (main event fields)
All general, date, location, registration, branding, and contact fields are stored directly as columns. The `settings` column (JSON) stores nested objects like `speaker_invitation`.

### `event_settings` table (modules & automation)
Keyed by `event_id`. Stores all module toggles (`enable_*`) and automation flags (`auto_*`). Created on first save, upserted on subsequent saves.

---

## Conditional Logic

- Auto-email Badge toggle is disabled unless Auto-generate Badge is ON
- Auto-email Certificate toggle is disabled unless Auto-generate Certificate is ON
- Template warnings appear when auto-generate is ON but no default template exists
- Sticky save bar only appears when form data differs from original data
- Custom event type input appears when "Other" is selected
- Module count badge shows `{enabled}/{total}` in section header

---

## Event Settings Also Used In

| Feature | Fields Used |
|---------|-------------|
| Event Dashboard (Event Details card) | organizing_chairman, signatory_title, venue, location, edition, event_type |
| Invitation PDF generation | organizing_chairman, signatory_title, signature_image_url, organized_by |
| Speaker Invitation PDF | settings.speaker_invitation.* |
| Public Registration page | slug, is_public, registration_open, banner_url, logo_url, primary_color |
| Sidebar navigation | short_name, name |
| Module visibility across app | All enable_* toggles control sidebar menu items |

---

## Additional `event_settings` Fields (Registration Config)

These fields exist in `event_settings` but are NOT shown in the Settings page — they are managed elsewhere (likely in the Registration settings):

| Field | Default | Purpose |
|-------|---------|---------|
| allow_attendee_login | false | Let attendees log in to view their registration |
| allow_multiple_ticket_types | false | Allow selecting multiple ticket types |
| allow_multiple_addons | true | Allow selecting multiple add-ons |
| customize_registration_id | false | Enable custom registration ID format |
| registration_prefix | null | e.g., "EVT-" |
| registration_start_number | 1 | Starting number |
| registration_suffix | null | e.g., "-2026" |
| allow_buyers | false | Enable buyer/group registration |
| buyer_form_id | null | Form for buyer details |
| require_approval | false | Manual approval for registrations |
| allow_cancellation | true | Allow self-service cancellation |
| cancellation_deadline_hours | 24 | Hours before event to allow cancellation |
| allow_duplicate_email | true | Allow same email to register multiple times |
| show_duplicate_warning | true | Warn on duplicate email |
| send_confirmation_email | true | Auto-send confirmation on registration |
| send_reminder_email | true | Send reminder emails |
| confirmation_email_subject | - | Custom confirmation email subject |
| confirmation_email_body | - | Custom confirmation email body |
