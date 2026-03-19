"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  FileSpreadsheet,
  Trophy,
  GraduationCap,
  MapPin,
  ChevronLeft,
  Settings,
  ClipboardList,
} from "lucide-react"

const sidebarItems = [
  { title: "Attendance", href: "/attendance", icon: ClipboardList },
  { title: "Marksheet", href: "", icon: FileSpreadsheet },
  { title: "Results", href: "/results", icon: Trophy },
  { title: "Convocation", href: "/convocation", icon: GraduationCap },
  { title: "Address Collection", href: "/address", icon: MapPin },
  { title: "Settings", href: "/settings", icon: Settings },
]

export default function ExaminationLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/examination`
  const supabase = createClient()

  // Check if examination module is enabled
  const { data: moduleSettings, isLoading: moduleLoading } = useQuery({
    queryKey: ["event-module-settings", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_settings")
        .select("enable_examination")
        .eq("event_id", eventId)
        .maybeSingle()
      return data as { enable_examination: boolean } | null
    },
  })

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") return pathname === basePath
    return pathname.startsWith(fullPath)
  }

  // Check if module is enabled
  if (!moduleLoading && !moduleSettings?.enable_examination) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <div className="text-center max-w-md">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Examination Module Not Enabled</h2>
          <p className="text-muted-foreground mb-4">
            The Examination module is not enabled for this event.
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Go to Event Settings &rarr; Modules to enable examinations.
          </p>
          <Link href={`/events/${eventId}/settings`} className="text-primary hover:underline">
            &rarr; Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <Link href={`/events/${eventId}`} className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b">
          <ChevronLeft className="h-4 w-4" />Back to Event
        </Link>
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-lg">Examination</h2>
          <p className="text-xs text-muted-foreground">FMAS / MMAS Exam Management</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={`${basePath}${item.href}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
