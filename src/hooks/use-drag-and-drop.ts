"use client"

import { useState, useCallback, useRef, DragEvent } from "react"

interface DragItem<T> {
  index: number
  item: T
}

interface UseDragAndDropOptions<T> {
  onReorder?: (items: T[]) => void
  onDragStart?: (item: T, index: number) => void
  onDragEnd?: (item: T, fromIndex: number, toIndex: number) => void
}

interface UseDragAndDropReturn<T> {
  items: T[]
  draggedIndex: number | null
  dragOverIndex: number | null
  getDragProps: (index: number) => {
    draggable: boolean
    onDragStart: (e: DragEvent) => void
    onDragOver: (e: DragEvent) => void
    onDragLeave: (e: DragEvent) => void
    onDrop: (e: DragEvent) => void
    onDragEnd: (e: DragEvent) => void
  }
  isDragging: boolean
  moveItem: (fromIndex: number, toIndex: number) => void
  setItems: (items: T[]) => void
}

/**
 * Drag and drop reordering
 *
 * Usage:
 * ```
 * const { items, getDragProps, isDragging } = useDragAndDrop(initialItems, {
 *   onReorder: (newItems) => saveOrder(newItems)
 * })
 *
 * {items.map((item, index) => (
 *   <div key={item.id} {...getDragProps(index)}>
 *     {item.name}
 *   </div>
 * ))}
 * ```
 */
export function useDragAndDrop<T>(
  initialItems: T[],
  options: UseDragAndDropOptions<T> = {}
): UseDragAndDropReturn<T> {
  const { onReorder, onDragStart, onDragEnd } = options

  const [items, setItems] = useState<T[]>(initialItems)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const draggedItemRef = useRef<DragItem<T> | null>(null)

  const moveItem = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return

      setItems((prev) => {
        const newItems = [...prev]
        const [removed] = newItems.splice(fromIndex, 1)
        newItems.splice(toIndex, 0, removed)
        onReorder?.(newItems)
        return newItems
      })
    },
    [onReorder]
  )

  const handleDragStart = useCallback(
    (index: number) => (e: DragEvent) => {
      const item = items[index]
      draggedItemRef.current = { index, item }
      setDraggedIndex(index)

      // Set drag image
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", String(index))
      }

      onDragStart?.(item, index)
    },
    [items, onDragStart]
  )

  const handleDragOver = useCallback(
    (index: number) => (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = "move"
      setDragOverIndex(index)
    },
    []
  )

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null)
  }, [])

  const handleDrop = useCallback(
    (toIndex: number) => (e: DragEvent) => {
      e.preventDefault()
      setDragOverIndex(null)

      if (draggedItemRef.current && draggedItemRef.current.index !== toIndex) {
        const fromIndex = draggedItemRef.current.index
        moveItem(fromIndex, toIndex)
        onDragEnd?.(draggedItemRef.current.item, fromIndex, toIndex)
      }
    },
    [moveItem, onDragEnd]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    draggedItemRef.current = null
  }, [])

  const getDragProps = useCallback(
    (index: number) => ({
      draggable: true,
      onDragStart: handleDragStart(index),
      onDragOver: handleDragOver(index),
      onDragLeave: handleDragLeave,
      onDrop: handleDrop(index),
      onDragEnd: handleDragEnd,
    }),
    [handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd]
  )

  return {
    items,
    draggedIndex,
    dragOverIndex,
    getDragProps,
    isDragging: draggedIndex !== null,
    moveItem,
    setItems,
  }
}

/**
 * Drag handle component props
 */
export function useDragHandle() {
  return {
    onMouseDown: (e: React.MouseEvent) => {
      // Find the draggable parent
      const draggable = (e.target as HTMLElement).closest("[draggable]")
      if (draggable) {
        draggable.setAttribute("data-drag-active", "true")
      }
    },
    onMouseUp: () => {
      // Clear drag active state
      document.querySelectorAll("[data-drag-active]").forEach((el) => {
        el.removeAttribute("data-drag-active")
      })
    },
    style: { cursor: "grab" },
  }
}

/**
 * Sortable list with keyboard support
 */
export function useSortableList<T extends { id: string }>(
  initialItems: T[],
  options: UseDragAndDropOptions<T> = {}
) {
  const dragAndDrop = useDragAndDrop(initialItems, options)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

  const handleKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp" && index > 0) {
        e.preventDefault()
        dragAndDrop.moveItem(index, index - 1)
        setFocusedIndex(index - 1)
      } else if (e.key === "ArrowDown" && index < dragAndDrop.items.length - 1) {
        e.preventDefault()
        dragAndDrop.moveItem(index, index + 1)
        setFocusedIndex(index + 1)
      }
    },
    [dragAndDrop]
  )

  const getItemProps = useCallback(
    (index: number) => ({
      ...dragAndDrop.getDragProps(index),
      onKeyDown: handleKeyDown(index),
      tabIndex: 0,
      role: "listitem",
      "aria-grabbed": dragAndDrop.draggedIndex === index,
    }),
    [dragAndDrop, handleKeyDown]
  )

  return {
    ...dragAndDrop,
    focusedIndex,
    getItemProps,
  }
}
