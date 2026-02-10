"use client"

import { useEffect, useRef } from "react"

interface ShortcutOptions {
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  shift?: boolean
  preventDefault?: boolean
  enabled?: boolean
}

type KeyHandler = (event: KeyboardEvent) => void

/**
 * Register a keyboard shortcut
 *
 * Usage:
 * ```
 * useKeyboardShortcut("s", () => save(), { meta: true })
 * useKeyboardShortcut("Escape", () => close())
 * useKeyboardShortcut("?", () => showHelp(), { shift: true })
 * ```
 */
export function useKeyboardShortcut(
  key: string,
  callback: KeyHandler,
  options: ShortcutOptions = {}
): void {
  const {
    ctrl = false,
    meta = false,
    alt = false,
    shift = false,
    preventDefault = true,
    enabled = true,
  } = options

  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check modifiers
      if (ctrl && !event.ctrlKey) return
      if (meta && !event.metaKey) return
      if (alt && !event.altKey) return
      if (shift && !event.shiftKey) return

      // Check key
      if (event.key.toLowerCase() !== key.toLowerCase()) return

      // Don't trigger in input fields unless it's a special key
      const target = event.target as HTMLElement
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      const isContentEditable = target.isContentEditable

      if ((isInput || isContentEditable) && !meta && !ctrl) {
        return
      }

      if (preventDefault) {
        event.preventDefault()
      }

      callbackRef.current(event)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [key, ctrl, meta, alt, shift, preventDefault, enabled])
}

/**
 * Register multiple keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: Array<{
    key: string
    callback: KeyHandler
    options?: ShortcutOptions
  }>
): void {
  useEffect(() => {
    const handlers: Array<(event: KeyboardEvent) => void> = []

    for (const shortcut of shortcuts) {
      const {
        ctrl = false,
        meta = false,
        alt = false,
        shift = false,
        preventDefault = true,
        enabled = true,
      } = shortcut.options || {}

      if (!enabled) continue

      const handler = (event: KeyboardEvent) => {
        if (ctrl && !event.ctrlKey) return
        if (meta && !event.metaKey) return
        if (alt && !event.altKey) return
        if (shift && !event.shiftKey) return

        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) return

        const target = event.target as HTMLElement
        const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
        const isContentEditable = target.isContentEditable

        if ((isInput || isContentEditable) && !meta && !ctrl) {
          return
        }

        if (preventDefault) {
          event.preventDefault()
        }

        shortcut.callback(event)
      }

      handlers.push(handler)
      document.addEventListener("keydown", handler)
    }

    return () => {
      for (const handler of handlers) {
        document.removeEventListener("keydown", handler)
      }
    }
  }, [shortcuts])
}

/**
 * Format shortcut for display
 */
export function formatShortcut(
  key: string,
  options: ShortcutOptions = {}
): string {
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
  const parts: string[] = []

  if (options.ctrl) parts.push(isMac ? "⌃" : "Ctrl")
  if (options.alt) parts.push(isMac ? "⌥" : "Alt")
  if (options.shift) parts.push(isMac ? "⇧" : "Shift")
  if (options.meta) parts.push(isMac ? "⌘" : "Ctrl")

  // Format the key
  const keyDisplay = key.length === 1 ? key.toUpperCase() : key
  parts.push(keyDisplay)

  return isMac ? parts.join("") : parts.join("+")
}
