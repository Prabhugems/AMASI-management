import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import net from "net"

// POST /api/print/badge - Lookup registration and print badge with template
export async function POST(request: NextRequest) {
  try {
    const supabaseClient = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseClient as any
    const body = await request.json()
    const { code, printer_ip, printer_port = 9100 } = body

    if (!code) {
      return NextResponse.json({ success: false, error: "Missing code" }, { status: 400 })
    }

    if (!printer_ip) {
      return NextResponse.json({ success: false, error: "Missing printer_ip" }, { status: 400 })
    }

    // 1. Find registration
    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select(`
        *,
        events (
          id,
          name,
          slug
        ),
        ticket_types (
          id,
          name
        )
      `)
      .or(`qr_code.eq.${code},id.eq.${code},registration_number.eq.${code}`)
      .single()

    if (regError || !registration) {
      // Try partial match
      const { data: partialMatch } = await supabase
        .from("registrations")
        .select(`
          *,
          events (id, name, slug),
          ticket_types (id, name)
        `)
        .ilike("registration_number", `%${code}%`)
        .limit(1)
        .single()

      if (!partialMatch) {
        return NextResponse.json({ success: false, error: "Registration not found" }, { status: 404 })
      }
    }

    const reg = registration || {}

    // Block badge printing for online-only participants
    if (reg.participation_mode === "online") {
      return NextResponse.json({
        success: false,
        error: "Cannot print badge for online-only participants"
      }, { status: 400 })
    }

    // 2. Find badge template for this event
    const { data: badgeTemplate } = await supabase
      .from("badge_templates")
      .select("*")
      .eq("event_id", reg.event_id)
      .eq("is_default", true)
      .single()

    // 3. Generate ZPL
    let zpl: string
    if (badgeTemplate?.template_data) {
      zpl = generateZPLFromTemplate(badgeTemplate.template_data, reg)
    } else {
      zpl = generateDefaultZPL(reg)
    }

    // 4. Send to printer
    const printResult = await sendToPrinter(printer_ip, printer_port, zpl)

    if (printResult.success) {
      // Update badge_printed status
      await supabase
        .from("registrations")
        .update({ badge_printed: true, badge_printed_at: new Date().toISOString() })
        .eq("id", reg.id)

      return NextResponse.json({
        success: true,
        message: "Badge printed successfully",
        registration: {
          id: reg.id,
          name: reg.attendee_name,
          email: reg.attendee_email,
          registrationNumber: reg.registration_number,
          ticketType: reg.ticket_types?.name || "Attendee",
          eventName: reg.events?.name
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: printResult.error || "Print failed"
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Print badge error:", error)
    return NextResponse.json({ success: false, error: "Failed to print badge" }, { status: 500 })
  }
}

// Send ZPL to printer
async function sendToPrinter(ip: string, port: number, zpl: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const client = new net.Socket()
    const timeout = setTimeout(() => {
      client.destroy()
      resolve({ success: false, error: "Connection timeout" })
    }, 10000)

    client.connect(port, ip, () => {
      client.write(zpl, () => {
        clearTimeout(timeout)
        client.end()
        resolve({ success: true })
      })
    })

    client.on("error", (err) => {
      clearTimeout(timeout)
      client.destroy()
      resolve({ success: false, error: err.message })
    })
  })
}

// Generate default ZPL
function generateDefaultZPL(reg: any): string {
  const name = reg.attendee_name || "Guest"
  const institution = reg.attendee_institution || ""
  const ticketType = reg.ticket_types?.name || "Attendee"
  const regNumber = reg.registration_number || ""
  const eventName = reg.events?.name || "Event"

  return `^XA
^CI28
^PW812
^LL1218
^FO50,50^A0N,40,40^FD${eventName}^FS
^FO50,150^A0N,70,70^FD${name}^FS
^FO50,250^A0N,35,35^FD${institution}^FS
^FO50,350^GB200,60,3^FS
^FO60,365^A0N,35,35^FD${ticketType}^FS
^FO50,450^A0N,30,30^FD${regNumber}^FS
^FO50,520^BQN,2,5^FDQA,${regNumber}^FS
^XZ`
}

// Generate ZPL from badge template
function generateZPLFromTemplate(templateData: any, reg: any): string {
  const elements = templateData.elements || []
  const badgeSize = templateData.badgeSize || { width: 384, height: 576 }

  // Scale: template pixels to Zebra dots (203 DPI)
  // Template is at ~96 DPI, Zebra at 203 DPI
  const scaleX = 812 / badgeSize.width
  const scaleY = 1218 / badgeSize.height

  let zplElements = ""

  const sortedElements = [...elements].sort((a: any, b: any) => (a.zIndex || 0) - (b.zIndex || 0))

  for (const element of sortedElements) {
    const x = Math.floor(element.x * scaleX)
    const y = Math.floor(element.y * scaleY)
    const width = Math.floor(element.width * scaleX)
    const height = Math.floor(element.height * scaleY)

    if (element.type === "text") {
      let content = element.content || ""
      content = replacePlaceholders(content, reg)

      const fontSize = Math.floor((element.fontSize || 14) * scaleX * 0.8)
      const fontHeight = Math.max(20, Math.min(fontSize, 100))
      const align = element.textAlign === "center" ? "C" : element.textAlign === "right" ? "R" : "L"

      zplElements += `^FO${x},${y}^A0N,${fontHeight},${fontHeight}^FB${width},2,0,${align}^FD${content}^FS\n`
    }
    else if (element.type === "shape" && element.shapeType === "rectangle") {
      const borderWidth = element.borderWidth || 2
      zplElements += `^FO${x},${y}^GB${width},${height},${borderWidth}^FS\n`
    }
    else if (element.type === "line") {
      const thickness = element.strokeWidth || 2
      zplElements += `^FO${x},${y}^GB${width},${thickness},${thickness}^FS\n`
    }
    else if (element.type === "qr_code") {
      let content = element.content || "{{registration_number}}"
      content = replacePlaceholders(content, reg)
      const qrSize = Math.max(2, Math.min(Math.floor(width / 30), 10))
      zplElements += `^FO${x},${y}^BQN,2,${qrSize}^FDQA,${content}^FS\n`
    }
    else if (element.type === "barcode") {
      let content = element.content || "{{registration_number}}"
      content = replacePlaceholders(content, reg)
      zplElements += `^FO${x},${y}^BCN,${height},Y,N,N^FD${content}^FS\n`
    }
  }

  return `^XA
^CI28
^PW812
^LL1218
${zplElements}
^XZ`
}

// Replace placeholders
function replacePlaceholders(text: string, reg: any): string {
  if (!text) return ""
  return text
    .replace(/\{\{name\}\}/gi, reg.attendee_name || "")
    .replace(/\{\{registration_number\}\}/gi, reg.registration_number || "")
    .replace(/\{\{ticket_type\}\}/gi, reg.ticket_types?.name || "")
    .replace(/\{\{email\}\}/gi, reg.attendee_email || "")
    .replace(/\{\{phone\}\}/gi, reg.attendee_phone || "")
    .replace(/\{\{institution\}\}/gi, reg.attendee_institution || "")
    .replace(/\{\{organization\}\}/gi, reg.attendee_institution || "")
    .replace(/\{\{designation\}\}/gi, reg.attendee_designation || "")
    .replace(/\{\{city\}\}/gi, reg.attendee_city || "")
    .replace(/\{\{event_name\}\}/gi, reg.events?.name || "")
    .replace(/\{\{participation_mode\}\}/gi, reg.participation_mode || "offline")
}
