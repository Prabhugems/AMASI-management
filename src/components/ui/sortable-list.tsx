"use client"

import * as React from "react"
import { GripVertical, ChevronUp, ChevronDown, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useDragAndDrop, useSortableList } from "@/hooks/use-drag-and-drop"

interface SortableItem {
  id: string
  [key: string]: any
}

interface SortableListProps<T extends SortableItem> {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number) => React.ReactNode
  onRemove?: (item: T, index: number) => void
  className?: string
  itemClassName?: string
  showDragHandle?: boolean
  showMoveButtons?: boolean
  disabled?: boolean
}

/**
 * Sortable List Component
 *
 * Drag-and-drop reorderable list
 *
 * Usage:
 * ```
 * <SortableList
 *   items={items}
 *   onReorder={setItems}
 *   renderItem={(item) => <div>{item.name}</div>}
 *   onRemove={(item) => removeItem(item.id)}
 * />
 * ```
 */
export function SortableList<T extends SortableItem>({
  items: initialItems,
  onReorder,
  renderItem,
  onRemove,
  className,
  itemClassName,
  showDragHandle = true,
  showMoveButtons = false,
  disabled = false,
}: SortableListProps<T>) {
  const { items, getDragProps, draggedIndex, dragOverIndex, moveItem, setItems } =
    useDragAndDrop<T>(initialItems, { onReorder })

  // Sync with external items
  React.useEffect(() => {
    setItems(initialItems)
  }, [initialItems, setItems])

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      moveItem(index, index - 1)
    }
  }

  const handleMoveDown = (index: number) => {
    if (index < items.length - 1) {
      moveItem(index, index + 1)
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          {...(disabled ? {} : getDragProps(index))}
          className={cn(
            "flex items-center gap-2 p-3 bg-background border rounded-lg",
            "transition-all duration-200",
            !disabled && "cursor-move",
            draggedIndex === index && "opacity-50 scale-95",
            dragOverIndex === index && "border-primary border-2",
            itemClassName
          )}
        >
          {showDragHandle && !disabled && (
            <div className="flex-shrink-0 text-muted-foreground hover:text-foreground">
              <GripVertical className="h-5 w-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">{renderItem(item, index)}</div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {showMoveButtons && !disabled && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveUp(index)
                  }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveDown(index)
                  }}
                  disabled={index === items.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </>
            )}

            {onRemove && !disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(item, index)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No items to display
        </div>
      )}
    </div>
  )
}

/**
 * Compact sortable list
 */
export function SortableListCompact<T extends SortableItem>({
  items: initialItems,
  onReorder,
  renderItem,
  onRemove,
  className,
}: Omit<SortableListProps<T>, "showDragHandle" | "showMoveButtons" | "itemClassName">) {
  return (
    <SortableList
      items={initialItems}
      onReorder={onReorder}
      renderItem={renderItem}
      onRemove={onRemove}
      className={className}
      itemClassName="p-2"
      showDragHandle={true}
      showMoveButtons={false}
    />
  )
}

/**
 * Sortable list with keyboard support
 */
export function AccessibleSortableList<T extends SortableItem>({
  items: initialItems,
  onReorder,
  renderItem,
  onRemove: _onRemove,
  className,
  label = "Reorderable list",
}: SortableListProps<T> & { label?: string }) {
  const { items, getItemProps, focusedIndex, moveItem: _moveItem, setItems } =
    useSortableList<T>(initialItems, { onReorder })

  React.useEffect(() => {
    setItems(initialItems)
  }, [initialItems, setItems])

  return (
    <div
      className={cn("space-y-1", className)}
      role="listbox"
      aria-label={label}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          {...getItemProps(index)}
          className={cn(
            "flex items-center gap-2 p-3 bg-background border rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "cursor-grab active:cursor-grabbing",
            focusedIndex === index && "ring-2 ring-ring"
          )}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">{renderItem(item, index)}</div>
          <span className="sr-only">
            Item {index + 1} of {items.length}. Use arrow keys to reorder.
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Simple numbered list with reorder
 */
export function NumberedSortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  onRemove,
  className,
}: SortableListProps<T>) {
  return (
    <SortableList
      items={items}
      onReorder={onReorder}
      onRemove={onRemove}
      className={className}
      renderItem={(item, index) => (
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
            {index + 1}
          </span>
          <div className="flex-1">{renderItem(item, index)}</div>
        </div>
      )}
    />
  )
}

/**
 * Kanban-style sortable columns
 */
export function SortableColumns<T extends SortableItem>({
  columns,
  onReorderColumns,
  renderColumn,
  className,
}: {
  columns: T[]
  onReorderColumns: (columns: T[]) => void
  renderColumn: (column: T, index: number) => React.ReactNode
  className?: string
}) {
  const { items, getDragProps, draggedIndex, dragOverIndex, setItems } =
    useDragAndDrop<T>(columns, { onReorder: onReorderColumns })

  React.useEffect(() => {
    setItems(columns)
  }, [columns, setItems])

  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-4", className)}>
      {items.map((column, index) => (
        <div
          key={column.id}
          {...getDragProps(index)}
          className={cn(
            "flex-shrink-0 w-80 bg-muted/50 rounded-lg",
            "transition-all duration-200 cursor-move",
            draggedIndex === index && "opacity-50 scale-95",
            dragOverIndex === index && "ring-2 ring-primary"
          )}
        >
          <div className="p-3 border-b flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium flex-1">Column {index + 1}</span>
          </div>
          <div className="p-3">{renderColumn(column, index)}</div>
        </div>
      ))}
    </div>
  )
}
