"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { UtensilsCrossed, BookOpen, ChevronDown } from "lucide-react"

const navItems = [
  { href: "", label: "Meals", icon: UtensilsCrossed },
  { href: "/instructions", label: "Instructions", icon: BookOpen },
]

export default function MealsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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
      {/* Mobile: sticky bar + bottom sheet */}
      {(() => {
        const activeItem = navItems.find((item) => {
          const href = `${basePath}${item.href}`
          return item.href === "" ? pathname === basePath : pathname.startsWith(href)
        }) || navItems[0]
        const ActiveIcon = activeItem.icon
        return (
          <>
            <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ActiveIcon className="h-4 w-4" />
                <span className="text-sm font-medium">{activeItem.label}</span>
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
              <div className="px-4 pb-2 font-semibold text-lg border-b">Meals</div>
              <nav className="p-2 space-y-1">
                {navItems.map((item) => {
                  const href = `${basePath}${item.href}`
                  const isActive = item.href === "" ? pathname === basePath : pathname.startsWith(href)
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      onClick={() => setMobileNavOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-sm rounded-md transition-colors",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>
          </>
        )
      })()}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
