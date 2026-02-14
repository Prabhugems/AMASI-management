"use client"

import { useState, useEffect, useCallback } from "react"

/**
 * Hook for persisting state in localStorage
 *
 * Usage:
 * ```
 * const [theme, setTheme] = useLocalStorage("theme", "light")
 * const [filters, setFilters] = useLocalStorage("filters", { status: "all" })
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }

    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Return a wrapped version of useState's setter function that
  // persists the new value to localStorage
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Use functional setState to avoid stale closure over storedValue
        setStoredValue((prev) => {
          const valueToStore =
            value instanceof Function ? value(prev) : value

          if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
          }

          return valueToStore
        })
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error)
      }
    },
    [key]
  )

  // Remove the value from localStorage
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue)
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error)
    }
  }, [key, initialValue])

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue))
        } catch {
          // Ignore parse errors
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [key])

  return [storedValue, setValue, removeValue]
}

/**
 * Hook for session storage (cleared when browser closes)
 */
export function useSessionStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue
    }

    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.warn(`Error reading sessionStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        // Use functional setState to avoid stale closure over storedValue
        setStoredValue((prev) => {
          const valueToStore =
            value instanceof Function ? value(prev) : value

          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(key, JSON.stringify(valueToStore))
          }

          return valueToStore
        })
      } catch (error) {
        console.warn(`Error setting sessionStorage key "${key}":`, error)
      }
    },
    [key]
  )

  return [storedValue, setValue]
}

/**
 * Hook for managing filter preferences per page
 */
export function useFilterPreferences<T extends Record<string, any>>(
  pageKey: string,
  defaultFilters: T
): [T, (filters: Partial<T>) => void, () => void] {
  const [filters, setFilters, clearFilters] = useLocalStorage<T>(
    `filters:${pageKey}`,
    defaultFilters
  )

  const updateFilters = useCallback(
    (updates: Partial<T>) => {
      setFilters((prev) => ({ ...prev, ...updates }))
    },
    [setFilters]
  )

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters)
  }, [setFilters, defaultFilters])

  return [filters, updateFilters, resetFilters]
}

/**
 * Hook for managing table column visibility preferences
 */
export function useColumnVisibility(
  tableKey: string,
  defaultColumns: string[]
): [Set<string>, (column: string) => void, () => void] {
  const [visibleColumns, setVisibleColumns] = useLocalStorage<string[]>(
    `columns:${tableKey}`,
    defaultColumns
  )

  const toggleColumn = useCallback(
    (column: string) => {
      setVisibleColumns((prev) => {
        const set = new Set(prev)
        if (set.has(column)) {
          set.delete(column)
        } else {
          set.add(column)
        }
        return Array.from(set)
      })
    },
    [setVisibleColumns]
  )

  const resetColumns = useCallback(() => {
    setVisibleColumns(defaultColumns)
  }, [setVisibleColumns, defaultColumns])

  return [new Set(visibleColumns), toggleColumn, resetColumns]
}

/**
 * Hook for managing recent items (e.g., recently viewed events)
 */
export function useRecentItems<T>(
  key: string,
  maxItems: number = 10
): [T[], (item: T) => void, () => void] {
  const [items, setItems, clearItems] = useLocalStorage<T[]>(
    `recent:${key}`,
    []
  )

  const addItem = useCallback(
    (item: T) => {
      setItems((prev) => {
        // Remove duplicates and add to front
        const filtered = prev.filter(
          (i) => JSON.stringify(i) !== JSON.stringify(item)
        )
        return [item, ...filtered].slice(0, maxItems)
      })
    },
    [setItems, maxItems]
  )

  return [items, addItem, clearItems]
}
