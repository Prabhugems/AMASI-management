import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import QRCode from "qrcode"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createAdminClient()

    // Fetch registration with event and ticket details
    const { data, error } = await supabase
      .from("registrations")
      .select(`
        *,
        ticket_types (name, price, tax_percentage),
        events (
          name,
          short_name,
          start_date,
          end_date,
          venue_name,
          city,
          state,
          contact_email,
          logo_url
        )
      `)
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 })
    }

    // Type assertion for the registration data
    const registration = data as {
      registration_number: string
      attendee_name: string
      attendee_email: string
      attendee_phone: string | null
      institution: string | null
      designation: string | null
      quantity: number
      total_amount: number
      payment_status: string
      payment_method: string | null
      events: {
        name: string
        short_name: string | null
        start_date: string
        end_date: string | null
        venue_name: string | null
        city: string | null
        state: string | null
        contact_email: string | null
        logo_url: string | null
      }
      ticket_types: {
        name: string
        price: number
        tax_percentage: number
      }
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 size
    const { width, height } = page.getSize()

    // Load fonts
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    // Colors
    const primaryColor = rgb(0.133, 0.545, 0.133) // Green
    const textColor = rgb(0.2, 0.2, 0.2)
    const mutedColor = rgb(0.5, 0.5, 0.5)

    let y = height - 50

    // Header - Organization Name
    page.drawText("AMASI", {
      x: 50,
      y,
      size: 24,
      font: fontBold,
      color: primaryColor,
    })

    page.drawText("Association of Minimal Access Surgeons of India", {
      x: 50,
      y: y - 20,
      size: 10,
      font: fontRegular,
      color: mutedColor,
    })

    // Receipt Title
    y -= 60
    page.drawText("REGISTRATION RECEIPT", {
      x: 50,
      y,
      size: 18,
      font: fontBold,
      color: textColor,
    })

    // Registration Number
    y -= 30
    page.drawText(`Registration No: ${registration.registration_number}`, {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: primaryColor,
    })

    // Generate QR Code
    const qrDataUrl = await QRCode.toDataURL(registration.registration_number, {
      width: 100,
      margin: 0,
    })
    const qrImageBytes = Buffer.from(qrDataUrl.split(",")[1], "base64")
    const qrImage = await pdfDoc.embedPng(qrImageBytes)
    page.drawImage(qrImage, {
      x: width - 150,
      y: height - 180,
      width: 100,
      height: 100,
    })

    // Divider
    y -= 20
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    })

    // Event Details Section
    y -= 30
    page.drawText("EVENT DETAILS", {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: textColor,
    })

    y -= 25
    const event = registration.events as any
    page.drawText(event?.name || "Event", {
      x: 50,
      y,
      size: 14,
      font: fontBold,
      color: textColor,
    })

    y -= 20
    const eventDate = event?.start_date
      ? new Date(event.start_date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : ""
    const endDate = event?.end_date && event.end_date !== event.start_date
      ? ` - ${new Date(event.end_date).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`
      : ""
    page.drawText(`Date: ${eventDate}${endDate}`, {
      x: 50,
      y,
      size: 10,
      font: fontRegular,
      color: mutedColor,
    })

    y -= 15
    const venue = [event?.venue_name, event?.city, event?.state].filter(Boolean).join(", ")
    page.drawText(`Venue: ${venue}`, {
      x: 50,
      y,
      size: 10,
      font: fontRegular,
      color: mutedColor,
    })

    // Attendee Details Section
    y -= 40
    page.drawText("ATTENDEE DETAILS", {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: textColor,
    })

    const attendeeDetails = [
      ["Name", registration.attendee_name],
      ["Email", registration.attendee_email],
      ["Phone", registration.attendee_phone || "-"],
      ["Institution", registration.institution || "-"],
      ["Designation", registration.designation || "-"],
    ]

    y -= 20
    for (const [label, value] of attendeeDetails) {
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 10,
        font: fontBold,
        color: mutedColor,
      })
      page.drawText(String(value), {
        x: 150,
        y,
        size: 10,
        font: fontRegular,
        color: textColor,
      })
      y -= 18
    }

    // Payment Details Section
    y -= 20
    page.drawText("PAYMENT DETAILS", {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: textColor,
    })

    const ticket = registration.ticket_types as any
    const ticketPrice = ticket?.price || 0
    const taxPercent = ticket?.tax_percentage || 18
    const taxAmount = (ticketPrice * taxPercent) / 100
    const totalAmount = registration.total_amount || ticketPrice + taxAmount

    const paymentDetails = [
      ["Ticket Type", ticket?.name || "Standard"],
      ["Quantity", String(registration.quantity || 1)],
      ["Base Amount", `₹${ticketPrice.toLocaleString("en-IN")}`],
      ["Tax (GST)", `₹${taxAmount.toLocaleString("en-IN")}`],
      ["Total Amount", `₹${totalAmount.toLocaleString("en-IN")}`],
      ["Payment Status", registration.payment_status || "Pending"],
      ["Payment Method", registration.payment_method || "-"],
    ]

    y -= 20
    for (const [label, value] of paymentDetails) {
      const isBold = label === "Total Amount"
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 10,
        font: isBold ? fontBold : fontBold,
        color: mutedColor,
      })
      page.drawText(String(value), {
        x: 200,
        y,
        size: isBold ? 12 : 10,
        font: isBold ? fontBold : fontRegular,
        color: isBold ? primaryColor : textColor,
      })
      y -= 18
    }

    // Important Notes
    y -= 30
    page.drawLine({
      start: { x: 50, y: y + 10 },
      end: { x: width - 50, y: y + 10 },
      thickness: 1,
      color: rgb(0.9, 0.9, 0.9),
    })

    page.drawText("IMPORTANT INFORMATION", {
      x: 50,
      y,
      size: 12,
      font: fontBold,
      color: textColor,
    })

    const notes = [
      "• Please carry this receipt and a valid photo ID to the venue.",
      "• Show the QR code at the registration desk for quick check-in.",
      "• For any queries, contact the event organizers.",
    ]

    y -= 20
    for (const note of notes) {
      page.drawText(note, {
        x: 50,
        y,
        size: 9,
        font: fontRegular,
        color: mutedColor,
      })
      y -= 15
    }

    // Footer
    page.drawText(`Generated on ${new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`, {
      x: 50,
      y: 50,
      size: 8,
      font: fontRegular,
      color: mutedColor,
    })

    page.drawText("Manage your registration at: amasi.org/my", {
      x: 50,
      y: 35,
      size: 8,
      font: fontRegular,
      color: primaryColor,
    })

    // Serialize the PDF
    const pdfBytes = await pdfDoc.save()

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="AMASI-Receipt-${registration.registration_number}.pdf"`,
      },
    })
  } catch (error: any) {
    console.error("Failed to generate receipt:", error)
    return NextResponse.json(
      { error: "Failed to generate receipt" },
      { status: 500 }
    )
  }
}
