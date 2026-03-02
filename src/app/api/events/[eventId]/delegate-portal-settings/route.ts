import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"

interface DelegatePortalSettings {
  show_invitation: boolean
  show_badge: boolean
  show_certificate: boolean
  show_receipt: boolean
  show_program_schedule: boolean
  show_addons: boolean
  whatsapp_group_url: string
  custom_links: { name: string; url: string }[]
}

const DEFAULTS: DelegatePortalSettings = {
  show_invitation: true,
  show_badge: true,
  show_certificate: true,
  show_receipt: true,
  show_program_schedule: true,
  show_addons: true,
  whatsapp_group_url: "",
  custom_links: [],
}

// GET /api/events/[eventId]/delegate-portal-settings
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const auth = await requireEventAccess(eventId)
    if (auth.error) return auth.error

    const supabase = await createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error } = await (supabase as any)
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .single()

    if (error || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const settings = (event.settings || {}) as Record<string, any>
    let delegatePortal = settings.delegate_portal as Partial<DelegatePortalSettings> | undefined

    // Auto-migrate from flat settings if delegate_portal doesn't exist yet
    if (!delegatePortal) {
      delegatePortal = {}

      if (settings.whatsapp_group_url) {
        delegatePortal.whatsapp_group_url = settings.whatsapp_group_url
      }

      if (settings.course_materials_url) {
        delegatePortal.custom_links = [
          { name: "Course Materials", url: settings.course_materials_url },
        ]
      }
    }

    // Merge with defaults
    const result: DelegatePortalSettings = { ...DEFAULTS, ...delegatePortal }

    return NextResponse.json({ delegate_portal: result })
  } catch (error: any) {
    console.error("Error in GET delegate-portal-settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

// POST /api/events/[eventId]/delegate-portal-settings
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const auth = await requireEventAccess(eventId)
    if (auth.error) return auth.error

    const body = await request.json()
    const incoming = body.delegate_portal as Partial<DelegatePortalSettings>

    if (!incoming) {
      return NextResponse.json({ error: "Missing delegate_portal in body" }, { status: 400 })
    }

    // Sanitize custom_links: only keep entries with both name and url
    if (incoming.custom_links) {
      incoming.custom_links = incoming.custom_links
        .filter((link) => link.name?.trim() && link.url?.trim())
        .map((link) => ({ name: link.name.trim(), url: link.url.trim() }))
        .slice(0, 5)
    }

    const supabase = await createAdminClient()

    // Fetch current settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: event, error: fetchError } = await (supabase as any)
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const currentSettings = (event.settings || {}) as Record<string, any>

    // Merge delegate_portal into settings, also sync whatsapp_group_url at top level for backwards compat
    const updatedSettings = {
      ...currentSettings,
      delegate_portal: { ...DEFAULTS, ...incoming },
      // Keep top-level whatsapp_group_url in sync for any other code reading it
      whatsapp_group_url: incoming.whatsapp_group_url ?? currentSettings.whatsapp_group_url ?? "",
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("events")
      .update({
        settings: updatedSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId)

    if (updateError) {
      console.error("Error updating delegate portal settings:", updateError)
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }

    return NextResponse.json({ success: true, delegate_portal: updatedSettings.delegate_portal })
  } catch (error: any) {
    console.error("Error in POST delegate-portal-settings:", error)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
