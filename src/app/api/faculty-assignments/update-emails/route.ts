import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { parse } from "csv-parse/sync"

/**
 * POST /api/faculty-assignments/update-emails
 *
 * Upload a CSV with facultyName + email columns to update all placeholder
 * emails in faculty_assignments for a given event.
 *
 * Form data:
 *   - file: CSV file (must have columns with faculty name and email)
 *   - event_id: UUID of the event
 */

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/^dr\.?\s*/i, "")
    .replace(/^prof\.?\s*/i, "")
    .replace(/^mr\.?\s*/i, "")
    .replace(/^mrs\.?\s*/i, "")
    .replace(/^ms\.?\s*/i, "")
    .replace(/\s+/g, " ")
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const eventId = formData.get("event_id") as string | null

    if (!file || !eventId) {
      return NextResponse.json(
        { error: "file and event_id are required" },
        { status: 400 }
      )
    }

    // Parse CSV
    const text = await file.text()
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[]

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV is empty" }, { status: 400 })
    }

    // Auto-detect name and email columns
    const headers = Object.keys(records[0])
    const nameCol = headers.find((h) => {
      const l = h.toLowerCase()
      return (
        l.includes("facultyname") ||
        l.includes("faculty_name") ||
        l === "name" ||
        l.includes("speaker") ||
        l.includes("faculty")
      )
    })
    const emailCol = headers.find((h) => {
      const l = h.toLowerCase()
      return l.includes("email") || l.includes("e-mail") || l.includes("mail")
    })
    const phoneCol = headers.find((h) => {
      const l = h.toLowerCase()
      return l.includes("phone") || l.includes("mobile") || l.includes("cell")
    })

    if (!nameCol || !emailCol) {
      return NextResponse.json(
        {
          error: `Could not detect name/email columns. Found headers: ${headers.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Build name -> {email, phone} map from CSV (use normalized name as key)
    const csvLookup = new Map<
      string,
      { email: string; phone: string | null; originalName: string }
    >()
    for (const row of records) {
      const name = row[nameCol]?.trim()
      const email = row[emailCol]?.trim()
      const phone = phoneCol ? row[phoneCol]?.trim() || null : null
      if (name && email && !email.includes("@placeholder.")) {
        const key = normalizeName(name)
        if (!csvLookup.has(key)) {
          csvLookup.set(key, { email, phone, originalName: name })
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createAdminClient()) as any

    // Fetch all assignments with placeholder emails for this event
    const { data: assignments, error: fetchError } = await supabase
      .from("faculty_assignments")
      .select("id, faculty_name, faculty_email, faculty_phone")
      .eq("event_id", eventId)
      .like("faculty_email", "%@placeholder.%")

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch assignments: " + fetchError.message },
        { status: 500 }
      )
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No assignments with placeholder emails found",
        updated: 0,
        notMatched: 0,
        csvEntries: csvLookup.size,
      })
    }

    let updated = 0
    const notMatched: string[] = []
    const updatedDetails: Array<{
      name: string
      oldEmail: string
      newEmail: string
    }> = []

    for (const assignment of assignments) {
      const normalizedAssignName = normalizeName(assignment.faculty_name)

      // Try exact normalized match
      let match = csvLookup.get(normalizedAssignName)

      // Fuzzy: try matching by last 2 name parts
      if (!match) {
        const assignParts = normalizedAssignName
          .split(" ")
          .filter((p: string) => p.length > 1)
        for (const [csvKey, csvVal] of csvLookup) {
          const csvParts = csvKey.split(" ").filter((p) => p.length > 1)
          // Match if at least 2 parts match
          const matching = assignParts.filter((p: string) =>
            csvParts.includes(p)
          )
          if (matching.length >= 2) {
            match = csvVal
            break
          }
          // Match if last name matches and first initial matches
          if (
            csvParts.length >= 2 &&
            assignParts.length >= 2 &&
            csvParts[csvParts.length - 1] ===
              assignParts[assignParts.length - 1] &&
            csvParts[0][0] === assignParts[0][0]
          ) {
            match = csvVal
            break
          }
        }
      }

      if (match) {
        const updates: Record<string, string> = {
          faculty_email: match.email,
        }
        // Also update phone if it's missing
        if (match.phone && !assignment.faculty_phone) {
          updates.faculty_phone = match.phone
        }

        const { error: updateError } = await supabase
          .from("faculty_assignments")
          .update(updates)
          .eq("id", assignment.id)

        if (!updateError) {
          updated++
          updatedDetails.push({
            name: assignment.faculty_name,
            oldEmail: assignment.faculty_email,
            newEmail: match.email,
          })
        }
      } else {
        notMatched.push(
          `${assignment.faculty_name} (${assignment.faculty_email})`
        )
      }
    }

    // Also update registrations table (speaker dashboard reads from here)
    let registrationsUpdated = 0
    const { data: regs } = await supabase
      .from("registrations")
      .select("id, attendee_name, attendee_email, attendee_phone")
      .eq("event_id", eventId)
      .like("attendee_email", "%@placeholder.%")

    if (regs && regs.length > 0) {
      for (const reg of regs) {
        const normalizedRegName = normalizeName(reg.attendee_name || "")
        let match = csvLookup.get(normalizedRegName)

        if (!match) {
          const regParts = normalizedRegName
            .split(" ")
            .filter((p: string) => p.length > 1)
          for (const [csvKey, csvVal] of csvLookup) {
            const csvParts = csvKey.split(" ").filter((p) => p.length > 1)
            const matching = regParts.filter((p: string) =>
              csvParts.includes(p)
            )
            if (matching.length >= 2) {
              match = csvVal
              break
            }
            if (
              csvParts.length >= 2 &&
              regParts.length >= 2 &&
              csvParts[csvParts.length - 1] ===
                regParts[regParts.length - 1] &&
              csvParts[0][0] === regParts[0][0]
            ) {
              match = csvVal
              break
            }
          }
        }

        if (match) {
          const regUpdates: Record<string, string> = {
            attendee_email: match.email,
          }
          if (match.phone && !reg.attendee_phone) {
            regUpdates.attendee_phone = match.phone
          }
          const { error: regUpdateError } = await supabase
            .from("registrations")
            .update(regUpdates)
            .eq("id", reg.id)
          if (!regUpdateError) registrationsUpdated++
        }
      }
    }

    // Also update the faculty table where email is placeholder
    let facultyUpdated = 0
    for (const [, csvEntry] of csvLookup) {
      const { data: faculties } = await supabase
        .from("faculty")
        .select("id, email, name")
        .like("email", "%@placeholder.%")
        .ilike("name", `%${csvEntry.originalName.split(" ").pop()}%`)

      if (faculties && faculties.length > 0) {
        for (const fac of faculties) {
          const normalizedFac = normalizeName(fac.name || "")
          const normalizedCsv = normalizeName(csvEntry.originalName)
          const facParts = normalizedFac
            .split(" ")
            .filter((p: string) => p.length > 1)
          const csvParts = normalizedCsv
            .split(" ")
            .filter((p: string) => p.length > 1)
          const matching = facParts.filter((p: string) => csvParts.includes(p))
          if (matching.length >= 2 || normalizedFac === normalizedCsv) {
            await supabase
              .from("faculty")
              .update({ email: csvEntry.email })
              .eq("id", fac.id)
            facultyUpdated++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} assignment emails, ${registrationsUpdated} registration emails, ${facultyUpdated} faculty emails`,
      totalPlaceholders: assignments.length,
      updated,
      registrationsUpdated,
      facultyUpdated,
      notMatched: notMatched.length,
      notMatchedNames: notMatched.slice(0, 20),
      updatedDetails: updatedDetails.slice(0, 30),
      csvEntries: csvLookup.size,
      detectedColumns: { name: nameCol, email: emailCol, phone: phoneCol },
    })
  } catch (error) {
    console.error("Update emails error:", error)
    return NextResponse.json(
      { error: "Failed to update emails" },
      { status: 500 }
    )
  }
}
