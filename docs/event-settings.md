# Event Settings Module

> Configure your event details and preferences

## Overview

The Event Settings module is the central hub for configuring every aspect of an event. It spans **10 settings pages**, **4 database tables**, and **22 togglable modules**. Settings are organized into a Tito-style 2-column layout with sidebar navigation on the main page, plus dedicated sub-pages for specialized configuration (payments, communications, registration, etc.).

---

## Architecture

### Data Storage Strategy

Event configuration is distributed across multiple storage mechanisms:

| Storage Layer | What It Holds | Access Pattern |
|---|---|---|
| `events` table (columns) | Core fields: name, dates, venue, branding, capacity | `PATCH /api/events/[eventId]/settings` |
| `events.settings` (JSONB) | Nested structured data: delegate portal, speaker invitation | Same PATCH endpoint |
| `event_settings` table | Registration control, automation, 22 module toggles | `GET/POST /api/event-settings?event_id=xxx` |
| `communication_settings` table | Email/WhatsApp/SMS/Webhook provider credentials | `GET/PUT /api/communications/settings` |
| `abstract_settings` table | Abstract submission deadlines, review workflow, limits | `GET/POST /api/abstract-settings/[eventId]` |

### Key Files

```
src/app/events/[eventId]/settings/page.tsx          # Main settings hub (9 sections)
src/app/events/[eventId]/payment-settings/page.tsx   # Payment gateway config
src/app/events/[eventId]/communications/settings/    # Multi-channel comms setup
src/app/events/[eventId]/delegate-portal/settings/   # Attendee portal customization
src/app/events/[eventId]/registrations/settings/     # Registration behavior
src/app/events/[eventId]/tickets/settings/page.tsx   # Ticket configuration
src/app/events/[eventId]/abstracts/settings/page.tsx # Abstract submission config
src/app/events/[eventId]/examination/settings/       # Exam module settings
src/app/events/[eventId]/program/settings/page.tsx   # Program/schedule settings
src/app/events/[eventId]/addons/settings/page.tsx    # Add-on items config
src/app/api/events/[eventId]/settings/route.ts       # PATCH API for events table
src/app/api/event-settings/route.ts                  # GET/POST for event_settings table
```

---

## Main Settings Page (`/events/[eventId]/settings`)

The main page has a **sticky sidebar** with 9 sections. Changes are tracked via JSON diff and a **sticky save bar** appears at the bottom when unsaved changes exist.

### 1. General Information

| Field | Type | Required | Notes |
|---|---|---|---|
| Event Name | Text | Yes | Primary display name |
| Short Name | Text | No | Used in navigation/sidebar |
| Edition | Number | No | e.g., "42nd Annual" |
| URL Slug | Text (auto-lowercased) | No | Public registration URL: `/register/{slug}` |
| Description | Textarea | No | Event description |
| Event Type | Select | Yes | conference, workshop, seminar, webinar, symposium, summit, congress, meetup, or custom |
| Custom Event Type | Text | Conditional | Shown when "Other" is selected |
| Status | Select | Yes | draft, planning, ongoing, completed, cancelled |
| Organized By | Text | No | Used in invitation letters |
| Scientific Chairman | Text | No | Leadership |
| Organizing Chairman | Text | No | Leadership |
| Signatory Title | Text | No | Shown below signatory name (e.g., "Course Convenor") |
| Signature Image | Image Upload | No | PNG/JPG rendered in invitation letters |

#### Speaker Invitation Override

A separate card lets you override the signer details specifically for speaker invitation letters. If not set, the default signatory above is used.

| Field | Type | Notes |
|---|---|---|
| Signer Name | Text | e.g., "Dr. Roshan Shetty A" |
| Signer Title | Text | e.g., "Secretary" |
| Signature Image | Image Upload | Separate from the main signature |

### 2. Date & Time

| Field | Type | Notes |
|---|---|---|
| Start Date | Date picker | Event start |
| End Date | Date picker | Event end |
| Timezone | Select | IST (default), UTC, ET, PT, GMT/BST |

