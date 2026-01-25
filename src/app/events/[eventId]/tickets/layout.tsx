"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  Ticket,
  Settings,
  BookOpen,
  ChevronLeft,
  Loader2,
  Calendar,
  MapPin,
} from "lucide-react"

const sidebarItems = [
  { title: "Manage Tickets", href: "", icon: Ticket, description: "Create and manage ticket types" },
  { title: "Settings", href: "/settings", icon: Settings, description: "Ticket settings & defaults" },
  { title: "Instructions", href: "/instructions", icon: BookOpen, description: "How to use tickets" },
]

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/tickets`
  const supabase = createClient()

  type EventType = { id: string; name: string; short_name: string | null; start_date: string | null; city: string | null }
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name, start_date, city")
        .eq("id", eventId)
        .single()
      return data as EventType | null
    },
  })

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") return pathname === basePath
    return pathname.startsWith(fullPath)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ""
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Inner Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        {/* Back Link */}
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Event
        </Link>

        {/* Section Header */}
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Tickets</h2>
              <p className="text-xs text-muted-foreground">Manage ticket types</p>
            </div>
          </div>
          {/* Event Info */}
          {event && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-sm font-medium text-foreground truncate">{event.short_name || event.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {event.start_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(event.start_date)}
                  </span>
                )}
                {event.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.city}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {eventLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            sidebarItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={`${basePath}${item.href}`}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", active ? "text-primary-foreground" : "")} />
                  <div>
                    <span className="font-medium">{item.title}</span>
                    <p className={cn(
                      "text-xs mt-0.5",
                      active ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {item.description}
                    </p>
                  </div>
                </Link>
              )
            })
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t">
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Create multiple ticket types with different prices and availability windows for early bird discounts.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
