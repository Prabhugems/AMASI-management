import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { sendEmail } from "@/lib/email"
import { COMPANY_CONFIG } from "@/lib/config"

// HMAC signing key for OTP tokens (no server-side storage needed). No
// fallback on purpose: every other route in this app already requires
// SUPABASE_SERVICE_ROLE_KEY to function, so a misconfigured deployment
// fails loudly here too rather than silently signing OTP tokens with a
// hardcoded, publicly-known string.
function getSigningKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")
  return key
}

// Generate 6-digit OTP using cryptographically secure random
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

function hashOtp(otp: string, signingKey: string): string {
  return crypto.createHmac("sha256", signingKey).update(otp).digest("hex")
}

// Create a signed token containing { email, otpHash, exp, form_id }.
// The token round-trips through the client (returned from POST, submitted
// back with PUT), so it must never contain the OTP itself — only base64
// encoding stands between the payload and anyone who receives the
// response, which isn't confidentiality at all. otpHash is an HMAC over
// the OTP keyed with the same server-only signing key used for the outer
// tamper-detection signature, so recovering the OTP from the hash requires
// the secret key, not just the token.
function createOtpToken(email: string, otp: string, formId: string): string {
  const signingKey = getSigningKey()
  const payload = JSON.stringify({
    email,
    otpHash: hashOtp(otp, signingKey),
    form_id: formId,
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes
  })
  const encoded = Buffer.from(payload).toString("base64url")
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(encoded)
    .digest("base64url")
  return `${encoded}.${signature}`
}

// Verify and decode a signed OTP token
function verifyOtpToken(token: string): { email: string; otpHash: string; form_id: string; exp: number } | null {
  const signingKey = getSigningKey()
  const parts = token.split(".")
  if (parts.length !== 2) return null

  const [encoded, signature] = parts
  const expectedSig = crypto
    .createHmac("sha256", signingKey)
    .update(encoded)
    .digest("base64url")

  if (signature.length !== expectedSig.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString())
  } catch {
    return null
  }
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

    const isDevelopment = process.env.NODE_ENV === "development"
    const formId = form_id || "global"

    // For test emails in development, return OTP directly without sending email
    if (isTestEmail(email) && isDevelopment) {
      const otp = generateOTP()
      const otpToken = createOtpToken(email, otp, formId)
      return NextResponse.json({
        success: true,
        message: "Test mode - use the OTP shown",
        dev_otp: otp,
        otp_token: otpToken,
      })
    }

    // Block test emails in production
    if (isTestEmail(email)) {
      return NextResponse.json(
        { error: "Please use a valid email address" },
        { status: 400 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const otpToken = createOtpToken(email, otp, formId)

    // Send OTP via unified email service
    const subject = "Your Verification Code"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #10b981; margin: 0;">${COMPANY_CONFIG.name}</h1>
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
    `

    const result = await sendEmail({ to: email, subject, html })

    if (!result.success) {
      console.error("Email send error:", result.error)
      if (isDevelopment) {
        return NextResponse.json({
          success: true,
          message: "Email service error - use this code",
          dev_otp: otp,
          otp_token: otpToken,
        })
      }
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
      otp_token: otpToken,
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
    const { email, otp, form_id, otp_token } = body

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and verification code are required" },
        { status: 400 }
      )
    }

    if (!otp_token) {
      return NextResponse.json(
        { error: "No verification code found. Please request a new code." },
        { status: 400 }
      )
    }

    // Verify the signed token
    const tokenData = verifyOtpToken(otp_token)
    if (!tokenData) {
      return NextResponse.json(
        { error: "Invalid verification token. Please request a new code." },
        { status: 400 }
      )
    }

    // Check expiry
    if (Date.now() > tokenData.exp) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new code." },
        { status: 400 }
      )
    }

    // Check email matches
    if (tokenData.email !== email) {
      return NextResponse.json(
        { error: "Email mismatch. Please request a new code." },
        { status: 400 }
      )
    }

    // Check form_id matches
    if (tokenData.form_id !== (form_id || "global")) {
      return NextResponse.json(
        { error: "Invalid verification context. Please request a new code." },
        { status: 400 }
      )
    }

    // Check OTP matches — compare hashes, not the raw code (the token
    // never carries the raw OTP; see createOtpToken).
    const submittedHash = hashOtp(otp, getSigningKey())
    const otpMatches =
      submittedHash.length === tokenData.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(tokenData.otpHash))
    if (!otpMatches) {
      return NextResponse.json(
        { error: "Invalid verification code. Please try again." },
        { status: 400 }
      )
    }

    // OTP verified successfully - generate a verification token for this session
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