### 3. Location

| Field | Type | Notes |
|---|---|---|
| Venue Name | Text | e.g., "Grand Convention Center" |
| City | Text | e.g., "Chennai" |
| State | Text | e.g., "Tamil Nadu" |
| Country | Select | India (default), US, UK, Singapore, UAE |

### 4. Registration

| Setting | Type | Default | Description |
|---|---|---|---|
| Public Event | Toggle | ON | When OFF, only admins can access the registration page |
| Registration Open | Toggle | ON | When OFF, shows "Registration Closed" message |
| Maximum Attendees | Number | Empty (unlimited) | Auto-closes registration when limit is reached |

### 5. Modules

22 togglable modules organized in 5 categories. Disabling a module hides it from the sidebar. Core items (Dashboard, Tickets, Attendees, Orders, Team, Communications, Settings) are always visible.

**Event Operations** (default ON):
| Module | Description |
|---|---|
| Speakers | Manage speakers, invitations, portal links, travel & accommodation |
| Program | Build event schedule with sessions, tracks, and speaker assignments |
| Checkin Hub | QR-based check-in, session tracking, and attendance reports |
| Badges | Design and print attendee badges with templates |
| Certificates | Generate and email certificates to attendees |
| Print Station | Kiosk mode for on-site badge printing |

**Registration & Forms** (default ON):
| Module | Description |
|---|---|
| Addons | Optional add-on items for registration (meals, kits, etc.) |
| Waitlist | Manage waitlist when tickets are sold out |
| Forms | Custom form builder for collecting additional data |
| Delegate Portal | Self-service portal for attendees |
| Surveys | Post-event feedback and surveys |
| Leads | Capture and manage potential attendee leads |

**Travel & Logistics** (default ON):
| Module | Description |
|---|---|
| Travel | Flight bookings and transfers for speakers/delegates |
| Accommodation | Hotel bookings and room allocations |
| Meals | Meal preferences, dietary requirements, meal tracking |
| Visa Letters | Visa invitation letters for international delegates |

**Finance & Sponsors** (default ON):
| Module | Description |
|---|---|
| Sponsors | Event sponsors, tiers, and sponsorship packages |
| Budget | Event budget, expenses, and financial reports |

**Advanced Modules** (default OFF):
| Module | Description |
|---|---|
| Abstract Management | Abstract submission, review workflow, accept/reject decisions |
| Examination (FMAS/MMAS) | Marks entry, results, convocation numbering, address collection |

Supports: Enable All, Disable All, and per-category Save.

### 6. Automation

Triggered automatically when payment is completed. Execution order: Receipt -> Badge -> Certificate.

| Setting | Type | Default | Prerequisites |
|---|---|---|---|
| Auto-send Receipt | Toggle | ON | Email configured |
| Auto-generate Badge | Toggle | OFF | Default badge template required |
| Auto-email Badge | Toggle | OFF | Auto-generate badge must be ON |
| Auto-generate Certificate | Toggle | OFF | Default certificate template required |
| Auto-email Certificate | Toggle | OFF | Auto-generate certificate must be ON |

The UI shows warnings if no default template exists and validates dependencies (e.g., auto-email badge is disabled if auto-generate badge is OFF).

### 7. Branding

Features a **live preview card** that updates in real-time showing how the registration page will look.

| Field | Type | Notes |
|---|---|---|
| Event Logo | Image Upload | Square, 200x200px recommended |
| Banner Image | Image Upload | Wide, 1200x400px recommended |
| Primary Color | Color Picker | 10 presets (Emerald, Blue, Violet, Amber, Red, Pink, Cyan, Lime, Orange, Indigo) + custom hex |

### 8. Links & Contact

| Field | Type | Notes |
|---|---|---|
| Contact Email | Email | Displayed to attendees for support |
| Event Website | URL | External website link |

### 9. Advanced (Danger Zone)

