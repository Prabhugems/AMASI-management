"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import {
  Calendar,
  Users,
  GraduationCap,
  Search,
  Plus,
  FileText,
  Home,
  HelpCircle,
  Loader2,
  LucideIcon,
} from "lucide-react"

interface CommandItem {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
  shortcut?: string
  onSelect: () => void
  keywords?: string[]
  group?: string
}

interface CommandPaletteProps {
  items?: CommandItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  placeholder?: string
}

function useGlobalSearch(query: string) {
  const [results, setResults] = React.useState<CommandItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const timer = setTimeout(async () => {
      // Cancel previous in-flight request
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const supabase = createClient()
        const pattern = `%${trimmed}%`

        type EventRow = { id: string; name: string | null; short_name: string | null; city: string | null; status: string | null }
        type FacultyRow = { id: string; name: string | null; email: string | null; designation: string | null; institution: string | null }
        type MemberRow = { id: string; name: string | null; email: string | null; membership_type: string | null; status: string | null }

        const [eventsRes, facultyRes, membersRes] = await Promise.all([
          supabase
            .from("events")
            .select("id, name, short_name, city, status")
            .or(`name.ilike.${pattern},short_name.ilike.${pattern},city.ilike.${pattern}`)
            .limit(5) as unknown as { data: EventRow[] | null },
          supabase
            .from("faculty")
            .select("id, name, email, designation, institution")
            .or(`name.ilike.${pattern},email.ilike.${pattern}`)
            .limit(5) as unknown as { data: FacultyRow[] | null },
          supabase
            .from("members")
            .select("id, name, email, membership_type, status")
            .or(`name.ilike.${pattern},email.ilike.${pattern}`)
            .limit(5) as unknown as { data: MemberRow[] | null },
        ])

        if (controller.signal.aborted) return

        const items: CommandItem[] = []

        if (eventsRes.data) {
          for (const e of eventsRes.data) {
            items.push({
              id: `event-${e.id}`,
              label: e.name || e.short_name || "Untitled Event",
              description: [e.city, e.status].filter(Boolean).join(" \u00b7 "),
              icon: Calendar,
              onSelect: () => router.push(`/events/${e.id}`),
              group: "Events",
            })
          }
        }

        if (facultyRes.data) {
          for (const f of facultyRes.data) {
            items.push({
              id: `faculty-${f.id}`,
              label: f.name || "Unknown Faculty",
              description: [f.designation, f.institution].filter(Boolean).join(", ") || f.email || "",
              icon: GraduationCap,
              onSelect: () => router.push(`/faculty?search=${encodeURIComponent(f.name || "")}`),
              group: "Faculty",
            })
          }
        }

        if (membersRes.data) {
          for (const m of membersRes.data) {
            items.push({
              id: `member-${m.id}`,
              label: m.name || "Unknown Member",
              description: [m.email, m.membership_type].filter(Boolean).join(" \u00b7 "),
              icon: Users,
              onSelect: () => router.push(`/members?search=${encodeURIComponent(m.name || "")}`),
              group: "Members",
            })
          }
        }

        setResults(items)
      } catch {
        // Silently handle errors (e.g. abort)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      setIsLoading(false)
    }
  }, [query, router])

  return { results, isLoading }
}

export function CommandPalette({
  items = [],
  open,
  onOpenChange,
  placeholder = "Type a command or search...",
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const actualOpen = open ?? isOpen
  const setActualOpen = onOpenChange ?? setIsOpen

  const { results: dbResults, isLoading } = useGlobalSearch(search)

  // Keyboard shortcut to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setActualOpen(!actualOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [actualOpen, setActualOpen])

  // Reset search when closing
  React.useEffect(() => {
    if (!actualOpen) {
      setSearch("")
    }
  }, [actualOpen])

  const handleSelect = (item: CommandItem) => {
    setActualOpen(false)
    item.onSelect()
  }

  // Filter static items by search
  const filteredStaticItems = React.useMemo(() => {
    if (!search.trim()) return items

    const searchLower = search.toLowerCase()
    return items.filter((item) => {
      if (item.label.toLowerCase().includes(searchLower)) return true
      if (item.keywords?.some((k) => k.toLowerCase().includes(searchLower))) return true
      return false
    })
  }, [items, search])

  // Combine: when no search, show static commands; when searching, show DB results + matching static commands
  const displayItems = search.trim().length >= 2
    ? [...dbResults, ...filteredStaticItems]
    : items

  // Group items
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const item of displayItems) {
      const group = item.group || "Actions"
      if (!groups[group]) groups[group] = []
      groups[group].push(item)
    }
    return groups
  }, [displayItems])

  return (
    <Dialog open={actualOpen} onOpenChange={setActualOpen}>
      <DialogContent className="p-0 max-w-lg overflow-hidden">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 h-12"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin ml-2" />
          )}
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {displayItems.length === 0 && !isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No results found.
            </p>
          ) : displayItems.length === 0 && isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Searching...
            </p>
          ) : (
            Object.entries(groupedItems).map(([group, groupItems]) => (
              <div key={group} className="mb-2">
                <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                  {group}
                </p>
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md",
                      "hover:bg-accent transition-colors text-left"
                    )}
                  >
                    {item.icon && <item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{item.label}</span>
                      {item.description && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Default command items for the app
 */
export function useDefaultCommands(): CommandItem[] {
  const router = useRouter()

  return React.useMemo(
    () => [
      // Navigation
      {
        id: "home",
        label: "Go to Dashboard",
        icon: Home,
        shortcut: "⌘H",
        onSelect: () => router.push("/"),
        keywords: ["home", "dashboard"],
        group: "Navigation",
      },
      {
        id: "events",
        label: "Go to Events",
        icon: Calendar,
        onSelect: () => router.push("/events"),
        keywords: ["events", "conferences"],
        group: "Navigation",
      },
      {
        id: "members",
        label: "Go to Members",
        icon: Users,
        onSelect: () => router.push("/members"),
        keywords: ["members", "faculty"],
        group: "Navigation",
      },
      // Actions
      {
        id: "new-event",
        label: "Create New Event",
        icon: Plus,
        shortcut: "⌘N",
        onSelect: () => router.push("/events/new"),
        keywords: ["create", "new", "event"],
        group: "Actions",
      },

      // Help
      {
        id: "docs",
        label: "Documentation",
        icon: FileText,
        onSelect: () => window.open("/docs", "_blank"),
        keywords: ["help", "docs", "documentation"],
        group: "Help",
      },
      {
        id: "support",
        label: "Get Support",
        icon: HelpCircle,
        onSelect: () => window.open("mailto:support@example.com"),
        keywords: ["help", "support", "contact"],
        group: "Help",
      },
    ],
    [router]
  )
}

/**
 * Command palette with default commands and live search
 */
export function AppCommandPalette({
  additionalItems = [],
  open,
  onOpenChange,
}: {
  additionalItems?: CommandItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const defaultCommands = useDefaultCommands()
  const allItems = [...defaultCommands, ...additionalItems]

  return <CommandPalette items={allItems} open={open} onOpenChange={onOpenChange} />
}
