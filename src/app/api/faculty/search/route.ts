import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getApiUser } from "@/lib/auth/api-auth"

// Type-ahead for the Session Builder's faculty column.
//
// 1,960 faculty rows: too many to ship to the browser and filter there, so the
// search runs server-side and returns a short list. Deliberately narrow — id,
// name, and just enough context to tell two people apart — because this feeds a
// picker, not a directory, and the directory already exists elsewhere.
//
// Telling people apart matters here: the live table holds eight Srivastavas,
// and both "P. Senthilnathan" and "Senthilnathan P". City and institution are
// what make the right row obvious.

export async function GET(request: NextRequest) {
  const { user, error: authError } = await getApiUser()
  if (!user) return authError ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim()

  // Two characters is where the result set stops being the whole directory.
  if (q.length < 2) return NextResponse.json({ data: [] })

  // Escape PostgREST's pattern metacharacters. Without this a name containing
  // % or _ silently matches far more than the typist intended.
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`

  const supabase = (await createAdminClient()) as any
  const { data, error } = await supabase
    .from("faculty")
    .select("id, name, email, city, institution, designation")
    .or(`name.ilike.${pattern},email.ilike.${pattern},institution.ilike.${pattern}`)
    .order("name")
    .limit(12)

  if (error) {
    console.error("faculty search error", error)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }

  return NextResponse.json({
    data: (data ?? []).map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      email: f.email,
      // One line of context under the name. Institution is set on only 122 of
      // 1,960 rows and city on 609, so fall back rather than showing a gap.
      meta: [f.designation, f.institution, f.city].filter(Boolean).join(" · ") || null,
    })),
  })
}