| Action | Description |
|---|---|
| Delete Event | Permanently deletes event and all associated data. Irreversible. |

---

## Sub-Settings Pages

### Payment Settings (`/events/[eventId]/payment-settings`)

#### Payment Methods (Togglable)

| Method | Description | Fields When Enabled |
|---|---|---|
| Razorpay | Cards, UPI, Wallets | Key ID, Key Secret, Webhook Secret (optional) |
| Bank Transfer | NEFT, IMPS, RTGS | Account Name, Account Number, IFSC Code, Bank Name, Branch, UPI ID |
| Cash | Pay at Venue | None |
| Free | No Payment Required | None |

Uses the default platform Razorpay keys if event-specific keys are not provided.

---

### Communications Settings (`/events/[eventId]/communications/settings`)

4 communication channels, each with provider selection and credential configuration.

| Channel | Providers | Key Fields |
|---|---|---|
| Email | Default, Resend, Blastable, SendGrid | API Key, From Address, From Name |
| WhatsApp | Meta Business API, Twilio, Interakt, Wati | API Key, Phone Number ID, Access Token, Business Account ID |
| SMS | Twilio, MSG91, TextLocal | API Key, Sender ID, Auth Token |
| Webhook | Custom URL | Webhook URL, Secret (HMAC-SHA256), Custom Headers |

Features: Show/Hide Secrets toggle, Test Connection button per channel, channel enable/disable toggles.

---

### Registration Settings (`/events/[eventId]/registrations/settings`)

#### Approval & Cancellation

| Setting | Type | Default | Notes |
|---|---|---|---|
| Require Approval | Toggle | OFF | Registrations stay "pending" until manually approved |
| Allow Cancellation | Toggle | ON | Attendees can self-cancel |
| Cancellation Deadline | Number (hours) | 24 | Only shown when cancellation is allowed |

#### Duplicate Email Control

| Setting | Type | Default | Notes |
|---|---|---|---|
| Allow Multiple per Email | Toggle | ON | Same email can register multiple times |
| Show Duplicate Warning | Toggle | ON | Alert when email is already registered |

#### Registration ID Format

| Setting | Type | Default | Notes |
|---|---|---|---|
| Customize Registration ID | Toggle | OFF | Uses system-generated IDs when off |
| Prefix | Text | null | e.g., "AMASI26-" |
| Starting Number | Number | 1 | First registration number |
| Suffix | Text | null | Optional suffix |

Live preview shows the next ID format (e.g., `AMASI26-1001`).

#### Notification Settings

| Setting | Type | Default |
|---|---|---|
| Send Confirmation Email | Toggle | ON |
| Send Reminder Email | Toggle | ON |

#### Email Template

| Field | Type | Notes |
|---|---|---|
| Confirmation Email Subject | Text | Default: "Registration Confirmed" |
| Confirmation Email Body | Textarea | Supports `{{name}}`, `{{event}}`, `{{date}}` placeholders |

---

### Delegate Portal Settings (`/events/[eventId]/delegate-portal/settings`)

#### Feature Toggles

| Feature | Default | Description |
|---|---|---|
| Show Invitation Letter | ON | PDF download of invitation |
| Show Badge Download | ON | Name badge PDF |
| Show Certificate Download | ON | Participation certificate |
| Show Payment Receipt | ON | Receipt PDF |
| Show Program Schedule | ON | Event schedule view |
| Show Add-ons Store | ON | Browse and purchase add-ons |

#### Additional

| Field | Type | Notes |
|---|---|---|
| WhatsApp Group URL | URL | Displayed as a green card link in the portal |
| Resource Links | Up to 5 name+URL pairs | Custom links for materials, hotel info, etc. |

Includes a Portal Preview link to test the delegate experience.

---

### Tickets Settings (`/events/[eventId]/tickets/settings`)

