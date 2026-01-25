# AMASI Faculty Management System - Development Guide

## Project Overview

A comprehensive event management platform for AMASI (Association of Medical Superintendents of India) built with Next.js 16, React 19, Supabase, and TypeScript.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Next.js API Routes + Supabase
- **Database:** PostgreSQL (Supabase)
- **Auth:** Supabase Magic Link (passwordless)
- **UI:** Radix UI components + Tailwind CSS
- **State:** TanStack React Query
- **Forms:** React Hook Form + Zod
- **Payments:** Razorpay
- **Email:** Resend
- **Desktop App:** Electron (print-station-app)

## Directory Structure

```
amasi-faculty-management/
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   │   ├── (auth)/          # Auth pages (login)
│   │   ├── (dashboard)/     # Main admin dashboard
│   │   ├── api/             # API routes (65+ endpoints)
│   │   ├── f/[formSlug]/    # Public form pages
│   │   ├── register/        # Public event registration
│   │   └── membership/      # Membership signup
│   ├── components/          # React components
│   │   ├── ui/              # Base UI components (53 components)
│   │   ├── dashboard/       # Dashboard-specific components
│   │   ├── events/          # Event management components
│   │   ├── forms/           # Form builder components
│   │   └── registration/    # Registration flow components
│   ├── lib/                 # Utilities & services
│   │   ├── supabase/        # Supabase client configs
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils.ts         # Helper functions
│   ├── hooks/               # Custom React hooks
│   └── middleware.ts        # Auth middleware
├── print-station-app/       # Electron desktop app for badge printing
├── supabase/                # Supabase migrations & config
└── supabase-schema.sql      # Database schema reference
```

## Key Features

### 1. Event Management (`/events`)
- Create/edit events with settings
- Event types: conference, course, workshop, webinar, meeting
- Status flow: draft → setup → planning → active → completed → archived

### 2. Ticketing (`/events/[eventId]/tickets`)
- Multiple ticket types per event
- Pricing with tax support
- Inventory management
- Early bird & group pricing

### 3. Registration (`/register/[eventSlug]`)
- Public registration flow
- Individual & group registrations
- Multi-step forms
- Discount codes

### 4. Form Builder (`/forms`)
- Drag-drop form creation
- 15+ field types
- Conditional logic
- Multi-step forms
- Public form sharing via slug

### 5. Check-in System (`/check-in`)
- QR code scanning
- Real-time statistics
- Badge printing trigger

### 6. Badge Printing
- Desktop app (Electron) at `/print-station-app`
- Zebra printer integration (ZPL)
- QR lookup → Generate ZPL → TCP print

### 7. Certificates
- Template management
- Auto-generation for attendees/speakers
- PDF generation with pdf-lib

### 8. Payments (Razorpay)
- Order creation
- Webhook verification
- Reconciliation
- Refund processing

### 9. Member Database
- 17,000+ AMASI members
- Membership plans & subscriptions
- Voting eligibility tracking

## Database Schema (Key Tables)

```sql
-- Core entities
events              -- Event records
ticket_types        -- Ticket offerings per event
registrations       -- Event registrations
payments            -- Payment transactions
members             -- AMASI member database
faculty             -- Faculty/speaker profiles

-- Forms system
forms               -- Form templates
form_fields         -- Field definitions
form_sections       -- Multi-step organization
form_submissions    -- Response data

-- Operations
print_stations      -- Kiosk configurations
checkin_lists       -- Check-in sessions
checkin_records     -- Individual check-ins
badge_templates     -- Badge designs
certificate_templates -- Certificate designs
```

## API Routes Quick Reference

### Events
- `GET/POST /api/events` - List/create events
- `GET/PUT/DELETE /api/events/[eventId]` - Event CRUD
- `GET/POST /api/events/[eventId]/tickets` - Ticket management

### Registrations
- `GET/POST /api/registrations` - Registration management
- `POST /api/registrations/group` - Group registrations
- `POST /api/registrations/import` - Bulk import

