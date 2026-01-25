"use client"

import { useEffect, useRef, useCallback } from "react"

/**
 * Hook to trap focus within an element
 *
 * Useful for modals, dialogs, and other overlay components
 *
 * Usage:
 * ```
 * function Modal({ isOpen, onClose, children }) {
 *   const modalRef = useFocusTrap(isOpen)
 *
 *   return (
 *     <div ref={modalRef} role="dialog">
 *       {children}
 *     </div>
 *   )
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean = true
) {
  const containerRef = useRef<T>(null)
  const previousActiveElement = useRef<Element | null>(null)

  // Get all focusable elements within container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return []

    const focusableSelectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ")

    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => {
      // Check if element is visible
      return el.offsetParent !== null
    })
  }, [])

  // Focus first element
  const focusFirst = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[0].focus()
    }
  }, [getFocusableElements])

  // Focus last element
  const focusLast = useCallback(() => {
    const elements = getFocusableElements()
    if (elements.length > 0) {
      elements[elements.length - 1].focus()
    }
  }, [getFocusableElements])

  useEffect(() => {
    if (!active) return

    // Store previously focused element
    previousActiveElement.current = document.activeElement

    // Focus first element when trap becomes active
    const timeoutId = setTimeout(focusFirst, 0)

    // Handle keyboard navigation
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      const elements = getFocusableElements()
      if (elements.length === 0) return

      const firstElement = elements[0]
      const lastElement = elements[elements.length - 1]

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("keydown", handleKeyDown)

      // Restore focus to previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [active, focusFirst, getFocusableElements])

  return containerRef
}

/**
 * Hook for keyboard navigation in lists
 *
 * Usage:
 * ```
 * function ListBox({ items, onSelect }) {
 *   const { activeIndex, handlers } = useKeyboardNavigation({
 *     itemCount: items.length,
 *     onSelect: (index) => onSelect(items[index])
 *   })
 *
 *   return (
 *     <ul {...handlers}>
 *       {items.map((item, index) => (
 *         <li key={item.id} data-active={index === activeIndex}>
 *           {item.label}
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEscape,
  orientation = "vertical",
  loop = true,
  initialIndex = -1,
}: {
  itemCount: number
  onSelect?: (index: number) => void
  onEscape?: () => void
  orientation?: "vertical" | "horizontal"
  loop?: boolean
  initialIndex?: number
}) {
  const activeIndexRef = useRef(initialIndex)

  const getNextIndex = useCallback(
    (direction: 1 | -1) => {
      const current = activeIndexRef.current
      const next = current + direction

      if (loop) {
        if (next < 0) return itemCount - 1
        if (next >= itemCount) return 0
        return next
      }

      return Math.max(0, Math.min(itemCount - 1, next))
    },
    [itemCount, loop]
  )

  const setActiveIndex = useCallback((index: number) => {
    activeIndexRef.current = index
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft"
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight"

      switch (e.key) {
        case prevKey:
          e.preventDefault()
          activeIndexRef.current = getNextIndex(-1)
          break

        case nextKey:
          e.preventDefault()
          activeIndexRef.current = getNextIndex(1)
          break

        case "Home":
          e.preventDefault()
          activeIndexRef.current = 0
          break

        case "End":
          e.preventDefault()
          activeIndexRef.current = itemCount - 1
          break

        case "Enter":
        case " ":
          e.preventDefault()
          if (activeIndexRef.current >= 0) {
            onSelect?.(activeIndexRef.current)
          }
          break

        case "Escape":
          onEscape?.()
          break
      }
    },
    [orientation, getNextIndex, itemCount, onSelect, onEscape]
  )

  return {
    activeIndex: activeIndexRef.current,
    setActiveIndex,
    handlers: {
      onKeyDown: handleKeyDown,
      tabIndex: 0,
    },
  }
}

/**
 * Hook to restore focus on unmount
 */
export function useRestoreFocus() {
  const previousElement = useRef<Element | null>(null)

  useEffect(() => {
    previousElement.current = document.activeElement

    return () => {
      if (previousElement.current instanceof HTMLElement) {
        previousElement.current.focus()
      }
    }
  }, [])
}

/**
 * Hook to focus an element on mount
 */
export function useAutoFocus<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return ref
}

/**
 * Hook to manage focus visibility
 *
 * Shows focus ring only for keyboard navigation
 */
export function useFocusVisible() {
  useEffect(() => {
    let hadKeyboardEvent = false

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        hadKeyboardEvent = true
      }
    }

    const handleMouseDown = () => {
      hadKeyboardEvent = false
    }

    const handleFocus = (e: FocusEvent) => {
      if (hadKeyboardEvent && e.target instanceof HTMLElement) {
        e.target.dataset.focusVisible = "true"
      }
    }

    const handleBlur = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) {
        delete e.target.dataset.focusVisible
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("focus", handleFocus, true)
    document.addEventListener("blur", handleBlur, true)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("focus", handleFocus, true)
      document.removeEventListener("blur", handleBlur, true)
    }
  }, [])
}