| Setting | Type | Default | Notes |
|---|---|---|---|
| Default Currency | Select | INR | INR, USD, EUR, GBP |
| Default GST % | Number | 0 | Tax percentage |
| Min per Order | Number | 1 | Minimum tickets per order |
| Max per Order | Number | 10 | Maximum tickets per order |
| Close Before Event | Number (hours) | 0 | Auto-close registration N hours before start |
| Show Remaining Tickets | Toggle | OFF | Show availability count publicly |
| Enable Waitlist | Toggle | OFF | Allow waitlist when sold out |
| Require Approval by Default | Toggle | OFF | New ticket types default to requiring approval |

---

### Abstracts Settings (`/events/[eventId]/abstracts/settings`)

#### Deadlines

| Field | Type | Notes |
|---|---|---|
| Submission Opens At | DateTime | When portal opens |
| Submission Deadline | DateTime | Final submission cutoff |
| Revision Deadline | DateTime | Authors can revise until this date |
| Notification Date | DateTime | Results announcement |
| Review Deadline | DateTime | When reviews are enabled |

#### Limits & Requirements

| Setting | Type | Notes |
|---|---|---|
| Max Submissions per Author | Number | Per-person limit |
| Max Co-Authors | Number | Authors per abstract |
| Word Limit | Number | Abstract body word limit |
| Require Registration | Toggle | Must be registered to submit |

#### File & Media

| Setting | Options |
|---|---|
| Allowed File Types | PDF Only, Documents, Images, Videos, All Media (presets) |
| Max File Size | 5MB, 10MB, 25MB, 50MB, 100MB, 250MB, 500MB, Custom |
| Allow Video URLs | YouTube, Vimeo, Google Drive, Dropbox |

#### Presentation Types (Togglable)

- Oral Presentation
- Poster / ePoster
- Video Presentation

#### Review Workflow

| Setting | Type | Default | Notes |
|---|---|---|---|
| Enable Review Workflow | Toggle | OFF | Enables the full review pipeline |
| Blind Review | Toggle | OFF | Reviewer cannot see author names |
| Double-Blind Review | Toggle | OFF | Authors also cannot see reviewers |
| Reviewers per Abstract | Number | 2 | Auto-assignment count |
| Require COI Declaration | Toggle | OFF | Conflict of interest statement |
| Smart Reviewer Matching | Toggle | OFF | Auto-assign by specialty |
| Auto Deadline Reminders | Multi-select | None | 1, 3, 5, 7, or 14 days before deadline |

#### Notifications

| Setting | Type | Default |
|---|---|---|
| Notify on Submission | Toggle | ON |
| Notify on Decision | Toggle | ON |

#### Guidelines

| Field | Type |
|---|---|
| Submission Guidelines | Textarea |
| Author Guidelines | Textarea |

---

### Examination Settings (`/events/[eventId]/examination/settings`)

| Setting | Type | Notes |
|---|---|---|
| Exam Type | Select/Custom | FMAS, MMAS, or custom name |
| Pass Marks | Number | Out of total marks |
| Exam Convocation Prefix | Text | e.g., "FMAS/" |
| Exam Convocation Start Number | Number | Auto-incrementing |
| Without-Exam Convocation Prefix | Text | For non-exam participants |
| Without-Exam Start Number | Number | Auto-incrementing |
| Exam Ticket Types | Checkboxes | Which ticket types participate in the exam |

#### Scoring Columns

Dynamic mark columns with Label + Max Marks. Total Max Marks is auto-calculated. Columns can be added/removed.

#### Examiner Portal

- Generate shareable examiner links (UUID-based tokens)
- Label each token
- Copy/manage/delete tokens

---

### Program Settings (`/events/[eventId]/program/settings`)

#### Theme Selection (4 themes)

| Theme | Description |
|---|---|
| Modern | Gradient header, clean cards |
| Classic | Cream/sepia with teal accents |
| Dark | High contrast dark mode |
| Minimal | Clean white design |

#### Program Tracks

