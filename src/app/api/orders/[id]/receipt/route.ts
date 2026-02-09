import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

// GET /api/orders/[id]/receipt - Generate receipt PDF for a specific order/payment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Fetch the payment/order with related data
  const { data: payment, error: paymentError } = await (supabase as any)
    .from("payments")
    .select(`
      id,
      payment_number,
      payer_name,
      payer_email,
      payer_phone,
      amount,
      tax_amount,
      discount_amount,
      net_amount,
      payment_method,
      payment_type,
      status,
      razorpay_order_id,
      razorpay_payment_id,
      completed_at,
      created_at,
      event_id,
      metadata,
      events (name, short_name, start_date, end_date, venue_name, city, logo_url)
    `)
    .eq("id", id)
    .single()

  if (paymentError || !payment) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const event = payment.events
  const metadata = payment.metadata || {}
  const isAddonPurchase = payment.payment_type === "addon_purchase"

  // Variables for receipt items
  let items: { name: string; quantity: number; unit_price: number; total_price: number }[] = []
  let linkedRegistration: any = null

  if (isAddonPurchase) {
    // For addon purchases, get the linked registration and show addon details
    if (metadata.registration_id) {
      const { data: reg } = await (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_institution,
          ticket_types (name)
        `)
        .eq("id", metadata.registration_id)
        .single()

      linkedRegistration = reg
    }

    // Get addons from metadata
    const addonsSelection = metadata.addons_selection || []
    if (addonsSelection.length > 0) {
      // Fetch addon names from database
      const addonIds = addonsSelection.map((a: any) => a.addonId || a.addon_id)
      const { data: addons } = await (supabase as any)
        .from("addons")
        .select("id, name, price")
        .in("id", addonIds)

      const addonMap: Record<string, any> = {}
      if (addons) {
        addons.forEach((a: any) => {
          addonMap[a.id] = a
        })
      }

      items = addonsSelection.map((a: any) => {
        const addonId = a.addonId || a.addon_id
        const addonInfo = addonMap[addonId]
        const qty = a.quantity || 1
        const unitPrice = a.unitPrice || addonInfo?.price || 0
        const totalPrice = a.totalPrice || (unitPrice * qty)
        return {
          name: addonInfo?.name || "Add-on",
          quantity: qty,
          unit_price: unitPrice,
          total_price: totalPrice,
        }
      })
    }
  } else {
    // For registration orders, get the registrations with ticket info
    const { data: registrations } = await (supabase as any)
      .from("registrations")
      .select(`
        id,
        registration_number,
        attendee_name,
        attendee_email,
        attendee_phone,
        attendee_institution,
        quantity,
        unit_price,
        total_amount,
        ticket_types (name, price)
      `)
      .eq("payment_id", id)

    if (registrations && registrations.length > 0) {
      linkedRegistration = registrations[0]

      // Add ticket as item
      for (const reg of registrations) {
        const ticketName = reg.ticket_types?.name || "Registration"
        const qty = reg.quantity || 1
        const unitPrice = reg.unit_price || reg.ticket_types?.price || 0
        items.push({
          name: ticketName,
          quantity: qty,
          unit_price: unitPrice,
          total_price: reg.total_amount || (unitPrice * qty),
        })
      }

      // Also get any addons that were purchased with this registration
      const addonAddonsSelection = metadata.addons_selection || []
      if (addonAddonsSelection.length > 0) {
        const addonIds = addonAddonsSelection.map((a: any) => a.addonId || a.addon_id)
        const { data: addons } = await (supabase as any)
          .from("addons")
          .select("id, name, price")
          .in("id", addonIds)

        const addonMap: Record<string, any> = {}
        if (addons) {
          addons.forEach((a: any) => {
            addonMap[a.id] = a
          })
        }

        for (const a of addonAddonsSelection) {
          const addonId = a.addonId || a.addon_id
          const addonInfo = addonMap[addonId]
          const qty = a.quantity || 1
          const unitPrice = a.unitPrice || addonInfo?.price || 0
          items.push({
            name: addonInfo?.name || "Add-on",
            quantity: qty,
            unit_price: unitPrice,
            total_price: a.totalPrice || (unitPrice * qty),
          })
        }
      }
    }
  }

  // Generate PDF
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const { width, height } = page.getSize()

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Colors
  const primaryColor = rgb(0.1, 0.3, 0.5)
  const grayColor = rgb(0.4, 0.4, 0.4)
  const lightGray = rgb(0.9, 0.9, 0.9)
  const successColor = rgb(0.1, 0.6, 0.3)
  const infoColor = rgb(0.1, 0.5, 0.7)

  let y = height - 50

  // Header
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: isAddonPurchase ? infoColor : primaryColor,
  })

  // Embed event logo in header
  let headerTextX = 50
  if (event?.logo_url) {
    try {
      const logoResponse = await fetch(event.logo_url)
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer()
        const uint8 = new Uint8Array(logoBytes)
        const isPNG = uint8[0] === 0x89 && uint8[1] === 0x50
        const isJPG = uint8[0] === 0xFF && uint8[1] === 0xD8
        let logoImage
        if (isPNG) logoImage = await pdfDoc.embedPng(logoBytes)
        else if (isJPG) logoImage = await pdfDoc.embedJpg(logoBytes)
        if (logoImage) {
          const logoSize = 50
          page.drawImage(logoImage, {
            x: width - 50 - logoSize,
            y: height - 85,
            width: logoSize,
            height: logoSize,
          })
        }
      }
    } catch (e) {
      console.error("Failed to embed logo in order receipt:", e)
    }
  }

  const receiptTitle = isAddonPurchase ? "ADD-ON PURCHASE RECEIPT" : "PAYMENT RECEIPT"
  page.drawText(receiptTitle, {
    x: headerTextX,
    y: height - 55,
    size: 20,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  page.drawText(event?.short_name || event?.name || "Event", {
    x: headerTextX,
    y: height - 78,
    size: 11,
    font: helvetica,
    color: rgb(0.9, 0.9, 0.9),
  })

  if (isAddonPurchase) {
    page.drawText("Additional Purchase", {
      x: 50,
      y: height - 92,
      size: 9,
      font: helvetica,
      color: rgb(0.8, 0.8, 0.8),
    })
  }

  // Receipt Number (right side)
  page.drawText(`Order #: ${payment.payment_number}`, {
    x: width - 180,
    y: height - 55,
    size: 11,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  })

  const receiptDate = payment.completed_at || payment.created_at
  page.drawText(`Date: ${new Date(receiptDate).toLocaleDateString("en-IN")}`, {
    x: width - 180,
    y: height - 72,
    size: 10,
    font: helvetica,
    color: rgb(1, 1, 1),
  })

  y = height - 130

  // Bill To Section
  page.drawText("BILL TO", {
    x: 50,
    y,
    size: 10,
    font: helveticaBold,
    color: grayColor,
  })
  y -= 18

  const payerName = linkedRegistration?.attendee_name || payment.payer_name || "Customer"
  const payerEmail = linkedRegistration?.attendee_email || payment.payer_email
  const payerPhone = linkedRegistration?.attendee_phone || payment.payer_phone
  const payerInstitution = linkedRegistration?.attendee_institution

  page.drawText(payerName, {
    x: 50,
    y,
    size: 13,
    font: helveticaBold,
    color: primaryColor,
  })
  y -= 15

  if (payerEmail) {
    page.drawText(payerEmail, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  if (payerPhone) {
    page.drawText(payerPhone, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  if (payerInstitution) {
    page.drawText(payerInstitution, {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    })
    y -= 13
  }

  // Linked Registration info (for addon purchases)
  if (isAddonPurchase && linkedRegistration) {
    y -= 10
    page.drawText(`Linked Registration: ${linkedRegistration.registration_number}`, {
      x: 50,
      y,
      size: 9,
      font: helvetica,
      color: infoColor,
    })
    y -= 13
    if (linkedRegistration.ticket_types?.name) {
      page.drawText(`Ticket: ${linkedRegistration.ticket_types.name}`, {
        x: 50,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      })
    }
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

  // Item Rows
  let subtotal = 0
  for (const item of items) {
    const displayName = item.name.length > 45 ? item.name.substring(0, 42) + "..." : item.name
    page.drawText(displayName, { x: 60, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(String(item.quantity), { x: 355, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${item.unit_price.toLocaleString("en-IN")}`, { x: 400, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${item.total_price.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
    subtotal += item.total_price
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

  // Subtotal
  page.drawText("Subtotal", { x: 400, y, size: 10, font: helvetica, color: grayColor })
  page.drawText(`Rs.${subtotal.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
  y -= 15

  // Tax
  const taxAmount = payment.tax_amount || 0
  if (taxAmount > 0) {
    page.drawText("Tax (GST)", { x: 400, y, size: 10, font: helvetica, color: grayColor })
    page.drawText(`Rs.${taxAmount.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: grayColor })
    y -= 15
  }

  // Discount
  const discountAmount = payment.discount_amount || 0
  if (discountAmount > 0) {
    page.drawText("Discount", { x: 400, y, size: 10, font: helvetica, color: successColor })
    page.drawText(`-Rs.${discountAmount.toLocaleString("en-IN")}`, { x: 480, y, size: 10, font: helvetica, color: successColor })
    y -= 15
  }

  y -= 5

  // Total
  const totalAmount = payment.net_amount || payment.amount || (subtotal + taxAmount - discountAmount)
  page.drawRectangle({
    x: 380,
    y: y - 8,
    width: 165,
    height: 25,
    color: primaryColor,
  })

  page.drawText("TOTAL PAID", { x: 390, y: y, size: 11, font: helveticaBold, color: rgb(1, 1, 1) })
  page.drawText(`Rs.${totalAmount.toLocaleString("en-IN")}`, { x: 480, y: y, size: 11, font: helveticaBold, color: rgb(1, 1, 1) })

  y -= 45

  // Payment Details Section
  page.drawText("PAYMENT DETAILS", {
    x: 50,
    y,
    size: 10,
    font: helveticaBold,
    color: primaryColor,
  })

  y -= 18

  const paymentMethod = payment.payment_method === "razorpay" ? "Razorpay (Online)" : (payment.payment_method || "Offline")
  page.drawText(`Method: ${paymentMethod}`, { x: 60, y, size: 9, font: helvetica, color: grayColor })
  y -= 13

  if (payment.razorpay_payment_id) {
    page.drawText(`Payment ID: ${payment.razorpay_payment_id}`, { x: 60, y, size: 9, font: helvetica, color: grayColor })
    y -= 13
  }

  if (payment.razorpay_order_id) {
    page.drawText(`Order ID: ${payment.razorpay_order_id}`, { x: 60, y, size: 9, font: helvetica, color: grayColor })
    y -= 13
  }

  y -= 15

  // Status Badge
  const statusColor = payment.status === "completed" ? successColor : rgb(0.8, 0.5, 0.1)
  page.drawRectangle({
    x: 50,
    y: y - 5,
    width: 80,
    height: 22,
    color: statusColor,
  })
  page.drawText(payment.status === "completed" ? "PAID" : payment.status?.toUpperCase() || "PENDING", {
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
      "Content-Disposition": `attachment; filename="order-${payment.payment_number}.pdf"`,
    },
  })
}
