import { NextRequest, NextResponse } from "next/server"
import { sendEmail, isEmailEnabled, getEmailProvider } from "@/lib/email"

/**
 * Email Diagnostic Endpoint
 *
 * GET  /api/email/test          → Show email configuration status
 * POST /api/email/test { to }   → Send a test email and show full result
 */

export async function GET() {
  const provider = getEmailProvider()
  const enabled = isEmailEnabled()

  // Gather all email-related env vars (show presence, not values)
  const config = {
    email_enabled: enabled,
    provider: provider || "none",
    RESEND_API_KEY: process.env.RESEND_API_KEY ? `set (${process.env.RESEND_API_KEY.substring(0, 6)}...)` : "NOT SET",
    BLASTABLE_API_KEY: process.env.BLASTABLE_API_KEY ? `set (${process.env.BLASTABLE_API_KEY.substring(0, 6)}...)` : "NOT SET",
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || "NOT SET",
    BLASTABLE_FROM_EMAIL: process.env.BLASTABLE_FROM_EMAIL || "NOT SET",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
    LINKILA_API_KEY: process.env.LINKILA_API_KEY ? "set" : "NOT SET",
  }

  // Determine effective from_email based on provider
  let effectiveFrom = "unknown"
  if (provider === "blastable") {
    effectiveFrom = process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "NOT SET - emails will fail!"
  } else if (provider === "resend") {
    effectiveFrom = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"
  }

  // Warnings
  const warnings: string[] = []
  if (!enabled) {
    warnings.push("No email provider configured. Set RESEND_API_KEY or BLASTABLE_API_KEY in Vercel Environment Variables.")
  }
  if (process.env.BLASTABLE_API_KEY && process.env.RESEND_API_KEY) {
    warnings.push("Both BLASTABLE_API_KEY and RESEND_API_KEY are set. Blastable takes priority. Remove BLASTABLE_API_KEY if you want to use Resend.")
  }
  if (provider === "blastable" && !process.env.BLASTABLE_FROM_EMAIL && !process.env.RESEND_FROM_EMAIL) {
    warnings.push("Using Blastable but no from email configured. Set BLASTABLE_FROM_EMAIL or RESEND_FROM_EMAIL.")
  }
  if (provider === "resend" && !process.env.RESEND_FROM_EMAIL) {
    warnings.push("RESEND_FROM_EMAIL not set. Will use default noreply@resend.dev which only works for testing.")
  }
  if (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL === "http://localhost:3000") {
    warnings.push("NEXT_PUBLIC_APP_URL not set or still localhost. Speaker portal links won't work in production.")
  }

  return NextResponse.json({
    status: enabled ? "configured" : "not_configured",
    config,
    effective_from_email: effectiveFrom,
    warnings,
    hint: "To test sending, POST to this endpoint with { \"to\": \"your@email.com\" }",
  })
}

export async function POST(request: NextRequest) {
  try {
    const { to } = await request.json()

    if (!to) {
      return NextResponse.json(
        { error: "Provide { \"to\": \"your@email.com\" } to send a test email" },
        { status: 400 }
      )
    }

    const provider = getEmailProvider()
    const enabled = isEmailEnabled()

    if (!enabled) {
      return NextResponse.json({
        success: false,
        provider: "none",
        error: "No email provider configured. Set RESEND_API_KEY or BLASTABLE_API_KEY.",
      }, { status: 503 })
    }

    // Determine from email for diagnostics
    let effectiveFrom = "unknown"
    if (provider === "blastable") {
      effectiveFrom = process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "NOT SET"
    } else if (provider === "resend") {
      effectiveFrom = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"
    }

    console.log(`[Email Test] Sending test email via ${provider} from "${effectiveFrom}" to "${to}"`)

    const result = await sendEmail({
      to,
      subject: "AMASI Email Test - Configuration Check",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h1 style="color: #7c3aed;">Email Working!</h1>
          <p>This is a test email from your AMASI management system.</p>
          <p><strong>Provider:</strong> ${provider}</p>
          <p><strong>From:</strong> ${effectiveFrom}</p>
          <p><strong>To:</strong> ${to}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <p style="color: #22c55e; font-weight: bold;">If you see this, your email configuration is working correctly!</p>
        </div>
      `,
    })

    return NextResponse.json({
      success: result.success,
      provider,
      from_email: effectiveFrom,
      to,
      email_id: result.id,
      error: result.error,
      ...(result.error ? {
        troubleshooting: getTroubleshootingTips(provider, result.error),
      } : {}),
    }, { status: result.success ? 200 : 500 })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Request failed",
    }, { status: 500 })
  }
}

function getTroubleshootingTips(provider: string | null, error: string): string[] {
  const tips: string[] = []

  if (error.includes("not verified") || error.includes("not a verified")) {
    tips.push("Your sending domain is not verified in Resend. Go to https://resend.com/domains and add/verify your domain.")
    tips.push("You need to add DNS records (MX, TXT, DKIM) to your domain registrar.")
  }

  if (error.includes("can only send") || error.includes("testing") || error.includes("onboarding@resend.dev")) {
    tips.push("On Resend free plan without a verified domain, you can only send to your own email address.")
    tips.push("Verify your domain at https://resend.com/domains to send to any email address.")
  }

  if (error.includes("API key") || error.includes("Unauthorized") || error.includes("401")) {
    tips.push("Your API key may be invalid or expired. Check your API key in Resend/Blastable dashboard.")
  }

  if (error.includes("rate") || error.includes("limit") || error.includes("429")) {
    tips.push("You've hit the rate limit. Wait a few minutes and try again.")
    tips.push("Resend free plan: 100 emails/day, 1 email/second.")
  }

  if (provider === "blastable") {
    tips.push("Check if your Blastable account is active and has sending credits.")
    tips.push("If Blastable isn't working, remove BLASTABLE_API_KEY from Vercel to use Resend instead.")
  }

  if (tips.length === 0) {
    tips.push(`Error from ${provider}: ${error}`)
    tips.push("Check the Vercel deployment logs for more details.")
  }

  return tips
}
