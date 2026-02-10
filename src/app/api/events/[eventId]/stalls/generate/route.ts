import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params
  const supabase = await createAdminClient()

  const body = await request.json()
  const {
    count = 50,
    columns = 10,
    size = "3x3",
    location = "Exhibition Hall",
    prefix = "",
    startNum = 1,
    spacing = 16,
  } = body

  // Calculate grid
  const rows = Math.ceil(count / columns)
  const stallWidth = 100 // 3x3 = 100px
  const stallHeight = 80

  const stalls = []

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns)
    const col = i % columns
    const num = startNum + i

    // Format stall number
    const stallNumber = prefix ? `${prefix}${num}` : `${num}`

    // Calculate position (in grid units, 20px per unit)
    const posX = Math.round((60 + col * (stallWidth + spacing)) / 20)
    const posY = Math.round((100 + row * (stallHeight + spacing)) / 20)

    stalls.push({
      event_id: eventId,
      stall_number: stallNumber,
      size,
      location,
      status: "available",
      position_x: posX,
      position_y: posY,
    })
  }

  // Insert all stalls
  const { data, error } = await (supabase as any)
    .from("stalls")
    .insert(stalls)
    .select()

  if (error) {
    return NextResponse.json({ error: "Failed to generate stalls" }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    count: stalls.length,
    layout: `${columns} x ${rows}`,
    stalls: data
  })
}
