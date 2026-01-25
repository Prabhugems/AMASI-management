"use client"

import { useEffect, useCallback } from "react"

type KeyHandler = (e: KeyboardEvent) => void

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  handler: KeyHandler
  preventDefault?: boolean
  description?: string
}

/**
 * Hook for handling keyboard shortcuts
 *
 * Usage:
 * ```
 * useKeyboardShortcuts([
 *   { key: 's', ctrl: true, handler: handleSave, description: 'Save' },
 *   { key: 'Escape', handler: handleClose, description: 'Close' },
 * ])
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const altMatch = shortcut.alt ? e.altKey : !e.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // Allow Escape even in inputs
          if (isInput && shortcut.key.toLowerCase() !== "escape") {
            // For save shortcut (Ctrl+S), still trigger even in inputs
            if (!(shortcut.ctrl && shortcut.key.toLowerCase() === "s")) {
              continue
            }
          }

          if (shortcut.preventDefault !== false) {
            e.preventDefault()
          }
          shortcut.handler(e)
          return
        }
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Hook for a single keyboard shortcut
 */
export function useKeyboardShortcut(
  key: string,
  handler: KeyHandler,
  options: Omit<ShortcutConfig, "key" | "handler"> = {}
) {
  useKeyboardShortcuts([{ key, handler, ...options }])
}

/**
 * Common shortcuts preset
 */
export function useCommonShortcuts({
  onSave,
  onClose,
  onNew,
  onDelete,
  onSearch,
}: {
  onSave?: () => void
  onClose?: () => void
  onNew?: () => void
  onDelete?: () => void
  onSearch?: () => void
}) {
  const shortcuts: ShortcutConfig[] = []

  if (onSave) {
    shortcuts.push({
      key: "s",
      ctrl: true,
      handler: () => onSave(),
      description: "Save",
    })
  }

  if (onClose) {
    shortcuts.push({
      key: "Escape",
      handler: () => onClose(),
      description: "Close",
    })
  }

  if (onNew) {
    shortcuts.push({
      key: "n",
      ctrl: true,
      handler: () => onNew(),
      description: "New",
    })
  }

  if (onDelete) {
    shortcuts.push({
      key: "Delete",
      handler: () => onDelete(),
      description: "Delete",
    })
  }

  if (onSearch) {
    shortcuts.push({
      key: "k",
      ctrl: true,
      handler: () => onSearch(),
      description: "Search",
    })
  }

  useKeyboardShortcuts(shortcuts)
}
