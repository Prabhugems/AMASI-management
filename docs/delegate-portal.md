# Delegate Portal (`/my`)

Public-facing self-service portal for event delegates/attendees. No login required — lookup by email, phone, or registration number.

**Source:** `src/app/my/page.tsx` (~2700 lines, single file)
**Sub-pages:** `/my/addons` (add-on purchase with Razorpay)

---

## Page Flow

### 1. Search / Entry View
- Dark gradient background (`slate-900 → indigo-900`) with ambient orbs
- Centered card with search input
- Accepts: email, phone number, or registration number
- Submit button: "Find My Registration"
- Shows pending payment warnings with verify option if payment is incomplete
- Framer Motion fade-in + translate animations

### 2. Multiple Events Selection View
- Shown when user has registrations across multiple events
- Welcome message with attendee name
- Event cards with logo, name, date, city, registration number
- Click to select an event → goes to detail view
- Pending payments summary at bottom
- Staggered spring animations per card

### 3. Delegate Detail View (Main)
Pull-to-refresh enabled (Framer Motion drag). Sections in order:

#### a. Event Countdown
- Shows days : hours : mins until event start
- Gradient card with glass-blur styling
- Only visible if event hasn't started

#### b. Event Banner
- Banner image (or gradient fallback with event name watermark)
- Event logo overlapping the banner (-mt-12)
- Event name, date, venue + city

#### c. Delegate Info Card
- Avatar initial (gradient circle)
- Name, designation, institution
- **Registration number** in dashed indigo box (large mono font)
- **QR Code** for check-in (only if not already checked in)
- Status rows: Ticket Type, Status (Confirmed/Pending), Payment, Amount, Check-in, Email, Phone
- **Payment retry** button if payment is pending (opens Razorpay)
- **Purchased add-ons** list with "Buy More" link to `/my/addons`

#### d. Abstract Submissions
- Only shown if abstracts are enabled for the event
- Lists submitted abstracts with status badges (submitted, under_review, revision_requested, accepted, rejected, withdrawn)
- Withdraw button for submitted/under_review
- Revision submission link for revision_requested
- Presentation upload + certificate download for accepted
- Submit count tracker (e.g., "1 of 3 submissions used")

#### e. Feedback Forms
- Lists event feedback forms
- Inline form expansion with FormRenderer
- Pre-fills email and name
- Shows completion status (X of Y completed)
- Certificate gating: some forms must be submitted before certificate download
- Check-in gating: some forms require check-in first
- Lock icon indicators for gated forms

#### f. Download Buttons Grid (2-4 columns)
| Button | Icon Color | Condition |
|--------|-----------|-----------|
| Invitation PDF | Blue | Confirmed only |
| Badge PDF | Indigo | Confirmed only |
| Certificate PDF | Amber | Checked in + feedback submitted + cert generated |
| FMAS Result | Green gradient | Only if exam_result === "pass" |
| Receipt PDF | Green | Confirmed only |

- Certificate has lock icon if gated by feedback or check-in
- FMAS Result card has sparkle celebration animations

#### g. Certificate Dispatch Banner
- Full-width prominent card
- If address NOT submitted: Purple gradient with pulsing "Action Required" badge → links to Fillout form
- If address submitted: Green gradient with "Address Received" confirmation + address preview

#### h. Pending Payments Section
- Amber warning cards per pending/failed payment
- Payment verify form with Razorpay Payment ID input
- Auto-verify option (leave blank)
- Status result display (verified/already_completed/error)

#### i. External Links
- **Program Schedule** → `/p/{eventId}` (emerald card)
- **WhatsApp Group** → external URL (green WhatsApp-branded card with SVG icon)
- **Custom Links** → configurable per event (violet cards)

#### j. Need Help Section (Expandable)
- Collapsible "Need Help?" card with HelpCircle icon
- Lists existing help requests with status (open, in_progress, resolved, closed) and priority badges
- Chat-style reply thread per request (delegate vs admin messages)
- Reply input for open/in_progress requests
- New request form: Category dropdown + message textarea

#### k. Footer Note
- "Print your badge and bring it to the event venue."
- "Certificates are available after event completion."

