import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"
import { getAnthropicClient, isAIEnabled } from "@/lib/services/ai"

type SessionInput = {
  session_name: string
  session_date: string
  start_time: string
  end_time: string
  hall?: string | null
}

type ValidationIssue = {
  severity: "error" | "warning" | "info"
  session_name: string
  current_time: string
  suggested_time: string
  reason: string
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "bulk")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  const { error: authError } = await requireAdmin()
  if (authError) return authError

  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "AI features are not configured. Set ANTHROPIC_API_KEY to enable." },
      { status: 503 }
    )
  }

  try {
    const { sessions } = (await request.json()) as { sessions: SessionInput[] }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No sessions provided" }, { status: 400 })
    }

    // Build compact text representation (~30 tokens per session)
    const scheduleText = sessions
      .map((s, i) => {
        const hall = s.hall ? ` [${s.hall}]` : ""
        return `${i + 1}. ${s.session_date} ${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}${hall}: ${s.session_name}`
      })
      .join("\n")

    const client = getAnthropicClient()

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a medical conference schedule validator. Analyze this program schedule and identify issues.

Look for:
1. AM/PM confusion: sessions scheduled at unlikely times (e.g., Tea Break at 22:40 instead of 10:40, lectures at 23:00 instead of 11:00). Medical conferences typically run 07:00-20:00.
2. Time ordering: sessions that start before the previous one ends in the same hall
3. Duration anomalies: sessions shorter than 5 min or longer than 4 hours
4. Break placement: breaks at unusual times (lunch outside 12:00-14:00, tea outside 10:00-11:00 or 15:00-16:30)

Schedule:
${scheduleText}

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "issues": [
    {
      "severity": "error|warning|info",
      "session_name": "exact session name from input",
      "current_time": "HH:MM (current start time)",
      "suggested_time": "HH:MM (corrected start time)",
      "reason": "brief explanation"
    }
  ],
  "summary": "one-line summary of findings"
}

If no issues found, return: {"issues": [], "summary": "Schedule looks good - no issues detected."}`,
        },
      ],
    })

    // Extract text response
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { issues: [], summary: "Unable to parse AI response" },
        { status: 200 }
      )
    }

    // Parse JSON from response
    try {
      const result = JSON.parse(textBlock.text)
      return NextResponse.json(result)
    } catch {
      // Try extracting JSON from markdown code fence if present
      const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[1])
        return NextResponse.json(result)
      }
      return NextResponse.json(
        { issues: [], summary: "Could not parse validation results" },
        { status: 200 }
      )
    }
  } catch (error: any) {
    console.error("AI validation error:", error)
    return NextResponse.json(
      { error: "AI validation failed", details: error.message },
      { status: 500 }
    )
  }
}
