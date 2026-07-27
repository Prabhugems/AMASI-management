import { getTenant, selectEventsForTenant } from "@/lib/tenant"
import { createAdminClient } from "@/lib/supabase/server"
import { TechnoSurgLandingPage } from "./technosurg-landing"
import { TamilconLandingPage } from "./tamilcon-landing"

async function getTamilconTickets() {
  const supabase = await createAdminClient()
  const { data: event } = await selectEventsForTenant(supabase, "id").limit(1).single()
  if (!event) return []
  const { data: tickets } = await (supabase as any)
    .from("ticket_types")
    .select("id, name, price")
    .eq("event_id", event.id)
    .eq("status", "active")
    .order("price", { ascending: true })
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
