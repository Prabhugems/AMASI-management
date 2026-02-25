"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Receipt, BookOpen } from "lucide-react"

const navItems = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/instructions", label: "Instructions", icon: BookOpen },
]

export default function BudgetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/budget`

  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Sidebar */}
      <div className="w-52 border-r bg-muted/30 p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-sm">Budget</h2>
          <p className="text-xs text-muted-foreground">Financial management</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const href = `${basePath}${item.href}`
            const isActive = item.href === ""
              ? pathname === basePath
              : pathname.startsWith(href)

            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}
