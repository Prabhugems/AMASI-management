import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { createAdminClient } from "@/lib/supabase/server"
import { logEmail } from "@/lib/email-tracking"
import { generateTravelItineraryICS } from "@/lib/ics-generator"

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

interface TravelItineraryData {
  registration_id: string
  event_id?: string
  speaker_name: string
  speaker_email: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_venue?: string
  booking: {
    // Onward Flight
    onward_status?: string
    onward_pnr?: string
    onward_airline?: string
    onward_flight_number?: string
    onward_from_city?: string
    onward_to_city?: string
    onward_departure_date?: string
    onward_departure_time?: string
    onward_arrival_date?: string
    onward_arrival_time?: string
    onward_seat?: string
    onward_eticket?: string
    // Return Flight
    return_status?: string
    return_pnr?: string
    return_airline?: string
    return_flight_number?: string
    return_from_city?: string
    return_to_city?: string
    return_departure_date?: string
    return_departure_time?: string
    return_arrival_date?: string
    return_arrival_time?: string
    return_seat?: string
    return_eticket?: string
    // Hotel
    hotel_status?: string
    hotel_name?: string
    hotel_address?: string
    hotel_phone?: string
    hotel_confirmation?: string
    hotel_checkin?: string
    hotel_checkout?: string
    hotel_room_type?: string
    // Ground Transport
    pickup_required?: boolean
    pickup_details?: string
    drop_required?: boolean
    drop_details?: string
  }
}

