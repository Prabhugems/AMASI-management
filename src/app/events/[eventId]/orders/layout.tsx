"use client"

import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  ChevronLeft,
  ShoppingCart,
} from "lucide-react"

const sidebarItems = [
  { title: "All Orders", href: "", icon: LayoutDashboard },
  { title: "Reports", href: "/reports", icon: BarChart3 },
]

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/orders`

  const isActive = (href: string) => {
    const fullPath = `${basePath}${href}`
    if (href === "") return pathname === basePath
    return pathname.startsWith(fullPath)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <Link
          href={`/events/${eventId}`}
          className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground border-b"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Event
        </Link>
        <div className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold text-lg">Orders</h2>
              <p className="text-xs text-muted-foreground">Payments & receipts</p>
            </div>
          </div>
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
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}