| Field | Type | Notes |
|---|---|---|
| Show Tracks | Toggle | ON/OFF |
| Track Name | Text | Per track |
| Track Color | Color (6 options) | Visual differentiation |
| Track Description | Text | Per track |

Tracks can be added, removed, and reordered.

#### Examination Details (Public Page)

| Setting | Type |
|---|---|
| Show Exam Details | Toggle |
| Theory Exam Questions | Number |
| Theory Total Marks | Number |
| Theory Duration (mins) | Number |
| Negative Marking | Toggle |
| Practical Components | Dynamic list (Name + Marks) |

#### FAQs

| Field | Type |
|---|---|
| Show FAQ | Toggle |
| Q&A Pairs | Dynamic list (Question + Answer) |

#### Footer

| Field | Type |
|---|---|
| Footer Text | Textarea |

---

### Add-ons Settings (`/events/[eventId]/addons/settings`)

| Setting | Type | Default | Notes |
|---|---|---|---|
| Default Max Quantity | Number | 10 | Per-order max for new add-ons |
| Show on Registration Page | Toggle | ON | Display add-ons during registration |
| Allow Add-on Only Purchase | Toggle | OFF | Purchase add-ons without a ticket |
| Show Add-on Images | Toggle | ON | Display product images |
| Show Add-on Descriptions | Toggle | ON | Display descriptions |

---

## Database Schema

### `events` Table (Core Fields)

```sql
-- Identity
id              UUID PRIMARY KEY
name            TEXT NOT NULL
short_name      TEXT
slug            TEXT UNIQUE
description     TEXT
event_type      TEXT DEFAULT 'conference'
status          TEXT DEFAULT 'planning'  -- draft|planning|ongoing|completed|cancelled
edition         INTEGER

-- Dates
start_date      TIMESTAMPTZ
end_date        TIMESTAMPTZ
registration_start  TIMESTAMPTZ
registration_end    TIMESTAMPTZ
early_bird_end      TIMESTAMPTZ
abstract_deadline   TIMESTAMPTZ

-- Location
venue_name      TEXT
venue_address   TEXT
city            TEXT
state           TEXT
country         TEXT DEFAULT 'India'
is_virtual      BOOLEAN DEFAULT false
is_hybrid       BOOLEAN DEFAULT false
virtual_platform TEXT
virtual_link     TEXT

-- Organization
organized_by            TEXT
scientific_chairman     TEXT
organizing_chairman     TEXT
organizing_secretary    TEXT
treasurer               TEXT
signatory_title         TEXT
signature_image_url     TEXT

-- Contact
contact_email   TEXT
contact_phone   TEXT

-- Branding
logo_url        TEXT
banner_url      TEXT
brochure_url    TEXT
website_url     TEXT
primary_color   TEXT

-- Capacity
max_attendees       INTEGER
total_delegates     INTEGER
total_faculty       INTEGER
total_sessions      INTEGER
timezone            TEXT DEFAULT 'Asia/Kolkata'
is_public           BOOLEAN DEFAULT true
registration_open   BOOLEAN DEFAULT true

-- Payment
razorpay_key_id         TEXT
razorpay_key_secret     TEXT
razorpay_webhook_secret TEXT
payment_methods_enabled JSONB  -- {razorpay, bank_transfer, cash, free}
bank_account_name       TEXT
bank_account_number     TEXT
bank_ifsc_code          TEXT
bank_name               TEXT
bank_branch             TEXT
bank_upi_id             TEXT

-- Nested Settings
settings        JSONB  -- {speaker_invitation, delegate_portal, tickets, addons, ...}

-- Timestamps
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

### `event_settings` Table

```sql
event_id                    UUID UNIQUE REFERENCES events(id)

-- Login & Access
allow_attendee_login        BOOLEAN DEFAULT false

-- Ticket/Addon Behavior
allow_multiple_ticket_types BOOLEAN DEFAULT false
allow_multiple_addons       BOOLEAN DEFAULT true

