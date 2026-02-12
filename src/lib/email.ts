/**
 * Unified Email Service
 * Supports multiple providers: Resend, Blastable
 */

type EmailAttachment = {
  filename: string
  content: Buffer | string
}

type EmailOptions = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  attachments?: EmailAttachment[]
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
    return { success: false, error: "From email not configured" }
  }

  try {
    const response = await fetch("https://blastable.com/send-email/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        from_email: fromEmail.includes("<") ? fromEmail.match(/<(.+)>/)?.[1] || fromEmail : fromEmail,
        to: Array.isArray(options.to) ? options.to : options.to,
        subject: options.subject,
        html_body: options.html,
        text_body: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      }),
    })

    const result = await response.json()

    if (response.ok && result.status === "success") {
      const logKey = result.delivery_logs?.[0]?.log_key || `blastable-${Date.now()}`
      console.log(`[Blastable] Email sent to ${options.to} - ID: ${logKey}`)
      return { success: true, id: logKey }
    } else {
      console.error("[Blastable] API error:", result)
      return { success: false, error: result.error || "Failed to send email" }
    }
  } catch (error: any) {
    console.error("[Blastable] Request failed:", error)
    return { success: false, error: error.message || "Request failed" }
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
    // Dynamic import to avoid loading Resend when not needed
    const { Resend } = await import("resend")
    const resend = new Resend(apiKey)

    const emailPayload: any = {
      from: fromEmail,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }

    if (options.attachments && options.attachments.length > 0) {
      emailPayload.attachments = options.attachments.map((att) => ({
        filename: att.filename,
        content: att.content instanceof Buffer ? att.content : Buffer.from(att.content, "base64"),
      }))
    }

    const result = await resend.emails.send(emailPayload)

    if (result.error) {
      console.error("[Resend] API error:", result.error)
      return { success: false, error: result.error.message }
    }

    console.log(`[Resend] Email sent to ${options.to} - ID: ${result.data?.id}`)
    return { success: true, id: result.data?.id }
  } catch (error: any) {
    console.error("[Resend] Request failed:", error)
    return { success: false, error: error.message || "Request failed" }
  }
}

/**
 * Send an email using the configured provider
 * Priority: Blastable > Resend
 */
export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  const provider = getProvider()

  if (!provider) {
    console.log(`[Email] No provider configured - would send to ${options.to}`)
    console.log(`[Email] Subject: ${options.subject}`)
    return {
      success: true,
      id: `dev-${Date.now()}`,
      error: "No email provider configured (dev mode)",
    }
  }

  console.log(`[Email] Sending via ${provider} to ${options.to}`)

  if (provider === "blastable") {
    return sendViaBlastable(options)
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
