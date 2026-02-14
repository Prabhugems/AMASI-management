/**
 * Unified Email Service
 * Supports multiple providers: Resend, Blastable
 */

type EmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
}

type SendResult = {
  success: boolean
  id?: string
  error?: string
}

// Get active email provider from environment
function getProvider(): "blastable" | "resend" | null {
  if (process.env.BLASTABLE_API_KEY) return "blastable"
  if (process.env.RESEND_API_KEY) return "resend"
  return null
}

// Send email via Blastable API
async function sendViaBlastable(options: EmailOptions): Promise<SendResult> {
  const apiKey = process.env.BLASTABLE_API_KEY
  if (!apiKey) {
    return { success: false, error: "BLASTABLE_API_KEY not configured" }
  }

  const fromEmail = options.from || process.env.BLASTABLE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    return { success: false, error: "Blastable: No from email configured. Set BLASTABLE_FROM_EMAIL or RESEND_FROM_EMAIL." }
  }

  try {
    // Extract plain email from "Name <email>" format
    const plainFrom = fromEmail.includes("<") ? fromEmail.match(/<(.+)>/)?.[1] || fromEmail : fromEmail
    // Blastable expects `to` as a string (comma-separated for multiple)
    const toStr = Array.isArray(options.to) ? options.to.join(",") : options.to

    console.log(`[Blastable] Sending from "${plainFrom}" to "${toStr}" subject="${options.subject}"`)

    const response = await fetch("https://blastable.com/send-email/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        from_email: plainFrom,
        to: toStr,
        subject: options.subject,
        html_body: options.html,
        text_body: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      }),
    })

    const result = await response.json()

    if (response.ok && result.status === "success") {
      const logKey = result.delivery_logs?.[0]?.log_key || `blastable-${Date.now()}`
      console.log(`[Blastable] Email sent to ${toStr} - ID: ${logKey}`)
      return { success: true, id: logKey }
    } else {
      const errorDetail = result.error || result.message || result.errors || JSON.stringify(result)
      console.error(`[Blastable] API error (HTTP ${response.status}):`, JSON.stringify(result))
      return { success: false, error: `Blastable (from: ${plainFrom}): ${typeof errorDetail === 'string' ? errorDetail : JSON.stringify(errorDetail)}` }
    }
  } catch (error: any) {
    console.error("[Blastable] Request failed:", error)
    return { success: false, error: `Blastable request failed: ${error.message || "Unknown error"}` }
  }
}

// Send email via Resend API
async function sendViaResend(options: EmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" }
  }

  const fromEmail = options.from || process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

  try {
    console.log(`[Resend] Sending from "${fromEmail}" to "${options.to}" subject="${options.subject}"`)

    // Dynamic import to avoid loading Resend when not needed
    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)

    const result = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    })

    if (result.error) {
      console.error("[Resend] API error:", JSON.stringify(result.error))
      const errorMsg = result.error.message || JSON.stringify(result.error)
      // Add helpful hints for common Resend errors
      if (errorMsg.includes("not verified") || errorMsg.includes("not a verified")) {
        return { success: false, error: `Resend: ${errorMsg}. Go to resend.com/domains and verify your sending domain.` }
      }
      if (errorMsg.includes("can only send") || errorMsg.includes("testing")) {
        return { success: false, error: `Resend: ${errorMsg}. On Resend free plan you can only send to your own email. Add and verify your domain at resend.com/domains to send to anyone.` }
      }
      return { success: false, error: `Resend (from: ${fromEmail}): ${errorMsg}` }
    }

    console.log(`[Resend] Email sent to ${options.to} - ID: ${result.data?.id}`)
    return { success: true, id: result.data?.id }
  } catch (error: any) {
    console.error("[Resend] Request failed:", error)
    return { success: false, error: `Resend error: ${error.message || "Request failed"}` }
  }
}

/**
 * Send an email using the configured provider
 * Priority: Blastable > Resend
 * If primary provider fails and secondary is available, falls back to secondary
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const provider = getProvider()

  if (!provider) {
    console.error(`[Email] FAILED: No email provider configured. Set RESEND_API_KEY or BLASTABLE_API_KEY in environment variables.`)
    console.error(`[Email] Would have sent to: ${options.to}, Subject: ${options.subject}`)
    return {
      success: false,
      error: "No email provider configured. Add RESEND_API_KEY or BLASTABLE_API_KEY to your Vercel Environment Variables and redeploy.",
    }
  }

  console.log(`[Email] Sending via ${provider} to ${options.to}`)

  if (provider === "blastable") {
    const result = await sendViaBlastable(options)
    // If Blastable fails and Resend is also configured, try Resend as fallback
    if (!result.success && process.env.RESEND_API_KEY) {
      console.log(`[Email] Blastable failed (${result.error}), falling back to Resend...`)
      const resendResult = await sendViaResend(options)
      if (resendResult.success) {
        return resendResult
      }
      // Both failed - return both errors
      return { success: false, error: `Primary: ${result.error} | Fallback: ${resendResult.error}` }
    }
    return result
  } else {
    return sendViaResend(options)
  }
}

/**
 * Check if email is enabled
 */
export function isEmailEnabled(): boolean {
  return getProvider() !== null
}

/**
 * Get the active email provider name
 */
export function getEmailProvider(): string | null {
  return getProvider()
}
