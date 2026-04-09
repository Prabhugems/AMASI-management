"use client"

import { useState } from "react"
import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ShoppingCart,
} from "lucide-react"

const sidebarItems = [
  { title: "All Orders", href: "", icon: LayoutDashboard },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Orders & Payments Guide", href: "/instructions", icon: BookOpen },
]

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Desktop: vertical sidebar */}
      <div className="hidden lg:flex w-56 border-r bg-muted/30 flex-col flex-shrink-0">
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
      {/* Mobile: sticky bar + bottom sheet */}
      {(() => {
        const activeItem = sidebarItems.find((item) => isActive(item.href)) || sidebarItems[0]
        const ActiveIcon = activeItem.icon
        return (
          <>
            <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{activeItem.title}</span>
              </div>
              <button onClick={() => setMobileNavOpen(true)} className="p-1">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
            {mobileNavOpen && (
              <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileNavOpen(false)} />
            )}
            <div className={cn(
              "lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto transition-transform duration-300",
              mobileNavOpen ? "translate-y-0" : "translate-y-full"
            )}>
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto my-3" />
              <div className="px-4 pb-2 font-semibold text-lg border-b">Orders</div>
              <nav className="p-2 space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={`${basePath}${item.href}`}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-colors",
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
          </>
        )
      })()}
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}
