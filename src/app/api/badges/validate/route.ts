import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

interface ValidationError {
  type: "error" | "warning" | "info"
  field: string
  message: string
  details?: string
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  stats: {
    totalRegistrations: number
    registrationsWithIssues: number
    missingNames: number
    missingInstitutions: number
    missingPhones: number
    missingEmails: number
    missingAddons: number
  }
}

// POST /api/badges/validate - Validate badge template and registrations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, template_id, registration_ids } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // 1. Validate Template
    let template: any = null
    if (template_id) {
      const { data: templateData, error: templateError } = await (supabase as any)
        .from("badge_templates")
        .select("*")
        .eq("id", template_id)
        .single()

      if (templateError || !templateData) {
        errors.push({
          type: "error",
          field: "template",
          message: "Template not found",
          details: `Template ID: ${template_id}`,
        })
      } else {
        template = templateData

        // Parse template_data if string
        let templateData_parsed = template.template_data
        if (typeof templateData_parsed === "string") {
          try {
            templateData_parsed = JSON.parse(templateData_parsed)
          } catch {
            errors.push({
              type: "error",
              field: "template_data",
              message: "Invalid template data format",
              details: "template_data is not valid JSON",
            })
            templateData_parsed = {}
          }
        }

        const elements = templateData_parsed?.elements || []

        // Check if template has elements
        if (elements.length === 0) {
          errors.push({
            type: "error",
            field: "template",
            message: "Template has no design elements",
            details: "Add text, QR codes, or images to your badge design",
          })
        }

        // Check for required elements
        const hasNameElement = elements.some((e: any) =>
          e.type === "text" && e.content?.includes("{{name}}")
        )
        if (!hasNameElement) {
          warnings.push({
            type: "warning",
            field: "template",
            message: "Template missing name placeholder",
            details: "Consider adding {{name}} to display attendee names",
          })
        }

        const hasQRCode = elements.some((e: any) => e.type === "qr_code")
        if (!hasQRCode) {
          warnings.push({
            type: "warning",
            field: "template",
            message: "Template has no QR code",
            details: "QR codes enable quick check-in scanning",
          })
        }

        // Check for placeholders in template
        const allPlaceholders: string[] = []
        elements.forEach((e: any) => {
          if (e.content) {
            const matches = e.content.match(/\{\{(\w+)\}\}/g) || []
            allPlaceholders.push(...matches)
          }
        })

        // Identify which placeholders are used
        const usedPlaceholders = {
          name: allPlaceholders.includes("{{name}}"),
          institution: allPlaceholders.includes("{{institution}}"),
          designation: allPlaceholders.includes("{{designation}}"),
          email: allPlaceholders.includes("{{email}}"),
          phone: allPlaceholders.includes("{{phone}}"),
          ticket_type: allPlaceholders.includes("{{ticket_type}}"),
          registration_number: allPlaceholders.includes("{{registration_number}}"),
          addons: allPlaceholders.includes("{{addons}}"),
        }

        // 2. Validate Registrations
        let query = (supabase as any)
          .from("registrations")
          .select(`
            id,
            registration_number,
            attendee_name,
            attendee_email,
            attendee_phone,
            attendee_institution,
            attendee_designation,
            ticket_type_id,
            ticket_types (name),
            registration_addons (addon_id, addons (name))
          `)
          .eq("event_id", event_id)

        if (registration_ids?.length > 0) {
          query = query.in("id", registration_ids)
        }

        const { data: registrations, error: regError } = await query

        if (regError) {
          errors.push({
            type: "error",
            field: "registrations",
            message: "Failed to fetch registrations",
            details: regError.message,
          })
        }

        // Stats
        const stats = {
          totalRegistrations: registrations?.length || 0,
          registrationsWithIssues: 0,
          missingNames: 0,
          missingInstitutions: 0,
          missingPhones: 0,
          missingEmails: 0,
          missingAddons: 0,
        }

        if (registrations && registrations.length > 0) {
          // Check each registration for missing data
          const issuesList: string[] = []

          registrations.forEach((reg: any) => {
            let hasIssue = false

            // Check name (critical)
            if (!reg.attendee_name || reg.attendee_name.trim() === "") {
              stats.missingNames++
              hasIssue = true
              if (stats.missingNames <= 3) {
                issuesList.push(`${reg.registration_number}: Missing name`)
              }
            }

            // Check institution (if used in template)
            if (usedPlaceholders.institution && (!reg.attendee_institution || reg.attendee_institution.trim() === "")) {
              stats.missingInstitutions++
              hasIssue = true
            }

            // Check phone (if used in template)
            if (usedPlaceholders.phone && (!reg.attendee_phone || reg.attendee_phone.trim() === "")) {
              stats.missingPhones++
              hasIssue = true
            }

            // Check email (if used in template)
            if (usedPlaceholders.email && (!reg.attendee_email || reg.attendee_email.trim() === "")) {
              stats.missingEmails++
              hasIssue = true
            }

            // Check addons (if used in template)
            if (usedPlaceholders.addons && (!reg.registration_addons || reg.registration_addons.length === 0)) {
              stats.missingAddons++
              // Don't mark as issue - it's OK to have no addons
            }

            if (hasIssue) {
              stats.registrationsWithIssues++
            }
          })

          // Add warnings for missing data
          if (stats.missingNames > 0) {
            errors.push({
              type: "error",
              field: "registrations",
              message: `${stats.missingNames} registration(s) missing attendee name`,
              details: issuesList.slice(0, 3).join(", ") + (stats.missingNames > 3 ? ` and ${stats.missingNames - 3} more...` : ""),
            })
          }

          if (stats.missingInstitutions > 0 && usedPlaceholders.institution) {
            warnings.push({
              type: "warning",
              field: "registrations",
              message: `${stats.missingInstitutions} registration(s) missing institution`,
              details: "These badges will show empty institution field",
            })
          }

          if (stats.missingPhones > 0 && usedPlaceholders.phone) {
            warnings.push({
              type: "warning",
              field: "registrations",
              message: `${stats.missingPhones} registration(s) missing phone number`,
              details: "These badges will show empty phone field",
            })
          }

          if (stats.missingEmails > 0 && usedPlaceholders.email) {
            warnings.push({
              type: "warning",
              field: "registrations",
              message: `${stats.missingEmails} registration(s) missing email`,
              details: "These badges will show empty email field",
            })
          }

          if (stats.missingAddons > 0 && usedPlaceholders.addons) {
            warnings.push({
              type: "info",
              field: "registrations",
              message: `${stats.missingAddons} registration(s) have no addons`,
              details: "These badges will show empty addons field",
            })
          }
        } else if (!regError) {
          errors.push({
            type: "error",
            field: "registrations",
            message: "No registrations found",
            details: "Cannot generate badges without registrations",
          })
        }

        const result: ValidationResult = {
          valid: errors.length === 0,
          errors,
          warnings,
          stats,
        }

        return NextResponse.json(result)
      }
    } else {
      errors.push({
        type: "error",
        field: "template",
        message: "No template selected",
        details: "Please select a badge template",
      })
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalRegistrations: 0,
        registrationsWithIssues: 0,
        missingNames: 0,
        missingInstitutions: 0,
        missingPhones: 0,
        missingEmails: 0,
        missingAddons: 0,
      },
    })
  } catch (error: any) {
    console.error("Error validating badges:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
