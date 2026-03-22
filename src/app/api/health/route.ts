import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/api-auth'
import { createAdminClient } from '@/lib/supabase/server'

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'not_configured'

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latency?: number
  provider?: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const services: ServiceCheck[] = []

  // 1. Database check — simple query via Supabase
  try {
    const start = Date.now()
    const supabase = await createAdminClient()
    const { error } = await supabase.from('users').select('id', { count: 'exact', head: true })
    const latency = Date.now() - start

    if (error) {
      services.push({ name: 'Database', status: 'down', latency })
    } else {
      services.push({
        name: 'Database',
        status: latency > 3000 ? 'degraded' : 'healthy',
        latency,
      })
    }
  } catch {
    services.push({ name: 'Database', status: 'down' })
  }

  // 2. Email Service — check env vars
  const hasBlastable = !!(process.env.BLASTABLE_API_KEY?.trim() && process.env.BLASTABLE_FROM_EMAIL?.trim())
  const hasResend = !!(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim())

  if (hasBlastable) {
    services.push({ name: 'Email', status: 'healthy', provider: 'blastable' })
  } else if (hasResend) {
    services.push({ name: 'Email', status: 'healthy', provider: 'resend' })
  } else {
    services.push({ name: 'Email', status: 'not_configured' })
  }

  // 3. Payment Gateway — check env vars
  const hasRazorpay = !!(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim())

  if (hasRazorpay) {
    services.push({ name: 'Payments', status: 'healthy', provider: 'razorpay' })
  } else {
    services.push({ name: 'Payments', status: 'not_configured' })
  }

  // 4. WhatsApp — check env vars
  const hasQikchat = !!process.env.QIKCHAT_API_KEY?.trim()
  const hasGallabox = !!(
    process.env.GALLABOX_API_KEY?.trim() &&
    process.env.GALLABOX_API_SECRET?.trim() &&
    process.env.GALLABOX_CHANNEL_ID?.trim()
  )

  if (hasQikchat) {
    services.push({ name: 'WhatsApp', status: 'healthy', provider: 'qikchat' })
  } else if (hasGallabox) {
    services.push({ name: 'WhatsApp', status: 'healthy', provider: 'gallabox' })
  } else {
    services.push({ name: 'WhatsApp', status: 'not_configured' })
  }

  // Determine overall status
  const statuses = services.map(s => s.status)
  let overall: ServiceStatus = 'healthy'
  if (statuses.includes('down')) {
    overall = 'down'
  } else if (statuses.includes('degraded')) {
    overall = 'degraded'
  }

  return NextResponse.json({
    services,
    overall,
    checked_at: new Date().toISOString(),
  })
}
