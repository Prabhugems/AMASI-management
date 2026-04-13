import { getApiUser } from "@/lib/auth/api-auth"
import { syncAddressesFromFillout } from "@/lib/services/fillout-sync"
import { NextRequest, NextResponse } from "next/server"

// POST /api/examination/sync-addresses - Sync addresses from Fillout API
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

    const result = await syncAddressesFromFillout({
      eventId: event_id,
      includeExtraFields: true,
    })

    return NextResponse.json({
      synced: result.synced,
      alreadyHas: result.alreadyHas,
      notFilled: result.notFilled,
      totalRegistrations: result.synced + result.alreadyHas + result.notFilled,
      totalSubmissions: result.totalSubmissions,
    })
  } catch (error: any) {
    console.error("Error syncing addresses:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
