import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { renderEmailTemplate } from "@/lib/email-templates"
import { escapeHtml } from "@/lib/string-utils"

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface RegistrationEmailData {
  registration_id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  event_id?: string
  event_name: string
  event_date: string
  event_venue: string
  ticket_name: string
  quantity: number
  total_amount: number
  payment_method: string
  payment_status: string
}

// POST /api/email/registration-confirmation - Send registration confirmation email
export async function POST(request: NextRequest) {
  try {
    const body: RegistrationEmailData = await request.json()

    const {
      registration_number,
      attendee_name,
      attendee_email,
      event_id,
      event_name,
      event_date,
      event_venue,
      ticket_name,
      quantity,
      total_amount,
      payment_method,
      payment_status,
    } = body

    if (!attendee_email || !registration_number) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Format the event date
    const formattedDate = event_date
      ? new Date(event_date).toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "To be announced"

    // Payment status text
    const paymentStatusText = payment_status === "completed"
      ? "Payment Confirmed"
      : payment_method === "cash"
        ? "Pay at Venue"
        : payment_method === "bank_transfer"
          ? "Pending Bank Transfer"
          : "Pending"

    // Payment status color
    const paymentStatusColor = payment_status === "completed" ? "#10b981" : "#f59e0b"

    // Try to use email template system first
    let emailSubject: string
    let emailHtml: string

    const templateVariables = {
      attendee_name,
      attendee_email,
      registration_number,
      ticket_type: ticket_name,
      amount: `₹${total_amount.toLocaleString("en-IN")}`,
      event_name,
      event_date: formattedDate,
      venue_name: event_venue || "To be announced",
      venue_address: event_venue || "",
      payment_id: "",
      organizer_name: "AMASI",
      organizer_email: "support@amasi.org",
      year: new Date().getFullYear().toString(),
    }

    // Try to get custom template
    const customTemplate = await renderEmailTemplate(
      "registration_confirmation",
      templateVariables,
      event_id
    )

    if (customTemplate) {
      emailSubject = customTemplate.subject
      emailHtml = customTemplate.body_html
    } else {
      // Fall back to hardcoded template
      emailSubject = `Registration Confirmed - ${event_name} [${registration_number}]`
      emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Registration Confirmed!</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Thank you for registering, ${escapeHtml(attendee_name || "")}!</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <!-- Registration Number -->
                    <div style="background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px;">
                      <p style="color: #666; margin: 0 0 5px 0; font-size: 14px;">Your Registration Number</p>
                      <p style="color: #10b981; margin: 0; font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 2px;">${registration_number}</p>
                    </div>

                    <!-- Event Details -->
                    <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Event Details</h2>

                    <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Event</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${escapeHtml(event_name || "")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Date</td>
                        <td style="padding: 8px 0; color: #1f2937;">${formattedDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Venue</td>
                        <td style="padding: 8px 0; color: #1f2937;">${escapeHtml(event_venue || "To be announced")}</td>
                      </tr>
                    </table>

                    <!-- Ticket Details -->
                    <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Ticket Details</h2>

                    <table role="presentation" style="width: 100%; margin-bottom: 25px;">
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280; width: 120px;">Ticket Type</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: 600;">${escapeHtml(ticket_name || "")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Quantity</td>
                        <td style="padding: 8px 0; color: #1f2937;">${quantity}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Total Amount</td>
                        <td style="padding: 8px 0; color: #1f2937; font-weight: bold; font-size: 18px;">₹${total_amount.toLocaleString("en-IN")}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #6b7280;">Payment Status</td>
                        <td style="padding: 8px 0;">
                          <span style="background-color: ${paymentStatusColor}20; color: ${paymentStatusColor}; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: 600;">${paymentStatusText}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- What's Next -->
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                      <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 16px;">What's Next?</h3>
                      <ul style="margin: 0; padding: 0 0 0 20px; color: #4b5563;">
                        <li style="margin-bottom: 8px;">Save this email for your reference</li>
                        <li style="margin-bottom: 8px;">Arrive at the venue with your Registration Number</li>
                        <li style="margin-bottom: 8px;">Collect your badge at the registration desk</li>
                        ${payment_status !== "completed" ? `<li style="margin-bottom: 8px; color: #f59e0b;">Complete your payment ${payment_method === "cash" ? "at the venue" : "via bank transfer"}</li>` : ""}
                      </ul>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      If you have any questions, please contact us.
                    </p>
                    <p style="color: #6b7280; margin: 0; font-size: 12px;">
                      © ${new Date().getFullYear()} AMASI. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
    } // End of else block for fallback template

    // Send email via Resend
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>",
          to: attendee_email,
          subject: emailSubject,
          html: emailHtml,
        })

        if (result.error) {
          console.error("Resend API error:", result.error)
          return NextResponse.json({
            success: false,
            error: "Failed to send email",
            details: result.error
          }, { status: 500 })
        }

        console.log(`Registration confirmation sent to ${attendee_email} - ID: ${result.data?.id}`)

        return NextResponse.json({
          success: true,
          message: "Confirmation email sent",
          email_id: result.data?.id
        })
      } catch (emailError) {
        console.error("Resend error:", emailError)
        return NextResponse.json({
          success: false,
          error: "Email service error"
        }, { status: 500 })
      }
    } else {
      console.log(`[DEV] Would send registration confirmation to ${attendee_email}`)
      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true
      })
    }
  } catch (error) {
    console.error("Error in POST /api/email/registration-confirmation:", error)
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500 }
    )
  }
}
