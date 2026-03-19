import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"
import { sendEmail, isEmailEnabled } from "@/lib/email"

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// POST /api/email/send - Send custom email (auth required)
export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isEmailEnabled()) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 })
    }

    const { to, subject, html } = await request.json()

    if (!subject || !html) {
      return NextResponse.json({ error: "subject and html are required" }, { status: 400 })
    }

    // Support single email or array
    const recipients = Array.isArray(to) ? to : [to]

    if (!recipients.length || !recipients[0]) {
      return NextResponse.json({ error: "to is required" }, { status: 400 })
    }

    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (const email of recipients) {
      const result = await sendEmail({ to: email, subject, html })
      if (result.success) {
        sent++
      } else {
        failed++
        errors.push(`${email}: ${result.error}`)
      }
      if (recipients.length > 1) await delay(250)
    }

    return NextResponse.json({ sent, failed, total: recipients.length, errors })
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
