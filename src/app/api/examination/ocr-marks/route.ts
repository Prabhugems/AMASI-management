import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { createAdminClient } from "@/lib/supabase/server"
import { getAnthropicClient, isAIEnabled } from "@/lib/services/ai"

export const runtime = "nodejs"
export const maxDuration = 60

type MarkColumn = { key: string; label: string; max: number }

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI not configured. Set ANTHROPIC_API_KEY to enable OCR." },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const eventId = formData.get("event_id") as string | null
    const files = formData.getAll("images") as File[]

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }
    if (!files.length) {
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 })
    }
    if (files.length > 8) {
      return NextResponse.json({ error: "Maximum 8 images per request" }, { status: 400 })
    }

    // Load exam settings for this event
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: eventData } = await db
      .from("events")
      .select("settings")
      .eq("id", eventId)
      .maybeSingle()

    const examSettings = eventData?.settings?.examination
    const markColumns: MarkColumn[] = examSettings?.mark_columns || []
    if (!markColumns.length) {
      return NextResponse.json(
        { error: "Exam settings not configured for this event" },
        { status: 400 }
      )
    }

    // Convert each file to base64 image block
    const imageBlocks = await Promise.all(
      files.map(async (file) => {
        const buf = Buffer.from(await file.arrayBuffer())
        const mediaType = file.type || "image/jpeg"
        if (buf.length > 5 * 1024 * 1024) {
          throw new Error(`Image ${file.name} exceeds 5 MB`)
        }
        return {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: buf.toString("base64"),
          },
        }
      })
    )

    const columnDesc = markColumns
      .map((c) => `  - "${c.key}" (label "${c.label}", integer 0..${c.max})`)
      .join("\n")

    const prompt = `You are extracting handwritten marks from a scoring sheet table photograph.

The table contains these columns in order:
- # (row number)
- Reg No (registration number, e.g. "124A1001")
- Name
${markColumns.map((c) => `- ${c.label} (max ${c.max})`).join("\n")}
- Remarks (may be blank, or contain "ABSENT", "EXEMPTED", or other notes)

For EVERY row visible in the image(s), extract:
- "reg_no": the registration number string EXACTLY as printed
- "name": the candidate name
- "marks": a JSON object mapping each mark column key to an integer or null:
${columnDesc}
- "status": one of "marked" (has marks), "absent" (Remarks says ABSENT), "exempted" (Remarks says EXEMPTED), or "blank" (no marks, no remarks)
- "remarks": the remarks text if any, otherwise null
- "confidence": "high" if all digits are clearly legible, "low" if any digit was hard to read

Rules:
- Each mark must be an integer within 0 and the column max. Cap if needed.
- Do NOT skip any visible row. Return blank rows with status "blank" and marks set to null.
- If the photograph contains multiple pages, include rows from all pages in one combined list.
- Output ONLY a valid JSON object, no markdown, no code fences, no commentary.

Output schema:
{"rows":[{"reg_no":"124A1001","name":"...","marks":{${markColumns.map((c) => `"${c.key}":7`).join(",")}},"status":"marked","remarks":null,"confidence":"high"}]}`

    const client = getAnthropicClient()
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: prompt },
          ],
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI returned no text response" }, { status: 500 })
    }

    // Parse JSON (strip code fences just in case)
    let parsed: { rows: unknown[] }
    const raw = textBlock.text.trim()
    try {
      parsed = JSON.parse(raw)
    } catch {
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (!fence) {
        return NextResponse.json(
          { error: "AI returned non-JSON response", raw },
          { status: 500 }
        )
      }
      parsed = JSON.parse(fence[1])
    }

    return NextResponse.json({
      rows: parsed.rows || [],
      mark_columns: markColumns,
      pass_marks: examSettings?.pass_marks ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR failed"
    console.error("OCR marks error:", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