-- Registration ID
customize_registration_id   BOOLEAN DEFAULT false
registration_prefix         TEXT
registration_start_number   INTEGER DEFAULT 1
registration_suffix         TEXT
current_registration_number INTEGER DEFAULT 0

-- Buyers (Group Registration)
allow_buyers                BOOLEAN DEFAULT false
buyer_form_id               UUID

-- Approval & Cancellation
require_approval            BOOLEAN DEFAULT false
allow_cancellation          BOOLEAN DEFAULT true
cancellation_deadline_hours INTEGER DEFAULT 24

-- Email Notifications
send_confirmation_email     BOOLEAN DEFAULT true
send_reminder_email         BOOLEAN DEFAULT true
confirmation_email_subject  TEXT DEFAULT 'Registration Confirmed'
confirmation_email_body     TEXT

-- Duplicate Control
allow_duplicate_email       BOOLEAN DEFAULT true
show_duplicate_warning      BOOLEAN DEFAULT true

-- Automation
auto_send_receipt           BOOLEAN DEFAULT true
auto_generate_badge         BOOLEAN DEFAULT false
auto_email_badge            BOOLEAN DEFAULT false
auto_generate_certificate   BOOLEAN DEFAULT false
auto_email_certificate      BOOLEAN DEFAULT false

-- Module Toggles (22 total)
enable_abstracts            BOOLEAN DEFAULT false
enable_examination          BOOLEAN DEFAULT false
enable_speakers             BOOLEAN DEFAULT true
enable_program              BOOLEAN DEFAULT true
enable_checkin              BOOLEAN DEFAULT true
enable_badges               BOOLEAN DEFAULT true
enable_certificates         BOOLEAN DEFAULT true
enable_print_station        BOOLEAN DEFAULT true
enable_addons               BOOLEAN DEFAULT true
enable_waitlist             BOOLEAN DEFAULT true
enable_forms                BOOLEAN DEFAULT true
enable_delegate_portal      BOOLEAN DEFAULT true
enable_surveys              BOOLEAN DEFAULT true
enable_leads                BOOLEAN DEFAULT true
enable_travel               BOOLEAN DEFAULT true
enable_accommodation        BOOLEAN DEFAULT true
enable_meals                BOOLEAN DEFAULT true
enable_visa                 BOOLEAN DEFAULT true
enable_sponsors             BOOLEAN DEFAULT true
enable_budget               BOOLEAN DEFAULT true
```

### `communication_settings` Table

```sql
event_id                    UUID UNIQUE

-- Email
email_provider              TEXT DEFAULT 'default'  -- default|resend|blastable|sendgrid
email_api_key               TEXT
email_from_address          TEXT
email_from_name             TEXT

-- WhatsApp
whatsapp_provider           TEXT  -- meta|twilio|interakt|wati
whatsapp_api_key            TEXT
whatsapp_phone_number_id    TEXT
whatsapp_access_token       TEXT
whatsapp_business_account_id TEXT

-- SMS
sms_provider                TEXT  -- twilio|msg91|textlocal
sms_api_key                 TEXT
sms_sender_id               TEXT
sms_auth_token              TEXT

-- Twilio (Shared)
twilio_account_sid          TEXT
twilio_auth_token           TEXT
twilio_phone_number         TEXT

-- Webhook
webhook_enabled             BOOLEAN DEFAULT false
webhook_url                 TEXT
webhook_secret              TEXT
webhook_headers             JSONB

-- Channels
channels_enabled            JSONB  -- {email, whatsapp, sms, webhook}
```

### `abstract_settings` Table

```sql
event_id                    UUID PRIMARY KEY

-- Deadlines
submission_opens_at         TIMESTAMPTZ
submission_deadline         TIMESTAMPTZ
revision_deadline           TIMESTAMPTZ
notification_date           TIMESTAMPTZ

-- Limits
max_submissions_per_person  INTEGER
max_authors                 INTEGER
word_limit                  INTEGER

-- Requirements
require_registration        BOOLEAN DEFAULT false
require_addon_id            UUID
allowed_file_types          TEXT[]
max_file_size_mb            INTEGER