// Format time to 12-hour format
function formatTime(time: string) {
  if (!time) return ""
  const [hours, minutes] = time.split(":")
  const h = parseInt(hours)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

// Format date
function formatDate(dateStr: string) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// POST /api/email/travel-itinerary - Send travel itinerary email
export async function POST(request: NextRequest) {
  try {
    const body: TravelItineraryData = await request.json()

    const {
      registration_id,
      event_id,
      speaker_name,
      speaker_email,
      event_name,
      event_start_date,
      event_end_date,
      event_venue,
      booking,
    } = body

    const emailSubject = `Travel Itinerary - ${event_name}`
    const fromEmail = process.env.RESEND_FROM_EMAIL || "AMASI Events <noreply@resend.dev>"

    if (!speaker_email || !event_name) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Format event dates
    const startDate = formatDate(event_start_date)
    const endDate = formatDate(event_end_date)
    const eventDateRange = event_start_date === event_end_date
      ? startDate
      : `${startDate} - ${endDate}`

    // Build Onward Flight HTML
    const hasOnwardFlight = booking.onward_flight_number || booking.onward_airline || booking.onward_from_city
    const onwardFlightHtml = hasOnwardFlight ? `
      <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center;">
          ✈️ Onward Journey
        </h2>
        <div style="background: white; border-radius: 8px; padding: 20px;">
          <table role="presentation" style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px;">Airline</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${booking.onward_airline || ""} ${booking.onward_flight_number || ""}</td>
            </tr>
            ${booking.onward_pnr ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">PNR</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 700; font-size: 16px; font-family: monospace; letter-spacing: 1px;">${booking.onward_pnr}</td>
            </tr>
            ` : ""}
            ${booking.onward_eticket ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">E-Ticket</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 13px;">📎 Attached</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><strong>${booking.onward_from_city || "-"}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Departure</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.onward_departure_date || "")} ${booking.onward_departure_time ? `at <strong>${formatTime(booking.onward_departure_time)}</strong>` : ""}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">To</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><strong>${booking.onward_to_city || "-"}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Arrival</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.onward_arrival_date || "")} ${booking.onward_arrival_time ? `at <strong>${formatTime(booking.onward_arrival_time)}</strong>` : ""}</td>
            </tr>
            ${booking.onward_seat ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Seat</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${booking.onward_seat}</td>
            </tr>
            ` : ""}
          </table>
        </div>
      </div>
    ` : ""

    // Build Return Flight HTML
    const hasReturnFlight = booking.return_flight_number || booking.return_airline || booking.return_from_city
    const returnFlightHtml = hasReturnFlight && booking.return_status !== "not_required" ? `
      <div style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0 0 15px 0; font-size: 18px;">
          ✈️ Return Journey
        </h2>
        <div style="background: white; border-radius: 8px; padding: 20px;">
          <table role="presentation" style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px;">Airline</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${booking.return_airline || ""} ${booking.return_flight_number || ""}</td>
            </tr>
            ${booking.return_pnr ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">PNR</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 700; font-size: 16px; font-family: monospace; letter-spacing: 1px;">${booking.return_pnr}</td>
            </tr>
            ` : ""}
            ${booking.return_eticket ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">E-Ticket</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 13px;">📎 Attached</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">From</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><strong>${booking.return_from_city || "-"}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Departure</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.return_departure_date || "")} ${booking.return_departure_time ? `at <strong>${formatTime(booking.return_departure_time)}</strong>` : ""}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">To</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><strong>${booking.return_to_city || "-"}</strong></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Arrival</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.return_arrival_date || "")} ${booking.return_arrival_time ? `at <strong>${formatTime(booking.return_arrival_time)}</strong>` : ""}</td>
            </tr>
            ${booking.return_seat ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Seat</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${booking.return_seat}</td>
            </tr>
            ` : ""}
          </table>
        </div>
      </div>
    ` : ""

    // Build Hotel HTML
    const hasHotel = booking.hotel_name
    const hotelHtml = hasHotel ? `
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0 0 15px 0; font-size: 18px;">
          🏨 Hotel Accommodation
        </h2>
        <div style="background: white; border-radius: 8px; padding: 20px;">
          <table role="presentation" style="width: 100%;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 130px; font-size: 14px;">Hotel</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 600; font-size: 14px;">${booking.hotel_name}</td>
            </tr>
            ${booking.hotel_address ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Address</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${booking.hotel_address}</td>
            </tr>
            ` : ""}
            ${booking.hotel_phone ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${booking.hotel_phone}</td>
            </tr>
            ` : ""}
            ${booking.hotel_confirmation ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Confirmation</td>
              <td style="padding: 8px 0; color: #1f2937; font-weight: 700; font-size: 16px; font-family: monospace; letter-spacing: 1px;">${booking.hotel_confirmation}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-in</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.hotel_checkin || "")}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Check-out</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${formatDate(booking.hotel_checkout || "")}</td>
            </tr>
            ${booking.hotel_room_type ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Room Type</td>
              <td style="padding: 8px 0; color: #1f2937; font-size: 14px; text-transform: capitalize;">${booking.hotel_room_type}</td>
            </tr>
            ` : ""}
          </table>
        </div>
      </div>
    ` : ""

    // Build Ground Transport HTML
    const hasTransport = booking.pickup_required || booking.drop_required
    const transportHtml = hasTransport ? `
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: white; margin: 0 0 15px 0; font-size: 18px;">
          🚗 Ground Transportation
        </h2>
        <div style="background: white; border-radius: 8px; padding: 20px;">
          ${booking.pickup_required ? `
          <div style="margin-bottom: ${booking.drop_required ? '15px' : '0'}; ${booking.drop_required ? 'padding-bottom: 15px; border-bottom: 1px solid #e5e7eb;' : ''}">
            <h3 style="color: #059669; margin: 0 0 8px 0; font-size: 14px;">Airport Pickup</h3>
            <p style="color: #1f2937; margin: 0; font-size: 14px;">${booking.pickup_details || "Arranged - Details will be shared closer to your arrival"}</p>
          </div>
          ` : ""}
          ${booking.drop_required ? `
          <div>
            <h3 style="color: #059669; margin: 0 0 8px 0; font-size: 14px;">Airport Drop</h3>
            <p style="color: #1f2937; margin: 0; font-size: 14px;">${booking.drop_details || "Arranged - Details will be shared closer to your departure"}</p>
          </div>
          ` : ""}
        </div>
      </div>
    ` : ""

    const emailHtml = `
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
                  <td style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Your Travel Itinerary</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 12px 0 0 0; font-size: 16px;">${event_name}</p>
                  </td>
                </tr>

                <!-- Main Content -->
                <tr>
                  <td style="background-color: white; padding: 30px;">

                    <!-- Greeting -->
                    <p style="color: #1f2937; font-size: 16px; margin: 0 0 10px 0; line-height: 1.6;">
                      Dear <strong>${speaker_name}</strong>,
                    </p>
                    <p style="color: #4b5563; font-size: 15px; margin: 0 0 25px 0; line-height: 1.6;">
                      Please find your complete travel itinerary for <strong>${event_name}</strong> (${eventDateRange})${event_venue ? ` at ${event_venue}` : ""}.
                    </p>

                    <!-- Travel Details -->
                    ${onwardFlightHtml}
                    ${returnFlightHtml}
                    ${hotelHtml}
                    ${transportHtml}

                    ${!hasOnwardFlight && !hasHotel ? `
                    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="color: #92400e; margin: 0; font-size: 14px;">
                        Your travel details are being finalized. We'll send you an updated itinerary soon.
                      </p>
                    </div>
                    ` : ""}

                    <!-- Important Notes -->
                    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 12px; padding: 20px; margin: 25px 0;">
                      <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 15px;">Important Reminders</h3>
                      <ul style="margin: 0; padding: 0 0 0 20px; color: #78350f; font-size: 14px; line-height: 1.8;">
                        <li>Please carry a valid photo ID for flight check-in</li>
                        <li>Arrive at the airport at least 2 hours before departure</li>
                        <li>Save this email or screenshot the PNR for reference</li>
                        ${hasHotel ? "<li>Hotel check-in time is usually 2:00 PM, check-out is 12:00 PM</li>" : ""}
                      </ul>
                    </div>

                    <!-- Contact -->
                    <p style="color: #6b7280; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
                      If you have any questions about your travel arrangements, please don't hesitate to contact us.
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #1f2937; padding: 25px 30px; border-radius: 0 0 16px 16px; text-align: center;">
                    <p style="color: #9ca3af; margin: 0 0 10px 0; font-size: 14px;">
                      Safe travels! We look forward to seeing you at ${event_name}.
                    </p>
                    <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 12px;">
                      This itinerary was sent to ${speaker_email}
                    </p>
                    <p style="color: #6b7280; margin: 0; font-size: 12px;">
                      &copy; ${new Date().getFullYear()} AMASI. All rights reserved.
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

    // Prepare attachments from e-tickets
    const attachments: { filename: string; content: Buffer }[] = []

    // Generate and attach ICS calendar file
    const hasAnyBooking = hasOnwardFlight || hasReturnFlight || hasHotel
    if (hasAnyBooking) {
      try {
        const icsContent = generateTravelItineraryICS({
          speakerName: speaker_name,
          eventName: event_name,
          onwardFlight: hasOnwardFlight ? {
            airline: booking.onward_airline || "",
            flightNumber: booking.onward_flight_number || "",
            fromCity: booking.onward_from_city || "",
            toCity: booking.onward_to_city || "",
            departureDate: booking.onward_departure_date || "",
            departureTime: booking.onward_departure_time || "",
            arrivalDate: booking.onward_arrival_date,
            arrivalTime: booking.onward_arrival_time,
            pnr: booking.onward_pnr,
          } : undefined,
          returnFlight: hasReturnFlight && booking.return_status !== "not_required" ? {
            airline: booking.return_airline || "",
            flightNumber: booking.return_flight_number || "",
            fromCity: booking.return_from_city || "",
            toCity: booking.return_to_city || "",
            departureDate: booking.return_departure_date || "",
            departureTime: booking.return_departure_time || "",
            arrivalDate: booking.return_arrival_date,
            arrivalTime: booking.return_arrival_time,
            pnr: booking.return_pnr,
          } : undefined,
          hotel: hasHotel ? {
            hotelName: booking.hotel_name || "",
            address: booking.hotel_address,
            checkIn: booking.hotel_checkin || "",
            checkOut: booking.hotel_checkout || "",
            confirmationNumber: booking.hotel_confirmation,
          } : undefined,
        })

        attachments.push({
          filename: `Travel_Calendar_${event_name.replace(/[^a-zA-Z0-9]/g, "_")}.ics`,
          content: Buffer.from(icsContent, "utf-8"),
        })
      } catch (err) {
        console.error("Failed to generate ICS calendar:", err)
      }
    }

    // Fetch and attach onward e-ticket
    if (booking.onward_eticket) {
      try {
        const response = await fetch(booking.onward_eticket)
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          const url = new URL(booking.onward_eticket)
          const ext = url.pathname.split('.').pop() || 'pdf'
          attachments.push({
            filename: `Onward_Ticket_${booking.onward_pnr || 'ticket'}.${ext}`,
            content: buffer,
          })
        }
      } catch (err) {
        console.error("Failed to fetch onward e-ticket:", err)
      }
    }

    // Fetch and attach return e-ticket
    if (booking.return_eticket) {
      try {
        const response = await fetch(booking.return_eticket)
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer())
          const url = new URL(booking.return_eticket)
          const ext = url.pathname.split('.').pop() || 'pdf'
          attachments.push({
            filename: `Return_Ticket_${booking.return_pnr || 'ticket'}.${ext}`,
            content: buffer,
          })
        }
      } catch (err) {
        console.error("Failed to fetch return e-ticket:", err)
      }
    }

    // Send email via Resend
    if (resend) {
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: speaker_email,
          subject: emailSubject,
          html: emailHtml,
          attachments: attachments.length > 0 ? attachments : undefined,
        })

        if (result.error) {
          console.error("Resend API error:", result.error)
          return NextResponse.json({
            success: false,
            error: "Failed to send email",
            details: result.error
          }, { status: 500 })
        }

        console.log(`Travel itinerary sent to ${speaker_email} - ID: ${result.data?.id}`)

        // Log email for tracking
        if (result.data?.id) {
          await logEmail({
            resendEmailId: result.data.id,
            emailType: "travel_itinerary",
            fromEmail,
            toEmail: speaker_email,
            subject: emailSubject,
            eventId: event_id,
            registrationId: registration_id,
            metadata: {
              speaker_name,
              has_onward_flight: !!booking.onward_flight_number,
              has_return_flight: !!booking.return_flight_number,
              has_hotel: !!booking.hotel_name,
              has_calendar: hasAnyBooking,
              attachments_count: attachments.length,
            },
          })
        }

        // Update registration to mark voucher as sent
        if (registration_id) {
          const supabase = await createAdminClient()
          const { data: current } = await (supabase as any)
            .from("registrations")
            .select("custom_fields")
            .eq("id", registration_id)
            .single()

          await (supabase as any)
            .from("registrations")
            .update({
              custom_fields: {
                ...(current?.custom_fields || {}),
                booking: {
                  ...(current?.custom_fields?.booking || {}),
                  voucher_sent: true,
                  voucher_sent_date: new Date().toISOString(),
                  voucher_email_id: result.data?.id,
                },
              }
            })
            .eq("id", registration_id)
        }

        return NextResponse.json({
          success: true,
          message: "Travel itinerary sent",
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
      console.log(`[DEV] Would send travel itinerary to ${speaker_email}`)
      return NextResponse.json({
        success: true,
        message: "Email skipped (no API key configured)",
        dev_mode: true
      })
    }
  } catch (error) {
    console.error("Error in POST /api/email/travel-itinerary:", error)
    return NextResponse.json(
      { error: "Failed to send travel itinerary" },
      { status: 500 }
    )
  }
}
