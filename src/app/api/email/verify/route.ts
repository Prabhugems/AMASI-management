import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import crypto from "crypto"

// Initialize Resend (will be undefined if no API key)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// In-memory OTP store (in production, use Redis or database)
const otpStore = new Map<string, { otp: string; expires: number; attempts: number }>()

// Generate 6-digit OTP using cryptographically secure random
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

// Check for disposable email domains
const disposableDomains = [
  "tempmail.com", "throwaway.email", "guerrillamail.com", "10minutemail.com",
  "mailinator.com", "yopmail.com", "fakeinbox.com", "trashmail.com",
  "getnada.com", "temp-mail.org", "disposablemail.com"
]

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  return disposableDomains.includes(domain)
}

// Test email domains that bypass verification (for development)
const testDomains = ["test.com", "example.com", "test.local"]

function isTestEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase()
  return testDomains.includes(domain)
}

// POST /api/email/verify - Send OTP to email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, form_id } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Check for disposable email (but allow test emails)
    if (isDisposableEmail(email) && !isTestEmail(email)) {
      return NextResponse.json(
        { error: "Please use a permanent email address" },
        { status: 400 }
      )
    }

    // For test emails in development, return OTP directly without sending email
    const isDevelopment = process.env.NODE_ENV === "development"
    if (isTestEmail(email) && isDevelopment) {
      const otp = generateOTP()
      const key = `${email}:${form_id || 'global'}`
      otpStore.set(key, { otp, expires: Date.now() + 10 * 60 * 1000, attempts: 1 })
      return NextResponse.json({
        success: true,
        message: "Test mode - use the OTP shown",
        dev_otp: otp
      })
    }

    // Block test emails in production
    if (isTestEmail(email)) {
      return NextResponse.json(
        { error: "Please use a valid email address" },
        { status: 400 }
      )
    }

    // Rate limiting - max 3 OTPs per email per 10 minutes
    const key = `${email}:${form_id || 'global'}`
    const existing = otpStore.get(key)
    if (existing && existing.attempts >= 3 && Date.now() < existing.expires + 600000) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again in 10 minutes." },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const expires = Date.now() + 10 * 60 * 1000 // 10 minutes

    // Store OTP
    otpStore.set(key, {
      otp,
      expires,
      attempts: (existing?.attempts || 0) + 1
    })

    // Send OTP via Resend
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "AMASI Forms <noreply@resend.dev>",
          to: email,
          subject: "Your Verification Code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #10b981; margin: 0;">AMASI</h1>
              </div>
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px; padding: 30px; text-align: center;">
                <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Your verification code is:</p>
                <div style="background: white; border-radius: 12px; padding: 20px; display: inline-block;">
                  <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #10b981;">${otp}</span>
                </div>
                <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 20px 0 0 0;">This code expires in 10 minutes</p>
              </div>
              <p style="color: #666; font-size: 12px; text-align: center; margin-top: 20px;">
                If you didn't request this code, please ignore this email.
              </p>
            </div>
          `,
        })

        // Check if Resend returned an error
        if (result.error) {
          console.error("Resend API error:", result.error)
          // In production, don't expose OTP even on error
          if (isDevelopment) {
            return NextResponse.json({
              success: true,
              message: "Email service error - use this code",
              dev_otp: otp
            })
          }
          return NextResponse.json(
            { error: "Failed to send verification email. Please try again." },
            { status: 500 }
          )
        }
      } catch (emailError) {
        console.error("Resend error:", emailError)
        // In production, don't expose OTP on error
        if (isDevelopment) {
          return NextResponse.json({
            success: true,
            message: "Verification code generated",
            dev_otp: otp
          })
        }
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again." },
          { status: 500 }
        )
      }
    } else {
      // No Resend API key
      if (isDevelopment) {
        return NextResponse.json({
          success: true,
          message: "Verification code generated (dev mode)",
          dev_otp: otp
        })
      }
      // In production without email service, fail gracefully
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email"
    })
  } catch (error) {
    console.error("Error in POST /api/email/verify:", error)
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    )
  }
}

// PUT /api/email/verify - Verify OTP
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, otp, form_id } = body

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      )
    }

    const key = `${email}:${form_id || 'global'}`
    const stored = otpStore.get(key)

    if (!stored) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new code." },
        { status: 400 }
      )
    }

    if (Date.now() > stored.expires) {
      otpStore.delete(key)
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      )
    }

    if (stored.otp !== otp) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      )
    }

    // OTP verified successfully
    otpStore.delete(key)

    // Generate a verification token for this session
    const verificationToken = Buffer.from(
      JSON.stringify({ email, verified_at: Date.now(), form_id })
    ).toString("base64")

    return NextResponse.json({
      success: true,
      verified: true,
      email,
      token: verificationToken
    })
  } catch (error) {
    console.error("Error in PUT /api/email/verify:", error)
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    )
  }
}
