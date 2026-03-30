import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import * as XLSX from "xlsx"

// GET /api/abstracts/export?event_id=...&format=xlsx|csv
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("event_id")
    const format = searchParams.get("format") || "xlsx"
    const status = searchParams.get("status") // Optional filter by status

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    const { error: authError } = await requireEventAndPermission(eventId, 'abstracts')
    if (authError) return authError

    const supabase = await createAdminClient()

    // Build query
    let query = (supabase as any)
      .from("abstracts")
      .select(`
        abstract_number,
        title,
        abstract_text,
        keywords,
        presentation_type,
        award_type,
        status,
        decision,
        decision_notes,
        accepted_as,
        presenting_author_name,
        presenting_author_email,
        presenting_author_affiliation,
        presenting_author_mobile,
        submitted_at,
        updated_at,
        decision_notified_at,
        category:abstract_categories(name),
        authors:abstract_authors(name, email, affiliation, author_order, is_presenting),
        reviews:abstract_reviews(
          recommendation,
          overall_score,
          comments_to_author,
          comments_to_admin,
          reviewed_at
        )
      `)
      .eq("event_id", eventId)
      .order("abstract_number", { ascending: true })

    if (status) {
      query = query.eq("status", status)
    }

    const { data: abstracts, error } = await query

    if (error) {
      console.error("Error fetching abstracts:", error)
      return NextResponse.json({ error: "Failed to fetch abstracts" }, { status: 500 })
    }

    // Fetch event details for filename
    const { data: event } = await (supabase as any)
      .from("events")
      .select("short_name, name")
      .eq("id", eventId)
      .single()

    // Transform data for export
    const exportData = (abstracts || []).map((a: any) => {
      const authors = (a.authors || [])
        .sort((x: any, y: any) => x.author_order - y.author_order)
        .map((author: any) => `${author.name} (${author.affiliation})`)
        .join("; ")

      const reviewScores = (a.reviews || [])
        .map((r: any) => r.overall_score)
        .filter((s: any) => s != null)

      const avgScore = reviewScores.length > 0
        ? (reviewScores.reduce((a: number, b: number) => a + b, 0) / reviewScores.length).toFixed(2)
        : ""

      const recommendations = (a.reviews || [])
        .map((r: any) => r.recommendation)
        .filter((r: any) => r)
        .join(", ")

      return {
        "Abstract #": a.abstract_number || "",
        "Title": a.title || "",
        "Category": a.category?.name || "",
        "Presentation Type": a.presentation_type || "",
        "Award Category": a.award_type || "",
        "Status": a.status || "",
        "Decision": a.decision || "",
        "Accepted As": a.accepted_as || "",
        "Decision Notes": a.decision_notes || "",
        "Presenting Author": a.presenting_author_name || "",
        "Presenting Email": a.presenting_author_email || "",
        "Presenting Affiliation": a.presenting_author_affiliation || "",
        "Presenting Mobile": a.presenting_author_mobile || "",
        "All Authors": authors,
        "Abstract Text": a.abstract_text || "",
        "Keywords": a.keywords || "",
        "Avg Review Score": avgScore,
        "Review Recommendations": recommendations,
        "Submitted At": a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "",
        "Updated At": a.updated_at ? new Date(a.updated_at).toLocaleString() : "",
        "Notified At": a.decision_notified_at ? new Date(a.decision_notified_at).toLocaleString() : "",
      }
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(exportData)

    // Set column widths
    const colWidths = [
      { wch: 12 }, // Abstract #
      { wch: 50 }, // Title
      { wch: 20 }, // Category
      { wch: 15 }, // Presentation Type
      { wch: 15 }, // Award Category
      { wch: 12 }, // Status
      { wch: 12 }, // Decision
      { wch: 15 }, // Accepted As
      { wch: 30 }, // Decision Notes
      { wch: 25 }, // Presenting Author
      { wch: 30 }, // Email
      { wch: 30 }, // Affiliation
      { wch: 15 }, // Mobile
      { wch: 60 }, // All Authors
      { wch: 80 }, // Abstract Text
      { wch: 30 }, // Keywords
      { wch: 10 }, // Avg Score
      { wch: 25 }, // Recommendations
      { wch: 20 }, // Submitted At
      { wch: 20 }, // Updated At
      { wch: 20 }, // Notified At
    ]
    ws["!cols"] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, "Abstracts")

    // Generate file
    const eventName = event?.short_name || event?.name || "abstracts"
    const fileName = `${eventName}-abstracts-${new Date().toISOString().split("T")[0]}`

    if (format === "csv") {
      const csvData = XLSX.utils.sheet_to_csv(ws)
      return new NextResponse(csvData, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${fileName}.csv"`,
        },
      })
    }

    // Default to xlsx
    const xlsxData = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    return new NextResponse(xlsxData, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      },
    })
  } catch (error) {
    console.error("Error exporting abstracts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
