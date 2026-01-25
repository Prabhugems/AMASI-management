"use client"

import * as React from "react"
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
  Filter,
  Settings2,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Column definition
export interface Column<T> {
  key: string
  header: string
  accessor?: keyof T | ((row: T) => React.ReactNode)
  sortable?: boolean
  filterable?: boolean
  width?: string | number
  align?: "left" | "center" | "right"
  render?: (value: any, row: T, index: number) => React.ReactNode
  hidden?: boolean
}

// Props for DataTable
interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  searchable?: boolean
  searchPlaceholder?: string
  selectable?: boolean
  onSelectionChange?: (selectedRows: T[]) => void
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  className?: string
  stickyHeader?: boolean
  striped?: boolean
  bordered?: boolean
  compact?: boolean
  showPagination?: boolean
  showColumnToggle?: boolean
  onExport?: (data: T[]) => void
  rowKey?: keyof T | ((row: T) => string)
  initialSort?: { key: string; direction: "asc" | "desc" }
}

/**
 * Data Table Component
 *
 * Full-featured table with sorting, filtering, pagination, and selection
 *
 * Usage:
 * ```
 * <DataTable
 *   data={users}
 *   columns={[
 *     { key: "name", header: "Name", sortable: true },
 *     { key: "email", header: "Email" },
 *     { key: "actions", header: "", render: (_, row) => <Actions user={row} /> }
 *   ]}
 *   searchable
 *   selectable
 *   onSelectionChange={(selected) => setSelected(selected)}
 * />
 * ```
 */
export function DataTable<T extends Record<string, any>>({
  data,
  columns: initialColumns,
  pageSize = 10,
  searchable = false,
  searchPlaceholder = "Search...",
  selectable = false,
  onSelectionChange,
  onRowClick,
  loading = false,
  emptyMessage = "No data found",
  className,
  stickyHeader = false,
  striped = false,
  bordered = false,
  compact = false,
  showPagination = true,
  showColumnToggle = false,
  onExport,
  rowKey = "id" as keyof T,
  initialSort,
}: DataTableProps<T>) {
  // State
  const [search, setSearch] = React.useState("")
  const [sortKey, setSortKey] = React.useState<string | null>(initialSort?.key ?? null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    initialSort?.direction ?? "asc"
  )
  const [currentPage, setCurrentPage] = React.useState(1)
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(
    new Set(initialColumns.filter((c) => !c.hidden).map((c) => c.key))
  )

  // Get row key
  const getRowKey = (row: T): string => {
    if (typeof rowKey === "function") return rowKey(row)
    return String(row[rowKey])
  }

  // Filtered columns
  const columns = initialColumns.filter((col) => visibleColumns.has(col.key))

  // Filter and sort data
  const processedData = React.useMemo(() => {
    let result = [...data]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter((row) =>
        columns.some((col) => {
          const value = col.accessor
            ? typeof col.accessor === "function"
              ? col.accessor(row)
              : row[col.accessor]
            : row[col.key]
          return String(value).toLowerCase().includes(searchLower)
        })
      )
    }

    // Sort
    if (sortKey) {
      result.sort((a, b) => {
        const col = columns.find((c) => c.key === sortKey)
        const aVal = col?.accessor
          ? typeof col.accessor === "function"
            ? col.accessor(a)
            : a[col.accessor]
          : a[sortKey]
        const bVal = col?.accessor
          ? typeof col.accessor === "function"
            ? col.accessor(b)
            : b[col.accessor]
          : b[sortKey]

        if (aVal === bVal) return 0
        const comparison = aVal < bVal ? -1 : 1
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return result
  }, [data, search, sortKey, sortDirection, columns])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = showPagination
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [search])

  // Handle sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  // Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(paginatedData.map(getRowKey))
      setSelectedRows(newSelected)
      onSelectionChange?.(paginatedData)
    } else {
      setSelectedRows(new Set())
      onSelectionChange?.([])
    }
  }

  const handleSelectRow = (row: T, checked: boolean) => {
    const key = getRowKey(row)
    const newSelected = new Set(selectedRows)

    if (checked) {
      newSelected.add(key)
    } else {
      newSelected.delete(key)
    }

    setSelectedRows(newSelected)
    onSelectionChange?.(data.filter((r) => newSelected.has(getRowKey(r))))
  }

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedRows.has(getRowKey(row)))

  // Get cell value
  const getCellValue = (row: T, col: Column<T>, index: number) => {
    if (col.render) {
      const value = col.accessor
        ? typeof col.accessor === "function"
          ? col.accessor(row)
          : row[col.accessor]
        : row[col.key]
      return col.render(value, row, index)
    }

    if (col.accessor) {
      return typeof col.accessor === "function"
        ? col.accessor(row)
        : row[col.accessor]
    }

    return row[col.key]
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      {(searchable || showColumnToggle || onExport) && (
        <div className="flex items-center justify-between gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {showColumnToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings2 className="h-4 w-4 mr-2" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {initialColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleColumns.has(col.key)}
                      onCheckedChange={(checked) => {
                        const newVisible = new Set(visibleColumns)
                        if (checked) {
                          newVisible.add(col.key)
                        } else {
                          newVisible.delete(col.key)
                        }
                        setVisibleColumns(newVisible)
                      }}
                    >
                      {col.header}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExport(processedData)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Selection info */}
      {selectable && selectedRows.size > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{selectedRows.size} selected</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedRows(new Set())
              onSelectionChange?.([])
            }}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className={cn("rounded-lg border overflow-hidden", bordered && "border-2")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn(stickyHeader && "sticky top-0 z-10")}>
              <tr className="bg-muted/50">
                {selectable && (
                  <th className="w-12 px-4 py-3">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left text-sm font-medium text-muted-foreground",
                      col.align === "center" && "text-center",
                      col.align === "right" && "text-right",
                      col.sortable && "cursor-pointer select-none hover:text-foreground"
                    )}
                    style={{ width: col.width }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="ml-1">
                          {sortKey === col.key ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => {
                  const key = getRowKey(row)
                  const isSelected = selectedRows.has(key)

                  return (
                    <tr
                      key={key}
                      className={cn(
                        "border-t transition-colors",
                        striped && index % 2 === 1 && "bg-muted/25",
                        isSelected && "bg-primary/5",
                        onRowClick && "cursor-pointer hover:bg-muted/50"
                      )}
                      onClick={() => onRowClick?.(row)}
                    >
                      {selectable && (
                        <td
                          className="w-12 px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectRow(row, checked as boolean)
                            }
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4",
                            compact ? "py-2" : "py-3",
                            "text-sm",
                            col.align === "center" && "text-center",
                            col.align === "right" && "text-right"
                          )}
                        >
                          {getCellValue(row, col, index)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, processedData.length)} of{" "}
            {processedData.length}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