### Payments
- `POST /api/payments/razorpay/create-order` - Create order
- `POST /api/payments/razorpay/verify` - Verify payment
- `POST /api/payments/razorpay/webhook` - Webhook handler
- `POST /api/discounts/validate` - Validate discount code

### Forms
- `GET/POST /api/forms` - Form CRUD
- `GET /api/forms/public/[slug]` - Public form access
- `POST /api/forms/[formId]/publish` - Publish form
- `GET/POST /api/forms/submissions` - Submissions

### Print Station
- `GET /api/print/lookup?code=XXX` - Lookup registration
- `POST /api/print-stations/print` - Record print job
- `POST /api/print-stations/zpl-print` - Generate ZPL

### Check-in
- `POST /api/checkin` - Check-in attendee
- `GET /api/checkin/stats` - Statistics

## Authentication

- **Method:** Supabase Magic Link (email-based, passwordless)
- **Protected routes:** Dashboard, events, faculty, delegates, certificates, etc.
- **Public routes:** `/login`, `/register/*`, `/f/*`, `/api/payments/*`
- **Middleware:** `src/middleware.ts` enforces auth

### User Roles
- `super_admin` - Full system access
- `admin` - Event management
- `coordinator` - Event logistics
- `user` - Basic access

## Key Components

### UI Components (`src/components/ui/`)
53 Radix-based components: Button, Dialog, Select, Tabs, Table, Toast, etc.

### Dashboard Components
- `StatCard` - KPI display
- `EventsTable` - Event listing
- `AlertsPanel` - Notifications
- `QuickStats` - Summary metrics

### Form Components
- `FormBuilder` - Drag-drop builder
- `FormRenderer` - Render published forms
- `FormFieldRenderer` - Individual field rendering

## Utilities (`src/lib/`)

### Supabase Clients
```typescript
import { createClient } from '@/lib/supabase/client'           // Client-side
import { createServerSupabaseClient } from '@/lib/supabase/server' // Server-side
import { createAdminClient } from '@/lib/supabase/admin'       // Service role
```

### Common Helpers (`src/lib/utils.ts`)
```typescript
cn()              // Tailwind class merging
slugify()         // URL slug generation
formatDate()      // Date formatting
formatCurrency()  // Currency formatting
generateId()      // UUID generation
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AMASI Command Center
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=noreply@amasi.org
```

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:check     # Verify database setup
```

## Print Station App

Located in `/print-station-app` - Electron desktop application:

```bash
cd print-station-app
npm install
npm start            # Development
npm run build:mac    # Build macOS .dmg
npm run build:win    # Build Windows .exe
```

Features:
- USB barcode scanner support
- Zebra printer integration (ZPL over TCP:9100)
- Real-time registration lookup
- Badge generation

## Common Workflows

### Adding a New Event Page
1. Create route in `src/app/(dashboard)/events/[eventId]/your-page/page.tsx`
2. Add to event sidebar in `src/components/events/event-sidebar.tsx`
3. Create API routes if needed in `src/app/api/`

### Adding a Form Field Type
1. Add type to `src/lib/types/forms.ts`
2. Update `FormFieldRenderer` in `src/components/forms/`
3. Update form builder field palette

### Adding an API Route
1. Create file in `src/app/api/your-route/route.ts`
2. Export GET/POST/PUT/DELETE handlers
3. Use `createServerSupabaseClient()` for auth
4. Use `createAdminClient()` for service-role operations

## Type Definitions

Key types are in `src/lib/types/`:
- `events.ts` - Event, Session, TicketType
- `forms.ts` - Form, FormField, FormSubmission
- `registration.ts` - Registration, Payment
- `members.ts` - Member, Faculty

## Notes for Development

1. **Always use typed Supabase queries** - Types are auto-generated
2. **Check middleware.ts** for protected route patterns
3. **Form builder uses @dnd-kit** for drag-drop
4. **Tables use @tanstack/react-table** for data display
5. **Toast notifications use sonner** - `toast.success()`, `toast.error()`
6. **Use React Query** for server state - check existing hooks for patterns
7. **Payments require webhook verification** - Don't trust client-side payment status