#### l. Floating Help Button
- Fixed bottom-right FAB (indigo-purple gradient)
- Pulsing red notification dot
- Scrolls to help section on click
- Hover toggles HelpCircle → MessageSquare icon

---

## Portal Settings (per event)

Configured via `event.settings.delegate_portal`:

```typescript
{
  show_invitation: boolean    // Default: true
  show_badge: boolean         // Default: true
  show_certificate: boolean   // Default: true
  show_receipt: boolean       // Default: true
  show_program_schedule: boolean // Default: true
  show_addons: boolean        // Default: true
  whatsapp_group_url: string
  custom_links: { name: string; url: string }[]
}
```

---

## Key Features

- **Pull-to-refresh** — Framer Motion drag gesture, refreshes registration data
- **Haptic feedback** — `navigator.vibrate()` on button taps
- **Staggered animations** — Spring-based stagger for card lists
- **Skeleton loading** — Pulsing placeholder cards during initial load
- **QR Code generation** — `qrcode` library, rendered to canvas
- **Razorpay integration** — Payment retry + add-on purchase
- **Certificate gating** — Blocked until check-in + feedback form submission
- **Light mode forced** — Removes dark class on mount for public pages
- **Mobile-first** — max-w-lg container, responsive grid (2→3→4 cols)

---

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/my?q=` | GET | Lookup registrations by email/phone/reg# |
| `/api/badge/{token}/download` | GET | Download badge PDF |
| `/api/certificate/{regNumber}/download` | GET | Generate + download certificate PDF |
| `/api/certificate/track-download` | POST | Track certificate download |
| `/api/registrations/{id}/final-receipt` | GET | Download consolidated receipt PDF |
| `/api/events/{id}/invitation-pdf` | GET | Download invitation PDF |
| `/api/payments/razorpay/create-order` | POST | Create Razorpay order for retry/addon |
| `/api/payments/razorpay/verify` | POST | Verify Razorpay payment |
| `/api/payments/verify-public` | POST | Public payment verification |
| `/api/event-settings?event_id=` | GET | Check if abstracts enabled |
| `/api/abstract-settings/{eventId}` | GET | Abstract submission settings |
| `/api/abstracts?event_id=&email=` | GET | User's abstract submissions |
| `/api/my/abstracts` | POST | Withdraw abstract |
| `/api/forms/public?event_id=&email=` | GET | Feedback forms + submission status |
| `/api/forms/public/{slug}` | GET | Form detail + fields |
| `/api/forms/submissions` | POST | Submit feedback form |
| `/api/help-request` | POST | Create help request |
| `/api/help-request/my` | GET | List delegate's help requests |
| `/api/help-request/replies` | POST | Send reply to help request |
| `/api/addons?event_id=` | GET | Available add-ons (addon page) |

---

## Sub-page: `/my/addons`

Add-on purchase flow for registered delegates.

**Query params:** `?reg={regNumber}&event={eventId}`

**Flow:**
1. Validates registration exists for given event
2. Fetches available add-ons (filtered by ticket type)
3. Quantity selector per addon (with variant support)
4. Order summary with subtotal + 18% GST
5. Razorpay checkout for paid addons / direct add for free ones
6. Success confirmation with link back to portal

---

## Component Hierarchy

```
DelegatePortalPage (default export)
├── PullToRefresh (drag gesture wrapper)
├── DelegatePortalSkeleton (loading state)
├── FloatingHelpButton (fixed FAB)
├── CheckinQRCode (QR canvas renderer)
├── AbstractSubmissions (abstracts section)
├── EventFeedbackForms (feedback forms with FormRenderer)
└── DelegateHelpForm (expandable help/support)
```

---

## Design System

- **Background:** `bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900`
- **Cards:** `bg-white rounded-2xl shadow-xl`
- **Accent gradient:** `from-indigo-600 to-purple-600`
- **Status colors:** Green (confirmed/paid), Amber (pending), Red (failed/not checked in)
- **Typography:** System font stack, mono for registration numbers
- **Icons:** Lucide React throughout
- **Animations:** Framer Motion (spring stagger, scale on hover/tap)
