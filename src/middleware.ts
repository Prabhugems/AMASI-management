import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const supabaseConfigured = Boolean(
    supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')
  )

  // Missing Supabase config skips auth in DEVELOPMENT ONLY.
  //
  // This used to short-circuit in every environment, so a deploy missing
  // NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY served every
  // protected page to everyone, silently. That is not hypothetical here: this
  // repo deploys to several tenant Vercel projects (essurg-2026, cos-2026, …),
  // each with its own environment variables, so one missed variable on one
  // project was enough — and the failure mode was an open admin dashboard
  // rather than an error anyone would notice.
  //
  // In production the request now continues with `user` left null, so the
  // existing protected-route check below redirects to /login while public and
  // token-based routes keep working. Fail closed, without taking the site down.
  if (!supabaseConfigured && process.env.NODE_ENV !== 'production') {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = supabaseConfigured ? createServerClient(
    supabaseUrl!,
    supabaseAnonKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  ) : null

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // `user` stays null when Supabase is unconfigured in production — that is the
  // fail-closed path described above, not an error state to swallow.
  let user = null
  if (supabase) {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } else {
    console.error(
      '[middleware] Supabase env vars missing in production — every request is being treated as unauthenticated'
    )
  }

  // Protected routes - redirect to login if not authenticated
  const protectedRoutes = [
    '/',
    '/events',
    '/faculty',
    '/delegates',
    '/certificates',
    '/check-in',
    '/travel',
    '/accommodation',
    '/finance',
    '/settings',
    '/profile',
    '/audit',
    '/members',
    '/forms',
    '/team',
    '/help',
    '/status',
  ]

  // Print pages and public program pages under any route are public
  const isPrintPage = request.nextUrl.pathname.endsWith('/print') || request.nextUrl.pathname.includes('/print/')
  const isPublicProgram = request.nextUrl.pathname.includes('/program/public')
  // A brand-new invitee is necessarily unauthenticated -- this page must stay
  // reachable without a session, same as every other token-based public page
  // below, even though it lives under the /team prefix (which is otherwise a
  // real protected admin area). Its own API route (POST
  // /api/team/invite/[id]/accept) is already public/no-auth; this closes the
  // matching gap on the page side, which was sending every invitee straight
  // to /login (dropping their ?token= in the process) before they ever saw
  // the accept flow.
  const isAcceptInvitePage = request.nextUrl.pathname === '/team/accept-invite'

  const isProtectedRoute = !isPrintPage && !isPublicProgram && !isAcceptInvitePage && protectedRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`)
  )

  // Public routes that don't require auth
  const publicRoutes = [
    '/login',
    '/auth/callback',
    '/register',           // Public event registration
    '/respond',            // Speaker/faculty confirmation response page
    '/api/payments',       // Payment APIs (webhook needs public access)
    '/api/print',          // Print lookup API (public for desktop app)
    '/api/print-stations', // Print station APIs (public for kiosk/desktop app)
    '/print-station',      // Print station download page
    '/travel-agent',       // Travel agent portal (token-based)
    '/flight-agent',       // Flight agent portal (token-based)
    '/train-agent',        // Train agent portal (token-based)
    '/cab-agent',          // Cab/transfer agent portal (token-based)
    '/speaker-portal',     // Speaker portal (token-based)
    '/speaker',            // Speaker page (token-based)
    '/hall-coordinator',   // Hall coordinator portal (token-based)
    '/driver-portal',      // Driver portal (phone-based)
    '/print',              // Print/badge pages (token-based)
    '/print-agent',        // Print agent page (token-based)
    '/badge',              // Badge pages (token-based)
    '/v',                  // Certificate verification (token-based)
    '/checkin/access',     // Check-in access (token-based)
    '/audio-desk',         // Audio device desk (public, event-id in URL)
    '/api/audio-devices',  // Audio device APIs (public companion to /audio-desk)
    '/api/travel-agent',   // Travel agent APIs (used by agent portals)
    '/abstract-reviewer',  // Abstract reviewer portal (token-based)
    '/api/abstract-reviewer', // Abstract reviewer APIs
    '/api/travel/flights-print', // Public flights print data API
    '/examiner',            // Examiner portal (token-based)
    '/api/examination/examiner', // Examiner portal API (token-based)
    '/my',                  // Delegate portal (email/phone lookup, public)
    '/api/my',              // Delegate portal API
    '/convocation',         // Public convocation portal
    '/api/convocation',     // Public convocation lookup API
    '/api/sheet-webhook',   // AMASICON 2026 Google Sheets edit webhook (token-gated in-route)
    '/api/sheet-changes',   // AMASICON 2026 SSE stream to dashboard tabs
    '/api/sheet-write',     // AMASICON 2026 sheet write-back proxy (token-gated in-route)
    '/api/gmail-webhook',   // AMASICON 2026 Gmail-reply webhook (token-gated in-route)
  ]
  const _isPublicRoute = publicRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`)
  )

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()

    // Root path: show landing page for deployments that have one configured
    const landingPage = process.env.NEXT_PUBLIC_LANDING_PAGE
    if (request.nextUrl.pathname === '/' && landingPage) {
      url.pathname = landingPage
      return NextResponse.rewrite(url)
    }

    // Other protected routes: redirect to login
    url.pathname = '/login'

    // Validate redirectTo is a relative path (prevent open redirect attacks)
    const redirectPath = request.nextUrl.pathname
    // Only allow relative paths starting with / and not containing protocol or double slashes
    if (redirectPath.startsWith('/') && !redirectPath.startsWith('//') && !redirectPath.includes('://')) {
      url.searchParams.set('redirectTo', redirectPath)
    }
    // If invalid, don't set redirectTo - will redirect to home after login

    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    // User is logged in, redirect to dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
