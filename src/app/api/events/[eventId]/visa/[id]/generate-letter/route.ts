import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { eventId, id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get visa request details
    const { data: visaRequest, error: fetchError } = await db
      .from("visa_requests")
      .select("*")
      .eq("id", id)
      .eq("event_id", eventId)
      .single()

    if (fetchError || !visaRequest) {
      return NextResponse.json({ error: "Visa request not found" }, { status: 404 })
    }

    // Get event details for the letter
    const { data: event } = await db
      .from("events")
      .select("name, short_name, start_date, end_date, city, venue, description")
      .eq("id", eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Generate HTML letter content
    const letterHtml = generateInvitationLetter(visaRequest, event)

    // Update the visa request status
    const { data, error: updateError } = await db
      .from("visa_requests")
      .update({
        letter_status: "generated",
        letter_generated_at: new Date().toISOString(),
        processed_by: user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating visa request:", updateError)
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      letterHtml,
      visaRequest: data,
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateInvitationLetter(visa: any, event: any): string {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const eventDates = `${new Date(event.start_date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })} to ${new Date(event.end_date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`

  return `
    <div style="font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 40px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0;">${event.name}</h2>
        <p style="margin: 5px 0;">${event.city || ""}</p>
        <p style="margin: 5px 0;">${eventDates}</p>
      </div>

      <p style="text-align: right;">${today}</p>

      <p><strong>INVITATION LETTER</strong></p>

      ${visa.embassy_country ? `<p>To: The Visa Officer<br/>Embassy/Consulate of India<br/>${visa.embassy_country}</p>` : ""}

      <p>Dear Sir/Madam,</p>

      <p>This is to certify that <strong>${visa.applicant_name}</strong>${visa.nationality ? `, a citizen of ${visa.nationality}` : ""}${visa.passport_number ? `, bearing passport number ${visa.passport_number}` : ""}, has been invited to attend the <strong>${event.name}</strong> being held ${event.venue ? `at ${event.venue}, ` : ""}${event.city ? `in ${event.city}, ` : ""}India from <strong>${eventDates}</strong>.</p>

      ${visa.travel_dates_from && visa.travel_dates_to ? `<p>The proposed travel dates are from ${new Date(visa.travel_dates_from).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} to ${new Date(visa.travel_dates_to).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.</p>` : ""}

      <p>We kindly request you to grant the necessary visa to enable the above-named person to attend this conference.</p>

      <p>We confirm that the participant will abide by the rules and regulations of India during the stay and will return to their home country after the completion of the conference.</p>

      <br/>
      <p>Yours faithfully,</p>
      <br/><br/>
      <p><strong>Organizing Committee</strong><br/>${event.name}</p>
    </div>
  `
}
