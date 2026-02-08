"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Calendar,
  Users,
  Search,
  Plus,
  FileText,
  Home,
  HelpCircle,
  LucideIcon,
} from "lucide-react"

interface CommandItem {
  id: string
  label: string
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

/**
 * Command Palette Component
 *
 * Quick actions search (Cmd+K)
 *
 * Usage:
 * ```
 * <CommandPalette
 *   items={[
 *     { id: "home", label: "Go Home", icon: Home, onSelect: () => router.push("/") },
 *     { id: "new-event", label: "Create Event", icon: Plus, onSelect: () => ... },
 *   ]}
 * />
 * ```
 */
export function CommandPalette({
  items = [],
  open,
  onOpenChange,
  placeholder = "Type a command or search...",
}: CommandPaletteProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const router = useRouter()

  const actualOpen = open ?? isOpen
  const setActualOpen = onOpenChange ?? setIsOpen

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

  // Filter items by search
  const filteredItems = React.useMemo(() => {
    if (!search.trim()) return items

    const searchLower = search.toLowerCase()
    return items.filter((item) => {
      if (item.label.toLowerCase().includes(searchLower)) return true
      if (item.keywords?.some((k) => k.toLowerCase().includes(searchLower))) return true
      return false
    })
  }, [items, search])

  // Group items
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    for (const item of filteredItems) {
      const group = item.group || "Actions"
      if (!groups[group]) groups[group] = []
      groups[group].push(item)
    }
    return groups
  }, [filteredItems])

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
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No results found.
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
                    {item.icon && <item.icon className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
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
      {
        id: "search",
        label: "Search Everything",
        icon: Search,
        shortcut: "⌘F",
        onSelect: () => router.push("/search"),
        keywords: ["search", "find"],
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
 * Command palette with default commands
 */
export function AppCommandPalette({
  additionalItems = [],
}: {
  additionalItems?: CommandItem[]
}) {
  const defaultCommands = useDefaultCommands()
  const allItems = [...defaultCommands, ...additionalItems]

  return <CommandPalette items={allItems} />
}

/**
 * Command palette trigger button
 */
export function CommandPaletteTrigger({
  className,
}: {
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const defaultCommands = useDefaultCommands()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm rounded-md border",
          "hover:bg-accent transition-colors",
          className
        )}
      >
        <Search className="h-4 w-4" />
        <span className="text-muted-foreground">Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandPalette
        items={defaultCommands}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
