import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"
import {
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_VALUES,
  ROLE_CONFIG,
} from "@/lib/team-constants"

/**
 * GET /api/events/[eventId]/team/handover-pack
 * Generate an HTML team handover pack that can be printed to PDF from the browser.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { eventId } = await params
  const supabaseClient = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = supabaseClient as any

  // 1. Fetch event details
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, short_name, start_date, end_date, venue_name, city")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  // 2. Fetch team members assigned to this event OR with all-events access (empty event_ids)
  const { data: allMembers } = await supabase
    .from("team_members")
    .select("id, email, name, phone, role, permissions, event_ids, is_active, notes, created_at")
    .eq("is_active", true)
    .order("name", { ascending: true })

  const teamMembers = (allMembers || []).filter((m: any) => {
    const ids = m.event_ids as string[] | null
    // Empty/null event_ids means all-events access
    if (!ids || ids.length === 0) return true
    return ids.includes(eventId)
  })

  // 3. Fetch login activity from users table
  const emails = teamMembers.map((m: any) => (m.email || "").toLowerCase())
  let userMap = new Map<string, any>()
  if (emails.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("email, last_login_at, last_active_at")
      .in("email", emails)
    if (users) {
      userMap = new Map(users.map((u: any) => [u.email?.toLowerCase(), u]))
    }
  }

  // 4. Build table rows
  const rows = teamMembers.map((m: any) => {
    const roleConfig = ROLE_CONFIG[m.role] || { label: m.role }
    const perms = m.permissions as string[] | null
    const hasFullAccess = m.role === "admin" || !perms || perms.length === 0

    // Resolve permission labels
    let modulesList = "Full Access"
    if (!hasFullAccess && perms && perms.length > 0) {
      const labels = perms.map((pv: string) => {
        for (const cat of PERMISSION_CATEGORIES) {
          const found = cat.permissions.find((p) => p.value === pv)
          if (found) return found.label
        }
        return pv
      })
      modulesList = labels.join(", ")
    }

    const user = userMap.get((m.email || "").toLowerCase())
    const lastLogin = user?.last_login_at
      ? new Date(user.last_login_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Never"

    const scope = (() => {
      const ids = m.event_ids as string[] | null
      if (!ids || ids.length === 0) return "All Events"
      return "This Event"
    })()

    return `<tr>
      <td>${escHtml(m.name)}</td>
      <td>${escHtml(roleConfig.label)}</td>
      <td>${escHtml(m.phone || "-")}</td>
      <td>${escHtml(m.email)}</td>
      <td>${escHtml(modulesList)}</td>
      <td>${escHtml(scope)}</td>
      <td>${escHtml(lastLogin)}</td>
    </tr>`
  }).join("\n")

  // 5. Coverage gap analysis
  const coveredPermissions = new Set<string>()
  for (const m of teamMembers) {
    const perms = (m as any).permissions as string[] | null
    const hasFullAccess = (m as any).role === "admin" || !perms || perms.length === 0
    if (hasFullAccess) {
      // Full access covers everything
      ALL_PERMISSION_VALUES.forEach((p) => coveredPermissions.add(p))
      break
    }
    if (perms) {
      perms.forEach((p: string) => coveredPermissions.add(p))
    }
  }

  const gaps: string[] = []
  for (const cat of PERMISSION_CATEGORIES) {
    for (const perm of cat.permissions) {
      if (!coveredPermissions.has(perm.value)) {
        gaps.push(`${cat.label} &rarr; ${perm.label}`)
      }
    }
  }

  const gapsHtml = gaps.length === 0
    ? "<li style=\"color:#16a34a;\">All modules are covered - no gaps found.</li>"
    : gaps.map((g) => `<li>${g}</li>`).join("\n")

  // 6. Format dates
  const eventDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "TBD"

  const eventEndDate = event.end_date
    ? new Date(event.end_date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null

  const dateRange = eventEndDate && eventEndDate !== eventDate
    ? `${eventDate} - ${eventEndDate}`
    : eventDate

  const venue = [event.venue_name, event.city].filter(Boolean).join(", ") || "TBD"
  const eventName = event.short_name || event.name
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })

  // 7. Build HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Team Handover Pack - ${escHtml(eventName)}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      @page { margin: 15mm; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1a1a1a;
      line-height: 1.5;
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      background: #fff;
    }
    .no-print {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .no-print button {
      background: #0284c7;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    .no-print button:hover { background: #0369a1; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
    h2 {
      font-size: 16px;
      margin: 32px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e5e7eb;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-bottom: 16px;
    }
    th {
      background: #f9fafb;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #e5e7eb;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #4b5563;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f9fafb; }
    .gaps-list { padding-left: 20px; }
    .gaps-list li { margin-bottom: 4px; font-size: 14px; }
    .stats {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .stat-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 20px;
      min-width: 140px;
    }
    .stat-box .num { font-size: 24px; font-weight: 700; }
    .stat-box .lbl { font-size: 12px; color: #6b7280; }
    footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <span>Use <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to save as PDF</span>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <h1>${escHtml(eventName)} - Team Handover Pack</h1>
  <p class="subtitle">
    Date: ${escHtml(dateRange)} &nbsp;|&nbsp; Venue: ${escHtml(venue)} &nbsp;|&nbsp; Generated: ${escHtml(generatedAt)}
  </p>

  <div class="stats">
    <div class="stat-box">
      <div class="num">${teamMembers.length}</div>
      <div class="lbl">Team Members</div>
    </div>
    <div class="stat-box">
      <div class="num">${teamMembers.filter((m: any) => m.role === "admin").length}</div>
      <div class="lbl">Admins</div>
    </div>
    <div class="stat-box">
      <div class="num">${teamMembers.filter((m: any) => m.role !== "admin").length}</div>
      <div class="lbl">Coordinators</div>
    </div>
    <div class="stat-box">
      <div class="num" style="color:${gaps.length === 0 ? "#16a34a" : "#dc2626"}">${gaps.length}</div>
      <div class="lbl">Coverage Gaps</div>
    </div>
  </div>

  <h2>Team Roster</h2>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Role</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Modules</th>
        <th>Scope</th>
        <th>Last Login</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;">No team members assigned</td></tr>'}
    </tbody>
  </table>

  <h2>Coverage Gaps</h2>
  <p style="font-size:14px;color:#6b7280;">Modules with no assigned team member (across ${ALL_PERMISSION_VALUES.length} total modules):</p>
  <ul class="gaps-list">
    ${gapsHtml}
  </ul>

  <h2>Permission Categories Reference</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Modules</th>
        <th>Covered?</th>
      </tr>
    </thead>
    <tbody>
      ${PERMISSION_CATEGORIES.map((cat) => {
        const catPerms = cat.permissions.map((p) => p.value)
        const covered = catPerms.filter((p) => coveredPermissions.has(p))
        const allCovered = covered.length === catPerms.length
        return `<tr>
          <td><strong>${escHtml(cat.label)}</strong></td>
          <td>${cat.permissions.map((p) => escHtml(p.label)).join(", ")}</td>
          <td style="color:${allCovered ? "#16a34a" : "#dc2626"};font-weight:600;">
            ${covered.length}/${catPerms.length} ${allCovered ? "&#10003;" : "&#9888;"}
          </td>
        </tr>`
      }).join("\n")}
    </tbody>
  </table>

  <footer>
    Generated by AMASI Portal &middot; ${escHtml(generatedAt)}
  </footer>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": "inline",
    },
  })
}

/** Escape HTML special characters */
function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
