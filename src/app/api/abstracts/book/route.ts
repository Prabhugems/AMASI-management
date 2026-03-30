import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

// GET /api/abstracts/book?event_id=...&status=accepted
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const status = searchParams.get("status") || "accepted" // Default to accepted abstracts only

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Fetch event details
    const { data: event } = await (supabase as any)
      .from("events")
      .select("name, short_name, start_date, end_date, city, venue")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Fetch abstracts
    const { data: abstracts, error } = await (supabase as any)
      .from("abstracts")
      .select(`
        abstract_number,
        title,
        abstract_text,
        keywords,
        presentation_type,
        accepted_as,
        presenting_author_name,
        presenting_author_affiliation,
        category:abstract_categories(name),
        authors:abstract_authors(name, affiliation, author_order, is_presenting)
      `)
      .eq("event_id", eventId)
      .eq("status", status)
      .order("abstract_number", { ascending: true })

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    if (!abstracts || abstracts.length === 0) {
      return NextResponse.json({ error: "No abstracts found with the specified status" }, { status: 404 })
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create()
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const pageWidth = 595.28 // A4 width in points
    const pageHeight = 841.89 // A4 height in points
    const margin = 50
    const contentWidth = pageWidth - (margin * 2)

    // Helper to add new page
    const addPage = () => {
      const page = pdfDoc.addPage([pageWidth, pageHeight])
      return page
    }

    // Helper to wrap text
    const wrapText = (text: string, font: any, fontSize: number, maxWidth: number): string[] => {
      const words = text.split(" ")
      const lines: string[] = []
      let currentLine = ""

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const width = font.widthOfTextAtSize(testLine, fontSize)
        if (width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) {
        lines.push(currentLine)
      }
      return lines
    }

    // Title page
    let page = addPage()
    let y = pageHeight - 200

    // Event name
    const eventName = event.name || event.short_name || "Abstract Book"
    const titleLines = wrapText(eventName, helveticaBold, 28, contentWidth)
    for (const line of titleLines) {
      const titleWidth = helveticaBold.widthOfTextAtSize(line, 28)
      page.drawText(line, {
        x: (pageWidth - titleWidth) / 2,
        y,
        size: 28,
        font: helveticaBold,
        color: rgb(0, 0.2, 0.4),
      })
      y -= 36
    }

    y -= 20
    page.drawText("ABSTRACT BOOK", {
      x: (pageWidth - helveticaBold.widthOfTextAtSize("ABSTRACT BOOK", 24)) / 2,
      y,
      size: 24,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    })

    y -= 60
    // Event details
    if (event.start_date) {
      const dateStr = new Date(event.start_date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
      const endDateStr = event.end_date
        ? ` - ${new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
        : ""
      const fullDate = `${dateStr}${endDateStr}`
      page.drawText(fullDate, {
        x: (pageWidth - helvetica.widthOfTextAtSize(fullDate, 14)) / 2,
        y,
        size: 14,
        font: helvetica,
      })
      y -= 24
    }

    if (event.venue || event.city) {
      const location = [event.venue, event.city].filter(Boolean).join(", ")
      page.drawText(location, {
        x: (pageWidth - helvetica.widthOfTextAtSize(location, 14)) / 2,
        y,
        size: 14,
        font: helvetica,
      })
      y -= 24
    }

    y -= 40
    const abstractCount = `${abstracts.length} Abstracts`
    page.drawText(abstractCount, {
      x: (pageWidth - helvetica.widthOfTextAtSize(abstractCount, 12)) / 2,
      y,
      size: 12,
      font: helvetica,
      color: rgb(0.4, 0.4, 0.4),
    })

    // Group abstracts by category
    const byCategory: Record<string, any[]> = {}
    for (const abstract of abstracts) {
      const category = abstract.category?.name || "Uncategorized"
      if (!byCategory[category]) {
        byCategory[category] = []
      }
      byCategory[category].push(abstract)
    }

    // Abstracts pages
    let currentY = 0
    let currentPage: any = null
    const lineHeight = 14
    const abstractSpacing = 30

    const ensureSpace = (needed: number) => {
      if (!currentPage || currentY < margin + needed) {
        currentPage = addPage()
        currentY = pageHeight - margin

        // Page header
        currentPage.drawText(event.short_name || event.name, {
          x: margin,
          y: currentY,
          size: 10,
          font: helvetica,
          color: rgb(0.5, 0.5, 0.5),
        })
        currentY -= 30
      }
    }

    for (const category of Object.keys(byCategory)) {
      const categoryAbstracts = byCategory[category]
      // Category header on new page
      currentPage = addPage()
      currentY = pageHeight - margin

      currentPage.drawText(category, {
        x: margin,
        y: currentY,
        size: 18,
        font: helveticaBold,
        color: rgb(0, 0.3, 0.5),
      })
      currentY -= 40

      for (const abstract of categoryAbstracts) {
        // Calculate space needed for this abstract
        const titleLines = wrapText(abstract.title, helveticaBold, 12, contentWidth)

        // Authors
        const authors = (abstract.authors || [])
          .sort((a: any, b: any) => a.author_order - b.author_order)
          .map((a: any) => {
            const presenting = a.is_presenting ? "*" : ""
            return `${a.name}${presenting}`
          })
          .join(", ")
        const authorLines = wrapText(authors, helvetica, 10, contentWidth)

        // Affiliations (unique)
        const allAffiliations = (abstract.authors || [])
          .map((a: any) => a.affiliation)
          .filter(Boolean)
        const uniqueAffiliations = allAffiliations.filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i)
        const affiliations = uniqueAffiliations.join("; ")
        const affLines = wrapText(affiliations, helveticaOblique, 9, contentWidth)

        // Abstract text
        const abstractLines = wrapText(abstract.abstract_text || "", helvetica, 10, contentWidth)

        const totalHeight =
          30 + // Abstract number line
          (titleLines.length * 16) +
          (authorLines.length * 12) +
          (affLines.length * 11) +
          20 + // spacing before abstract
          (abstractLines.length * 12) +
          (abstract.keywords ? 24 : 0) +
          abstractSpacing

        ensureSpace(Math.min(totalHeight, 300)) // Ensure at least start fits

        // Abstract number and presentation type
        const abstractHeader = `${abstract.abstract_number} | ${abstract.accepted_as || abstract.presentation_type || "Presentation"}`
        currentPage.drawText(abstractHeader, {
          x: margin,
          y: currentY,
          size: 10,
          font: helveticaBold,
          color: rgb(0.3, 0.3, 0.3),
        })
        currentY -= 20

        // Title
        for (const line of titleLines) {
          ensureSpace(lineHeight)
          currentPage.drawText(line, {
            x: margin,
            y: currentY,
            size: 12,
            font: helveticaBold,
          })
          currentY -= 16
        }

        currentY -= 6

        // Authors
        for (const line of authorLines) {
          ensureSpace(lineHeight)
          currentPage.drawText(line, {
            x: margin,
            y: currentY,
            size: 10,
            font: helvetica,
          })
          currentY -= 12
        }

        // Affiliations
        for (const line of affLines) {
          ensureSpace(lineHeight)
          currentPage.drawText(line, {
            x: margin,
            y: currentY,
            size: 9,
            font: helveticaOblique,
            color: rgb(0.4, 0.4, 0.4),
          })
          currentY -= 11
        }

        currentY -= 10

        // Abstract text
        for (const line of abstractLines) {
          ensureSpace(lineHeight)
          currentPage.drawText(line, {
            x: margin,
            y: currentY,
            size: 10,
            font: helvetica,
          })
          currentY -= 12
        }

        // Keywords
        if (abstract.keywords) {
          currentY -= 8
          ensureSpace(20)
          currentPage.drawText(`Keywords: ${abstract.keywords}`, {
            x: margin,
            y: currentY,
            size: 9,
            font: helveticaOblique,
            color: rgb(0.3, 0.3, 0.3),
          })
          currentY -= 12
        }

        currentY -= abstractSpacing

        // Separator line
        if (currentY > margin + 50) {
          currentPage.drawLine({
            start: { x: margin, y: currentY + 15 },
            end: { x: pageWidth - margin, y: currentY + 15 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
          })
        }
      }
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()
    const fileName = `${event.short_name || "abstracts"}-abstract-book-${new Date().toISOString().split("T")[0]}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Error generating abstract book:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