-- Presentation
presentation_types          TEXT[]  -- oral|poster|video|either

-- Review
review_enabled              BOOLEAN DEFAULT false
reviewers_per_abstract      INTEGER DEFAULT 2
blind_review                BOOLEAN DEFAULT false

-- Guidelines
submission_guidelines       TEXT
author_guidelines           TEXT

-- Notifications
notify_on_submission        BOOLEAN DEFAULT true
notify_on_decision          BOOLEAN DEFAULT true
```

---

## API Routes

| Method | Endpoint | Purpose |
|---|---|---|
| `PATCH` | `/api/events/[eventId]/settings` | Update events table fields |
| `GET` | `/api/event-settings?event_id=xxx` | Get event_settings (returns defaults if not found) |
| `POST` | `/api/event-settings` | Upsert event_settings |
| `GET` | `/api/events/[eventId]/payment-settings` | Get payment config |
| `PUT` | `/api/events/[eventId]/payment-settings` | Update payment config |
| `GET` | `/api/communications/settings?event_id=xxx` | Get communication settings |
| `PUT` | `/api/communications/settings` | Update communication settings |
| `GET` | `/api/events/[eventId]/delegate-portal-settings` | Get delegate portal config |
| `POST` | `/api/events/[eventId]/delegate-portal-settings` | Save delegate portal config |
| `GET` | `/api/abstract-settings/[eventId]` | Get abstract settings |
| `POST` | `/api/abstract-settings/[eventId]` | Save abstract settings |

All routes require authentication via `requireEventAccess()` or `requireAdmin()`. Write operations use `createAdminClient()` to bypass RLS.

---

## UI Patterns

### Layout
- **2-column Tito-style**: Sticky sidebar navigation (left) + content area (right) on the main settings page
- Sub-settings pages are standalone full-width layouts

### State Management
- `useState` for local form state
- `useEffect` to initialize form data from query results
- JSON diff (`JSON.stringify` comparison) to detect unsaved changes

### Data Fetching
- `useQuery` for reading settings
- `useMutation` for saving (main page)
- Direct `fetch` + `useState` for saving (sub-components like Modules, Automation)

### UX Features
- **Sticky save bar**: Appears at bottom when unsaved changes exist, with Discard + Save
- **Live preview**: Branding section shows real-time preview of registration page header
- **Toast notifications**: Success/error feedback via Sonner
- **Dependency validation**: e.g., auto-email badge is disabled unless auto-generate badge is ON
- **Template warnings**: Shows "Requires default template" badge when no default badge/certificate template exists
- **Sensitive field masking**: API keys displayed as "********" with show/hide toggle
- **Test connection**: Communications settings include per-channel test buttons

---

## Auth & Permissions

- Main settings page requires event-level access (`requireEventAccess(eventId)`)
- API routes use `requireAdmin()` or `requireEventAccess()`
- Write operations use admin client to bypass RLS
- Roles with access: `super_admin`, `admin`, `event_admin`
- Settings pages are protected by middleware (auth required for dashboard pages)

---

## Related Systems

Settings in this module directly affect behavior in:

| System | Affected By |
|---|---|
| Public Registration (`/register/[slug]`) | is_public, registration_open, max_attendees, slug, branding |
| Sidebar Navigation | Module enable/disable toggles |
| Post-Payment Automation | auto_send_receipt, auto_generate_badge/certificate |
| Speaker Portal (`/speaker/[token]`) | speaker_invitation settings |
| Delegate Portal (`/my`) | delegate_portal settings (feature toggles, resource links) |
| Check-in App | enable_checkin toggle |
| Abstract Portal | abstract_settings (deadlines, limits, review workflow) |
| Badge/Certificate Generation | Default templates + automation toggles |
| Payment Processing | Razorpay credentials, payment_methods_enabled |
| Email/WhatsApp/SMS Sending | communication_settings provider credentials |
