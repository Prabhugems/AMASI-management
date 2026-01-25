"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useKeyboardShortcut, formatShortcut } from "@/hooks/use-keyboard-shortcut"

interface Shortcut {
  key: string
  description: string
  category?: string
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
}

interface KeyboardShortcutsProps {
  shortcuts: Shortcut[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  triggerKey?: string
}

/**
 * Keyboard Shortcuts Dialog
 *
 * Display available keyboard shortcuts
 *
 * Usage:
 * ```
 * <KeyboardShortcutsDialog
 *   shortcuts={[
 *     { key: "s", meta: true, description: "Save", category: "General" },
 *     { key: "k", meta: true, description: "Open command palette", category: "Navigation" },
 *   ]}
 * />
 * ```
 */
export function KeyboardShortcutsDialog({
  shortcuts,
  open,
  onOpenChange,
  triggerKey = "?",
}: KeyboardShortcutsProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const actualOpen = open ?? isOpen
  const setActualOpen = onOpenChange ?? setIsOpen

  // Open with ? key
  useKeyboardShortcut(
    triggerKey,
    () => setActualOpen(true),
    { shift: triggerKey === "?" }
  )

  // Group shortcuts by category
  const groupedShortcuts = React.useMemo(() => {
    const groups: Record<string, Shortcut[]> = {}
    for (const shortcut of shortcuts) {
      const category = shortcut.category || "General"
      if (!groups[category]) groups[category] = []
      groups[category].push(shortcut)
    }
    return groups
  }, [shortcuts])

  return (
    <Dialog open={actualOpen} onOpenChange={setActualOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                {category}
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <KeyboardKey shortcut={shortcut} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd> to
          toggle this dialog
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Single keyboard key display
 */
export function KeyboardKey({
  shortcut,
  className,
}: {
  shortcut: Shortcut
  className?: string
}) {
  const keys = formatShortcut(shortcut.key, shortcut).split(/(?=[⌘⌃⌥⇧])|(?<=.)(?=.)/g)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {keys.map((key, index) => (
        <kbd
          key={index}
          className="px-2 py-1 text-xs font-mono bg-muted border rounded shadow-sm min-w-[24px] text-center"
        >
          {key}
        </kbd>
      ))}
    </div>
  )
}

/**
 * Inline keyboard shortcut hint
 */
export function ShortcutHint({
  keys,
  className,
}: {
  keys: string
  className?: string
}) {
  return (
    <kbd
      className={cn(
        "ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1",
        "rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {keys}
    </kbd>
  )
}

/**
 * Keyboard shortcuts provider with common defaults
 */
export function KeyboardShortcutsProvider({
  children,
  shortcuts = [],
}: {
  children: React.ReactNode
  shortcuts?: Shortcut[]
}) {
  const defaultShortcuts: Shortcut[] = [
    { key: "k", meta: true, description: "Open command palette", category: "Navigation" },
    { key: "/", description: "Focus search", category: "Navigation" },
    { key: "Escape", description: "Close dialog / Clear selection", category: "General" },
    { key: "?", shift: true, description: "Show keyboard shortcuts", category: "Help" },
    ...shortcuts,
  ]

  return (
    <>
      {children}
      <KeyboardShortcutsDialog shortcuts={defaultShortcuts} />
    </>
  )
}

/**
 * Default app shortcuts
 */
export const defaultAppShortcuts: Shortcut[] = [
  // Navigation
  { key: "h", meta: true, description: "Go to Home", category: "Navigation" },
  { key: "e", meta: true, description: "Go to Events", category: "Navigation" },
  { key: "m", meta: true, description: "Go to Members", category: "Navigation" },
  { key: ",", meta: true, description: "Open Settings", category: "Navigation" },

  // Actions
  { key: "n", meta: true, description: "New item", category: "Actions" },
  { key: "s", meta: true, description: "Save", category: "Actions" },
  { key: "d", meta: true, description: "Delete", category: "Actions" },
  { key: "e", meta: true, shift: true, description: "Export", category: "Actions" },

  // View
  { key: "g", meta: true, description: "Toggle grid/list view", category: "View" },
  { key: "f", meta: true, description: "Toggle fullscreen", category: "View" },

  // General
  { key: "z", meta: true, description: "Undo", category: "General" },
  { key: "z", meta: true, shift: true, description: "Redo", category: "General" },
  { key: "c", meta: true, description: "Copy", category: "General" },
  { key: "v", meta: true, description: "Paste", category: "General" },
]
