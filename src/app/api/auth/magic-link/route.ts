import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

function getMagicLinkEmailHtml(loginUrl: string): string {
  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to AMASI</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 520px; border-collapse: collapse;">

          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="width: 48px; height: 48px; background-color: rgba(255,255,255,0.2); border-radius: 12px; text-align: center; vertical-align: middle;">
                    <span style="color: white; font-size: 22px; font-weight: bold; line-height: 48px;">A</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">AMASI</h1>
                    <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 13px;">Command Center</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 40px 30px; text-align: center;">

              <!-- Lock Icon -->
              <div style="width: 64px; height: 64px; border-radius: 50%; background-color: #eff6ff; margin: 0 auto 24px auto; line-height: 64px;">
                <span style="font-size: 28px; line-height: 64px;">&#128274;</span>
              </div>

              <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 22px; font-weight: 700;">
                Sign in to your account
              </h2>
              <p style="color: #6b7280; margin: 0 0 32px 0; font-size: 15px; line-height: 1.5;">
                Click the button below to securely sign in to your AMASI dashboard. No password needed.
              </p>

              <!-- Login Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 12px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 16px 48px; color: white; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
                      Click to Login
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="margin: 32px 0; border-top: 1px solid #e5e7eb;"></div>

              <!-- Alternative Link -->
              <p style="color: #9ca3af; margin: 0 0 12px 0; font-size: 13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #2563eb; margin: 0 0 32px 0; font-size: 13px; word-break: break-all; line-height: 1.6;">
                <a href="${loginUrl}" style="color: #2563eb; text-decoration: underline;">${loginUrl}</a>
              </p>

              <!-- Security Notice -->
              <div style="background-color: #f9fafb; border-radius: 10px; padding: 16px 20px; text-align: left;">
                <p style="color: #6b7280; margin: 0; font-size: 13px; line-height: 1.5;">
                  <strong style="color: #374151;">Security notice:</strong> This link expires in 24 hours and can only be used once. If you didn't request this email, you can safely ignore it.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #111827; padding: 24px 30px; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 13px;">
                Association of Minimal Access Surgeons of India
              </p>
              <p style="color: #4b5563; margin: 0; font-size: 12px;">
                &copy; ${year} AMASI. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// POST /api/auth/magic-link - Generate magic link and send custom email
export async function POST(request: NextRequest) {
  try {
    // Rate limit: strict tier for auth endpoints
    const ip = getClientIp(request)
    const rateLimitResult = checkRateLimit(
      `auth-magic-link:${ip}`,
      "strict"
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.reset),
          },
        }
      )
    }

    const { email, redirectTo } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Build the callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || ""
    const callbackUrl = redirectTo
      ? `${appUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`
      : `${appUrl}/auth/callback`

    // Generate magic link using Supabase Admin API
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Auth service not configured" },
        { status: 500 }
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: linkData, error: linkError } =
      await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
        options: {
          redirectTo: callbackUrl,
        },
      })

    if (linkError) {
      console.error("[Magic Link] Failed to generate link:", linkError.message)
      return NextResponse.json(
        { error: "Failed to generate login link" },
        { status: 500 }
      )
    }

    // Use the action_link returned by Supabase (contains the full verification URL)
    const loginUrl = linkData.properties?.action_link
    if (!loginUrl) {
      console.error("[Magic Link] No action_link in response")
      return NextResponse.json(
        { error: "Failed to generate login link" },
        { status: 500 }
      )
    }

    // Send custom designed email
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: "Sign in to AMASI",
      html: getMagicLinkEmailHtml(loginUrl),
      text: `Sign in to AMASI\n\nClick the link below to sign in to your account:\n${loginUrl}\n\nThis link expires in 24 hours and can only be used once.\n\nIf you didn't request this email, you can safely ignore it.\n\n© ${new Date().getFullYear()} AMASI - Association of Minimal Access Surgeons of India`,
    })

    if (!emailResult.success) {
      console.error("[Magic Link] Failed to send email:", emailResult.error)
      return NextResponse.json(
        { error: "Failed to send login email" },
        { status: 500 }
      )
    }

    console.log(`[Magic Link] Sent to ${normalizedEmail} via custom email - ID: ${emailResult.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Magic Link] Error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}
