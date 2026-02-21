import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Skip auth if Supabase is not configured (for development)
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // Print pages under any route are public (e.g. /events/[id]/travel/flights/print)
  const isPrintPage = request.nextUrl.pathname.endsWith('/print') || request.nextUrl.pathname.includes('/print/')

  const isProtectedRoute = !isPrintPage && protectedRoutes.some(
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
    '/badge',              // Badge pages (token-based)
    '/v',                  // Certificate verification (token-based)
    '/checkin/access',     // Check-in access (token-based)
    '/api/travel-agent',   // Travel agent APIs (used by agent portals)
    '/abstract-reviewer',  // Abstract reviewer portal (token-based)
    '/api/abstract-reviewer', // Abstract reviewer APIs
    '/membership',          // Public membership application form
    '/api/membership/apply', // Public membership application API
    '/api/travel/flights-print', // Public flights print data API
  ]
  const _isPublicRoute = publicRoutes.some(
    (route) =>
      request.nextUrl.pathname === route ||
      request.nextUrl.pathname.startsWith(`${route}/`)
  )

  if (!user && isProtectedRoute) {
    // No user, redirect to login
    const url = request.nextUrl.clone()
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
