import { getApiUser } from "@/lib/auth/api-auth"
import { syncAddressesFromFillout, syncAddressesFromAirtable } from "@/lib/services/fillout-sync"
import { NextRequest, NextResponse } from "next/server"

// POST /api/examination/sync-addresses - Sync addresses from Fillout + Airtable
export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { event_id } = await request.json()
    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    let totalSynced = 0
    let totalAlreadyHas = 0
    let totalNotFilled = 0
    let totalSubmissions = 0

    // Try Fillout sync
    try {
      const filloutResult = await syncAddressesFromFillout({
        eventId: event_id,
        includeExtraFields: true,
      })
      totalSynced += filloutResult.synced
      totalAlreadyHas += filloutResult.alreadyHas
      totalNotFilled = filloutResult.notFilled
      totalSubmissions += filloutResult.totalSubmissions
    } catch (e) {
      console.log("[sync-addresses] Fillout sync skipped:", (e as Error).message)
    }

    // Try Airtable sync (for events using Airtable forms)
    try {
      const airtableResult = await syncAddressesFromAirtable({ eventId: event_id })
      totalSynced += airtableResult.synced
      totalAlreadyHas += airtableResult.alreadyHas
      // Update notFilled to reflect remaining after both syncs
      totalNotFilled = Math.max(0, totalNotFilled - airtableResult.synced)
      totalSubmissions += airtableResult.totalSubmissions
    } catch (e) {
      console.log("[sync-addresses] Airtable sync skipped:", (e as Error).message)
    }

    return NextResponse.json({
      synced: totalSynced,
      alreadyHas: totalAlreadyHas,
      notFilled: totalNotFilled,
      totalRegistrations: totalSynced + totalAlreadyHas + totalNotFilled,
      totalSubmissions,
    })
  } catch (error: any) {
    console.error("Error syncing addresses:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
