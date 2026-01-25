"use client"

import { useState, useCallback, useMemo } from "react"

/**
 * Hook for managing row/item selection in tables and lists
 *
 * Usage:
 * ```
 * const {
 *   selectedIds,
 *   isSelected,
 *   toggle,
 *   selectAll,
 *   clearAll,
 *   selectedCount,
 * } = useSelection(items.map(i => i.id))
 * ```
 */
export function useSelection<T extends string | number>(allIds: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<T>>(new Set())

  const isSelected = useCallback(
    (id: T) => selectedIds.has(id),
    [selectedIds]
  )

  const toggle = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const select = useCallback((id: T) => {
    setSelectedIds((prev) => new Set(prev).add(id))
  }, [])

  const deselect = useCallback((id: T) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [])

  const selectMultiple = useCallback((ids: T[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  const deselectMultiple = useCallback((ids: T[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(allIds))
  }, [allIds])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedIds.size === allIds.length) {
      clearAll()
    } else {
      selectAll()
    }
  }, [selectedIds.size, allIds.length, selectAll, clearAll])

  const isAllSelected = useMemo(
    () => allIds.length > 0 && selectedIds.size === allIds.length,
    [allIds.length, selectedIds.size]
  )

  const isSomeSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < allIds.length,
    [selectedIds.size, allIds.length]
  )

  const isNoneSelected = useMemo(
    () => selectedIds.size === 0,
    [selectedIds.size]
  )

  const selectedCount = selectedIds.size

  const selectedArray = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  )

  return {
    selectedIds,
    selectedArray,
    selectedCount,
    isSelected,
    toggle,
    select,
    deselect,
    selectMultiple,
    deselectMultiple,
    selectAll,
    clearAll,
    toggleAll,
    isAllSelected,
    isSomeSelected,
    isNoneSelected,
    setSelectedIds,
  }
}

/**
 * Hook for managing selection with data objects
 */
export function useSelectionWithData<T extends { id: string | number }>(
  items: T[]
) {
  const allIds = useMemo(() => items.map((item) => item.id), [items])
  const selection = useSelection(allIds)

  const selectedItems = useMemo(
    () => items.filter((item) => selection.isSelected(item.id)),
    [items, selection]
  )

  return {
    ...selection,
    selectedItems,
  }
}
