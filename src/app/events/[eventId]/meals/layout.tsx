"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { UtensilsCrossed, BookOpen } from "lucide-react"

const navItems = [
  { href: "", label: "Meals", icon: UtensilsCrossed },
  { href: "/instructions", label: "Instructions", icon: BookOpen },
]

export default function MealsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const eventId = params.eventId as string
  const basePath = `/events/${eventId}/meals`

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-6rem)] -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Desktop: vertical sidebar */}
      <div className="hidden lg:flex w-52 border-r bg-muted/30 p-4 flex-col flex-shrink-0">
        <div className="mb-4">
          <h2 className="font-semibold text-sm">Meals</h2>
          <p className="text-xs text-muted-foreground">Meal management</p>
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
      {/* Mobile: horizontal scrollable tabs */}
      <div className="lg:hidden border-b bg-muted/30 overflow-x-auto flex-shrink-0">
        <nav className="flex items-center gap-1 p-2 min-w-max">
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
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
