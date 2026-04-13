import { getApiUser } from "@/lib/auth/api-auth"
import { NextResponse } from "next/server"

const FILLOUT_API_KEY = (process.env.FILLOUT_API_KEY || "").trim()
const FILLOUT_FORM_ID = "gz1eLocmB9us"

// GET /api/examination/debug-fillout — Temporary debug endpoint
export async function GET() {
  try {
    const user = await getApiUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!FILLOUT_API_KEY) {
      return NextResponse.json({ error: "FILLOUT_API_KEY not configured" })
    }

    const res = await fetch(
      `https://api.fillout.com/v1/api/forms/${FILLOUT_FORM_ID}/submissions?limit=3&offset=0`,
      { headers: { Authorization: `Bearer ${FILLOUT_API_KEY}` } }
    )

    const raw = await res.json()

    // Return: total count, first 3 submissions with their urlParameters structure
    return NextResponse.json({
      status: res.status,
      totalResponses: raw.totalResponses,
      pageCount: raw.pageCount,
      responseCount: raw.responses?.length,
      // Show the URL parameters structure from first 3 submissions
      samples: (raw.responses || []).slice(0, 3).map((sub: any) => ({
        submissionId: sub.submissionId,
        urlParameters: sub.urlParameters,
        // Show first 2 questions for structure reference
        questionSample: (sub.questions || []).slice(0, 2).map((q: any) => ({
          name: q.name,
          id: q.id,
          type: q.type,
          value: q.value,
        })),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
