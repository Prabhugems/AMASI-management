import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

// GET /api/receipt/[token] - Generate and download receipt PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 3) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Look up registration by registration_number or checkin_token
  const isSecureToken = token.length >= 20

  let query = (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_designation,
      attendee_institution,
      status,
      quantity,
      total_amount,
      payment_status,
      confirmed_at,
      created_at,
      event_id,
      ticket_type_id,
      ticket_types (name, price),
      events (name, short_name, start_date, end_date, venue_name, city),
      payments (payment_number, razorpay_payment_id, completed_at, amount)
    `)

  if (isSecureToken) {
    query = query.eq("checkin_token", token)
  } else {
    query = query.ilike("registration_number", token)
  }

  const { data: registration, error } = await query.single()

  if (error || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  // Fetch addons for this registration
  const { data: rawAddons } = await (supabase as any)
    .from("registration_addons")
    .select(`
      id,
      quantity,
      price,
      addon:addons(id, name, price)
    `)
    .eq("registration_id", registration.id)

  // Map to expected format with unit_price/total_price
  const registrationAddons = rawAddons?.map((a: any) => {
    const qty = a.quantity || 1
    const totalPrice = a.price || 0
    return {
      ...a,
      unit_price: qty > 0 ? totalPrice / qty : (a.addon?.price || 0),
      total_price: totalPrice,
    }
  })

  // Generate Receipt PDF
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const event = registration.events
  const ticketType = registration.ticket_types
  const payment = registration.payments?.[0]

  // Colors
  const primaryColor = rgb(0.1, 0.3, 0.5)
  const grayColor = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)

  let y = height - 50

  // Header
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: primaryColor,
  })

  page.drawText("PAYMENT RECEIPT", {
    x: 50,
    y: height - 60,
    size: 24,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  page.drawText(event?.short_name || event?.name || "Event", {
    x: 50,
    y: height - 85,
    size: 12,
    font: helvetica,
    color: rgb(0.8, 0.8, 0.8),
  })

  // Receipt Number
  page.drawText(`Receipt #: ${payment?.payment_number || registration.registration_number}`, {
    x: width - 200,
    y: height - 60,
    size: 10,
    font: helvetica,
    color: rgb(1, 1, 1),
  })

  const receiptDate = payment?.completed_at || registration.confirmed_at || registration.created_at
  page.drawText(`Date: ${new Date(receiptDate).toLocaleDateString("en-IN")}`, {
    x: width - 200,
    y: height - 75,
    size: 10,
    font: helvetica,
    color: rgb(1, 1, 1),
  })

  y = height - 140

  // Attendee Info Section
  page.drawText("BILL TO", {
    x: 50,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  })
  y -= 20

  page.drawText(registration.attendee_name, {
    x: 50,
    y,
    size: 14,
    font: helveticaBold,
    color: primaryColor,
  })
  y -= 18

  if (registration.attendee_email) {
    page.drawText(registration.attendee_email, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 15
  }

  if (registration.attendee_phone) {
    page.drawText(registration.attendee_phone, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 15
  }

  if (registration.attendee_institution) {
    page.drawText(registration.attendee_institution, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 15
  }

  // Event Info (right side)
  const eventY = height - 140
  page.drawText("EVENT DETAILS", {
    x: 350,
    y: eventY,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  })

  page.drawText(event?.name || "Event", {
    x: 350,
    y: eventY - 20,
    size: 12,
    font: helveticaBold,
    color: primaryColor,
  })

  if (event?.start_date) {
    const startDate = new Date(event.start_date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    page.drawText(startDate, {
      x: 350,
      y: eventY - 38,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
  }

  if (event?.venue_name) {
    page.drawText(event.venue_name, {
      x: 350,
      y: eventY - 53,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
  }

  y -= 40

  // Table Header
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: width - 100,
    height: 25,
    color: lightGray,
  })

  page.drawText("DESCRIPTION", { x: 60, y: y, size: 10, font: helveticaBold, color: primaryColor })
  page.drawText("QTY", { x: 350, y: y, size: 10, font: helveticaBold, color: primaryColor })
  page.drawText("RATE", { x: 400, y: y, size: 10, font: helveticaBold, color: primaryColor })
  page.drawText("AMOUNT", { x: 480, y: y, size: 10, font: helveticaBold, color: primaryColor })

  y -= 30

  // Table Row - Main Ticket
  const ticketName = ticketType?.name || "Registration"
  const qty = registration.quantity || 1
  const ticketRate = ticketType?.price || 0
  const ticketAmount = ticketRate * qty

  page.drawText(ticketName, { x: 60, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(String(qty), { x: 355, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${ticketRate.toLocaleString("en-IN")}`, { x: 400, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${ticketAmount.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })

  y -= 20

  // Addon Rows
  let addonsTotal = 0
  if (registrationAddons && registrationAddons.length > 0) {
    for (const regAddon of registrationAddons) {
      const addonName = regAddon.addon_variant
        ? `${regAddon.addon?.name} (${regAddon.addon_variant.name})`
        : regAddon.addon?.name || "Add-on"
      const addonQty = regAddon.quantity || 1
      const addonRate = regAddon.unit_price || 0
      const addonAmount = regAddon.total_price || (addonRate * addonQty)
      addonsTotal += addonAmount

      page.drawText(addonName, { x: 60, y, size: 10, font: helvetica, color: grayColor })
      page.drawText(String(addonQty), { x: 355, y, size: 10, font: helvetica, color: grayColor })
      page.drawText(`Rs.${addonRate.toLocaleString("en-IN")}`, { x: 400, y, size: 10, font: helvetica, color: grayColor })
      page.drawText(`Rs.${addonAmount.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })

      y -= 20
    }
  }

  y -= 10

  // Separator
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: lightGray,
  })

  y -= 25

  // Total (use registration.total_amount which includes ticket + addons)
  const grandTotal = registration.total_amount || (ticketAmount + addonsTotal)
  page.drawText("TOTAL", { x: 400, y, size: 12, font: helveticaBold, color: primaryColor })
  page.drawText(`Rs.${grandTotal.toLocaleString("en-IN")}`, { x: 480, y, size: 12, font: helveticaBold, color: primaryColor })

  y -= 40

  // Payment Status
  const statusColor = registration.payment_status === "completed" ? rgb(0.1, 0.6, 0.3) : rgb(0.8, 0.5, 0.1)
  page.drawRectangle({
    x: 400,
    y: y - 5,
    width: 120,
    height: 25,
    color: statusColor,
  })
  page.drawText(registration.payment_status === "completed" ? "PAID" : "PENDING", {
    x: 440,
    y: y,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  // Registration Number
  y -= 60
  page.drawText(`Registration Number: ${registration.registration_number}`, {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: grayColor,
  })

  if (payment?.razorpay_payment_id) {
    y -= 15
    page.drawText(`Payment ID: ${payment.razorpay_payment_id}`, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
  }

  // Footer
  page.drawText("This is a computer-generated receipt and does not require a signature.", {
    x: 50,
    y: 50,
    size: 8,
    font: helvetica,
    color: grayColor,
  })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${registration.registration_number}.pdf"`,
    },
  })
}
