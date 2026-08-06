import { getTenant, selectEventsForTenant } from "@/lib/tenant"
import { createAdminClient } from "@/lib/supabase/server"
import { TechnoSurgLandingPage } from "./technosurg-landing"
import { TamilconLandingPage } from "./tamilcon-landing"

async function getTamilconTickets() {
  const supabase = await createAdminClient()
  const { data: event, error: eventError } = await selectEventsForTenant(supabase, "id")
    .eq("slug", "tamilcon-2026")
    .maybeSingle()
  if (eventError) console.error("[landing] event lookup failed", eventError)
  if (!event) return []
  const { data: tickets, error } = await (supabase as any)
    .from("ticket_types")
    .select("id, name, price")
    .eq("event_id", event.id)
    .eq("status", "active")
    .eq("is_hidden", false)
    .order("sort_order", { ascending: true })
    .order("price", { ascending: true })
  if (error) console.error("[landing] ticket_types fetch failed", error)
  return tickets || []
}

export default async function LandingPage() {
  const tenant = getTenant()
  if (tenant === "cos") {
    const tickets = await getTamilconTickets()
    return <TamilconLandingPage tickets={tickets} />
  }
  return <TechnoSurgLandingPage />
}
