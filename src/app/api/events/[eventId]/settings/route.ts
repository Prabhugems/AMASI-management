import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"

// Map raw DB column names to human-readable labels
function humanizeField(field: string): string {
  const labels: Record<string, string> = {
    name: 'Event Name', short_name: 'Short Name', slug: 'URL Slug', description: 'Description',
    event_type: 'Event Type', status: 'Status', edition: 'Edition',
    organized_by: 'Organized By', scientific_chairman: 'Scientific Chairman', organizing_chairman: 'Organizing Chairman',
    signatory_title: 'Signatory Title', signature_image_url: 'Signature Image', settings: 'Settings',
    start_date: 'Start Date', end_date: 'End Date', timezone: 'Timezone', registration_deadline: 'Registration Deadline',
    venue_name: 'Venue Name', venue_address: 'Venue Address', city: 'City', state: 'State', country: 'Country', venue_map_url: 'Maps URL',
    is_public: 'Public Event', registration_open: 'Registration Open', max_attendees: 'Max Attendees',
    banner_url: 'Banner Image', logo_url: 'Logo', primary_color: 'Brand Color', favicon_url: 'Favicon',
    contact_email: 'Contact Email', contact_phone: 'Contact Phone', website_url: 'Website',
    social_twitter: 'Twitter', social_instagram: 'Instagram', social_linkedin: 'LinkedIn',
    seo_title: 'SEO Title', seo_description: 'SEO Description',
  }
  return labels[field] || field
}

// Map fields to their settings section for changelog
function inferSection(fields: string[]): string {
  const sectionMap: Record<string, string> = {
    name: 'general', short_name: 'general', slug: 'general', description: 'general',
    event_type: 'general', status: 'general', edition: 'general', organized_by: 'general',
    scientific_chairman: 'general', organizing_chairman: 'general',
    signatory_title: 'general', signature_image_url: 'general', settings: 'general',
    start_date: 'date', end_date: 'date', timezone: 'date', registration_deadline: 'date',
    venue_name: 'location', venue_address: 'location', city: 'location',
    state: 'location', country: 'location', venue_map_url: 'location',
    is_public: 'registration', registration_open: 'registration', max_attendees: 'registration',
    banner_url: 'branding', logo_url: 'branding', primary_color: 'branding', favicon_url: 'branding',
    contact_email: 'links', website_url: 'links', contact_phone: 'links',
    social_twitter: 'links', social_instagram: 'links', social_linkedin: 'links',
    seo_title: 'links', seo_description: 'links',
  }
  const sections = [...new Set(fields.map(f => sectionMap[f] || 'general'))]
  return sections.length === 1 ? sections[0] : sections.join(', ')
}

// PATCH /api/events/[eventId]/settings - Update event settings
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { user, error: authError } = await requireEventAndPermission(eventId, 'events')
    if (authError) return authError

    const body = await request.json()

    const supabase = await createAdminClient()

    // Build update object with only valid fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    const allowedFields = [
      'name', 'short_name', 'slug', 'description', 'event_type', 'status',
      'start_date', 'end_date', 'venue_name', 'city', 'state', 'country',
      'timezone', 'is_public', 'registration_open', 'max_attendees',
      'contact_email', 'website_url', 'banner_url', 'logo_url', 'primary_color',
      'edition', 'scientific_chairman', 'organizing_chairman',
      'organized_by', 'signatory_title', 'signature_image_url', 'settings',
      'registration_deadline', 'venue_address', 'venue_map_url', 'favicon_url',
      'contact_phone', 'social_twitter', 'social_instagram', 'social_linkedin',
      'seo_title', 'seo_description'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await (supabase as any)
      .from("events")
      .update(updateData)
      .eq("id", eventId)
      .select()
      .single()

    if (error) {
      console.error("Error updating event settings:", error)
      return NextResponse.json({ error: "Failed to update event settings" }, { status: 500 })
    }

    // Log the change to event_settings_log
    const changedFields = Object.keys(updateData).filter(k => k !== 'updated_at')
    if (changedFields.length > 0 && user) {
      await (supabase as any).from("event_settings_log").insert({
        event_id: eventId,
        changed_by: user.id,
        section: inferSection(changedFields),
        summary: `Updated ${changedFields.map(humanizeField).join(', ')}`,
        snapshot: updateData,
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Error in PATCH /api/events/[eventId]/settings:", error)
    return NextResponse.json({ error: "Failed to update event settings" }, { status: 500 })
  }
}
