# AMASI Faculty Management - Claude Code Guide

## Stack
Next.js 16 + React 19 + Supabase + TanStack Query + Shadcn UI + TypeScript + Tailwind CSS 3

## Commands
```bash
npm run dev       # Start dev server
npm run build     # db:check + next build
npm run lint      # ESLint
```

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 150+ API routes
│   ├── login/              # Auth pages
│   ├── events/             # Event management (protected)
│   ├── faculty/            # Faculty management (protected)
│   ├── delegates/          # Delegates (protected)
│   ├── forms/              # Form builder (protected)
│   ├── register/           # Public event registration
│   ├── membership/         # Public membership application
│   ├── speaker/            # Speaker portal (token-based, public)
│   ├── respond/            # Faculty response portal (token-based)
│   ├── check-in/           # Check-in app (token-based)
│   ├── print-station/      # Badge printing kiosk
│   └── travel-agent/       # Travel agent portal (token-based)
├── components/
│   ├── ui/                 # Shadcn + custom UI components
│   ├── layout/             # Dashboard layout, sidebar, navbar
│   ├── providers/          # Theme, QueryClient, ConfirmDialog
│   ├── dashboard/          # Dashboard widgets
│   ├── forms/              # Form builder components
│   └── [feature]/          # Feature-specific components
├── lib/
│   ├── supabase/
│   │   ├── client.ts       # Browser Supabase client (anon key, RLS)
│   │   ├── server.ts       # Server client + admin client (service role, bypasses RLS)
│   │   └── database.types.ts  # Auto-generated DB types
│   ├── auth/api-auth.ts    # getApiUser(), requireAdmin(), requireSuperAdmin()
│   ├── services/           # razorpay, sms, whatsapp, webhook, auto-send
│   ├── email.ts            # Email sending (Resend/Blastable)
│   ├── email-templates.ts  # Template rendering with {{variables}}
│   ├── gallabox.ts         # WhatsApp via Gallabox API
│   ├── env.ts              # isFeatureEnabled('razorpay'|'email'|'gallabox')
│   └── utils.ts            # cn(), formatDate, general utils
├── hooks/                  # 26 custom hooks (use-auth, use-permissions, etc.)
└── middleware.ts           # Route protection (auth required for dashboard pages)
```

## Key Patterns

### API Route Pattern
```typescript
// 1. Auth check
const user = await requireAdmin()  // or getApiUser()
// 2. Create admin client (bypasses RLS)
const supabase = await createAdminClient()
// 3. Query/mutate
const { data, error } = await supabase.from('table').select('*')
// 4. Return response
return NextResponse.json({ data })
```

### Path Alias
`@/*` maps to `./src/*` (e.g., `@/lib/supabase/server`)

### Auth & Roles
- Roles: `super_admin` > `admin` > `event_admin` > `staff` > `faculty` > `member`
- New users auto-get `event_admin` role
- RLS on most tables; API routes use admin client to bypass
- Token-based access for public portals (speaker, travel-agent, check-in)

## Known Gotchas

1. **Env var `.trim()`**: Always `.trim()` env vars - Vercel can add newlines. The `SUPABASE_SERVICE_ROLE_KEY` had this bug.
2. **Admin client not centralized**: Many API routes create their own admin client directly with `process.env` instead of using `createAdminClient()`. Check both when fixing env-related issues.
3. **RLS bypass required**: Events table RLS only allows `super_admin`/`admin` for inserts. Must use admin client for creates.
4. **Email providers**: Blastable (primary) or Resend (fallback). Check `isEmailEnabled()` before sending.
5. **WhatsApp**: Gallabox integration. Template messages require pre-approved templates in Gallabox dashboard.
6. **Razorpay**: Payment processing with webhook verification.

## Key External Services
- **Supabase**: Database + Auth + Storage
- **Vercel**: Hosting
- **Razorpay**: Payments
- **Resend/Blastable**: Email
- **Gallabox**: WhatsApp Business API
- **Linkila**: URL shortening
- **OCR.space**: Ticket OCR
- **Anthropic**: AI features

## Database (Main Tables)
`users`, `events`, `faculty`, `members`, `registrations`, `sessions`, `faculty_assignments`, `forms`, `form_fields`, `form_submissions`, `badges`, `badge_templates`, `certificates`, `certificate_templates`, `abstracts`, `abstract_reviews`, `email_templates`, `email_logs`, `orders`, `payments`, `tickets`, `team_members`, `travel_bookings`, `flights`, `hotels`, `communications_settings`, `activity_logs`

## Live Site
collegeofmas.org.in (Vercel)
