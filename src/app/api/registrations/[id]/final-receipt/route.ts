import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

// GET /api/registrations/[id]/final-receipt - Generate consolidated registration receipt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: "Registration ID required" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Fetch registration with all details
  const { data: registration, error: regError } = await (supabase as any)
    .from("registrations")
    .select(`
      id,
      registration_number,
      attendee_name,
      attendee_email,
      attendee_phone,
      attendee_institution,
      attendee_designation,
      status,
      quantity,
      unit_price,
      tax_amount,
      discount_amount,
      total_amount,
      payment_status,
      payment_id,
      confirmed_at,
      created_at,
      event_id,
      ticket_type_id,
      ticket_types (name, price),
      events (name, short_name, start_date, end_date, venue_name, city)
    `)
    .eq("id", id)
    .single()

  if (regError || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  // Fetch all addons for this registration
  const { data: addons } = await (supabase as any)
    .from("registration_addons")
    .select(`
      id,
      quantity,
      unit_price,
      total_price,
      created_at,
      addon:addons(id, name, price)
    `)
    .eq("registration_id", id)

  // Fetch all payments linked to this registration
  // 1. Direct payment (ticket purchase)
  // 2. Addon payments (where metadata.registration_id matches)
  const payments: any[] = []

  // Get direct payment
  if (registration.payment_id) {
    const { data: directPayment } = await (supabase as any)
      .from("payments")
      .select("*")
      .eq("id", registration.payment_id)
      .single()
    if (directPayment) {
      payments.push({ ...directPayment, type: "ticket" })
    }
  }

  // Get addon payments
  const { data: addonPayments } = await (supabase as any)
    .from("payments")
    .select("*")
    .eq("event_id", registration.event_id)
    .eq("payment_type", "addon_purchase")
    .eq("status", "completed")

  if (addonPayments) {
    for (const payment of addonPayments) {
      if (payment.metadata?.registration_id === id) {
        payments.push({ ...payment, type: "addon" })
      }
    }
  }

  // Sort payments by date
  payments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Calculate totals
  const ticketPrice = registration.unit_price || registration.ticket_types?.price || 0
  const ticketTax = registration.tax_amount || 0
  const ticketDiscount = registration.discount_amount || 0
  const ticketTotal = registration.total_amount || (ticketPrice + ticketTax - ticketDiscount)

  let addonsSubtotal = 0
  let addonsTax = 0
  const addonsList = (addons || []).map((a: any) => {
    const qty = a.quantity || 1
    const addonPrice = a.addon?.price || 0
    const unitPrice = a.unit_price || addonPrice
    const totalPrice = a.total_price || (unitPrice * qty)
    addonsSubtotal += totalPrice
    return {
      name: a.addon?.name || "Add-on",
      quantity: qty,
      unit_price: unitPrice,
      total_price: totalPrice,
    }
  })

  // Calculate addon tax (18% GST assumed)
  addonsTax = Math.round(addonsSubtotal * 0.18)
  const addonsTotal = addonsSubtotal + addonsTax

  const grandTotal = ticketTotal + addonsTotal
  const totalPayments = payments.reduce((sum, p) => sum + (p.net_amount || p.amount || 0), 0)

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const event = registration.events
  const ticketType = registration.ticket_types

  // Colors
  const primaryColor = rgb(0.1, 0.3, 0.5)
  const grayColor = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const successColor = rgb(0.1, 0.6, 0.3)

  let y = height - 50

  // Header
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: primaryColor,
  })

  page.drawText("REGISTRATION RECEIPT", {
    x: 50,
    y: height - 55,
    size: 22,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  page.drawText("Final Consolidated Receipt", {
    x: 50,
    y: height - 75,
    size: 10,
    font: helvetica,
    color: rgb(0.8, 0.8, 0.8),
  })

  page.drawText(event?.short_name || event?.name || "Event", {
    x: 50,
    y: height - 90,
    size: 11,
    font: helvetica,
    color: rgb(0.8, 0.8, 0.8),
  })

  // Registration Number (right side)
  page.drawText(`Reg #: ${registration.registration_number}`, {
    x: width - 180,
    y: height - 55,
    size: 12,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  const receiptDate = registration.confirmed_at || registration.created_at
  page.drawText(`Date: ${new Date(receiptDate).toLocaleDateString("en-IN")}`, {
    x: width - 180,
    y: height - 72,
    size: 10,
    font: helvetica,
    color: rgb(1, 1, 1),
  })

  y = height - 130

  // Attendee Info
  page.drawText("BILL TO", {
    x: 50,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  })
  y -= 18

  page.drawText(registration.attendee_name, {
    x: 50,
    y,
    size: 13,
    font: helveticaBold,
    color: primaryColor,
  })
  y -= 15

  if (registration.attendee_email) {
    page.drawText(registration.attendee_email, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  if (registration.attendee_phone) {
    page.drawText(registration.attendee_phone, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  if (registration.attendee_institution) {
    page.drawText(registration.attendee_institution, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  // Event Info (right side)
  const eventY = height - 130
  page.drawText("EVENT", {
    x: 350,
    y: eventY,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  })

  page.drawText(event?.name || "Event", {
    x: 350,
    y: eventY - 18,
    size: 11,
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
      y: eventY - 35,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
  }

  if (event?.venue_name) {
    page.drawText(event.venue_name, {
      x: 350,
      y: eventY - 50,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
  }

  y -= 30

  // Table Header
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: width - 100,
    height: 22,
    color: lightGray,
  })

  page.drawText("DESCRIPTION", { x: 60, y: y, size: 9, font: helveticaBold, color: primaryColor })
  page.drawText("QTY", { x: 350, y: y, size: 9, font: helveticaBold, color: primaryColor })
  page.drawText("RATE", { x: 400, y: y, size: 9, font: helveticaBold, color: primaryColor })
  page.drawText("AMOUNT", { x: 480, y: y, size: 9, font: helveticaBold, color: primaryColor })

  y -= 25

  // Ticket Row
  const ticketName = ticketType?.name || "Registration"
  page.drawText(ticketName.substring(0, 45), { x: 60, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(String(registration.quantity || 1), { x: 355, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${ticketPrice.toLocaleString("en-IN")}`, { x: 400, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${ticketPrice.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })

  y -= 18

  // Addon Rows
  for (const addon of addonsList) {
    page.drawText(addon.name.substring(0, 45), { x: 60, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(String(addon.quantity), { x: 355, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${addon.unit_price.toLocaleString("en-IN")}`, { x: 400, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${addon.total_price.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
    y -= 18
  }

  y -= 10

  // Separator
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    thickness: 1,
    color: lightGray,
  })

  y -= 20

  // Subtotals
  page.drawText("Subtotal", { x: 400, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${(ticketPrice + addonsSubtotal).toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
  y -= 15

  const totalTax = ticketTax + addonsTax
  if (totalTax > 0) {
    page.drawText("Tax (GST)", { x: 400, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${totalTax.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
    y -= 15
  }

  if (ticketDiscount > 0) {
    page.drawText("Discount", { x: 400, y, size: 10, font: helvetica, color: successColor })
    page.drawText(`-Rs.${ticketDiscount.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: successColor })
    y -= 15
  }

  y -= 5

  // Grand Total
  page.drawRectangle({
    x: 380,
    y: y - 8,
    width: 165,
    height: 25,
    color: primaryColor,
  })

  page.drawText("TOTAL", { x: 390, y: y, size: 11, font: helveticaBold, color: rgb(1, 1, 1) })
  page.drawText(`Rs.${grandTotal.toLocaleString("en-IN")}`, { x: 480, y: y, size: 11, font: helveticaBold, color: rgb(1, 1, 1) })

  y -= 45

  // Payment History Section
  page.drawText("PAYMENT HISTORY", {
    x: 50,
    y,
    size: 10,
    font: helveticaBold,
    color: primaryColor,
  })

  y -= 18

  if (payments.length > 0) {
    for (const payment of payments) {
      const paymentDate = new Date(payment.completed_at || payment.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      const paymentType = payment.type === "addon" ? "Add-on Purchase" : "Registration"
      const paymentMethod = payment.payment_method === "razorpay" ? "Razorpay" : (payment.payment_method || "Offline")

      page.drawText(`${payment.payment_number}`, { x: 60, y, size: 9, font: helvetica, color: grayColor })
      page.drawText(paymentType, { x: 180, y, size: 9, font: helvetica, color: grayColor })
      page.drawText(paymentMethod, { x: 300, y, size: 9, font: helvetica, color: grayColor })
      page.drawText(paymentDate, { x: 380, y, size: 9, font: helvetica, color: grayColor })
      page.drawText(`Rs.${(payment.net_amount || payment.amount || 0).toLocaleString("en-IN")}`, { x: 480, y, size: 9, font: helveticaBold, color: grayColor })

      y -= 15
    }

    y -= 10

    // Total Payments
    page.drawText("Total Paid:", { x: 400, y, size: 10, font: helveticaBold, color: primaryColor })
    page.drawText(`Rs.${totalPayments.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helveticaBold, color: primaryColor })
  } else {
    page.drawText("Payment collected offline / Admin uploaded", { x: 60, y, size: 9, font: helvetica, color: grayColor })
  }

  y -= 30

  // Status Badge
  const statusColor = registration.payment_status === "completed" ? successColor : rgb(0.8, 0.5, 0.1)
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 80,
    height: 22,
    color: statusColor,
  })
  page.drawText(registration.payment_status === "completed" ? "PAID" : "PENDING", {
    x: 70,
    y: y,
    size: 10,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  // Footer
  page.drawText("This is a computer-generated receipt and does not require a signature.", {
    x: 50,
    y: 50,
    size: 8,
    font: helvetica,
    color: grayColor,
  })

  page.drawText(`Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`, {
    x: 50,
    y: 35,
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
