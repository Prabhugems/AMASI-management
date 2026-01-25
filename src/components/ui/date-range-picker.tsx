"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getPresetRange, type DateRangePreset } from "@/lib/date-utils"

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  align?: "start" | "center" | "end"
  showPresets?: boolean
  disabled?: boolean
  className?: string
}

const presets: { label: string; value: DateRangePreset }[] = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "last7days" },
  { label: "Last 30 days", value: "last30days" },
  { label: "This week", value: "thisWeek" },
  { label: "Last week", value: "lastWeek" },
  { label: "This month", value: "thisMonth" },
  { label: "Last month", value: "lastMonth" },
  { label: "This year", value: "thisYear" },
  { label: "Last year", value: "lastYear" },
]

/**
 * Date Range Picker Component
 *
 * Select start and end dates with presets
 *
 * Usage:
 * ```
 * <DateRangePicker
 *   value={dateRange}
 *   onChange={setDateRange}
 *   showPresets
 * />
 * ```
 */
export function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  align = "start",
  showPresets = true,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handlePresetChange = (preset: DateRangePreset) => {
    const range = getPresetRange(preset)
    onChange?.({ from: range.start, to: range.end })
  }

  const formatDateRange = (range: DateRange | undefined): string => {
    if (!range?.from) return placeholder

    if (!range.to) {
      return format(range.from, "LLL dd, y")
    }

    return `${format(range.from, "LLL dd, y")} - ${format(range.to, "LLL dd, y")}`
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <div className="flex">
            {showPresets && (
              <div className="border-r p-2 space-y-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      handlePresetChange(preset.value)
                      setOpen(false)
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={value?.from}
                selected={value}
                onSelect={onChange}
                numberOfMonths={2}
              />
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange?.(undefined)
                    setOpen(false)
                  }}
                >
                  Clear
                </Button>
                <Button size="sm" onClick={() => setOpen(false)}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * Compact date range picker
 */
export function DateRangePickerCompact({
  value,
  onChange,
  className,
}: {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  className?: string
}) {
  const [preset, setPreset] = React.useState<string>("")

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset)
    if (newPreset === "custom") {
      // Open custom picker
      return
    }
    const range = getPresetRange(newPreset as DateRangePreset)
    onChange?.({ from: range.start, to: range.end })
  }

  return (
    <Select value={preset} onValueChange={handlePresetChange}>
      <SelectTrigger className={cn("w-[180px]", className)}>
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        {presets.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
        <SelectItem value="custom">Custom range...</SelectItem>
      </SelectContent>
    </Select>
  )
}

/**
 * Inline date range display
 */
export function DateRangeDisplay({
  from,
  to,
  format: dateFormat = "MMM d, yyyy",
  className,
}: {
  from?: Date | null
  to?: Date | null
  format?: string
  className?: string
}) {
  if (!from) {
    return <span className={cn("text-muted-foreground", className)}>No dates selected</span>
  }

  return (
    <span className={className}>
      {format(from, dateFormat)}
      {to && (
        <>
          <span className="mx-1">→</span>
          {format(to, dateFormat)}
        </>
      )}
    </span>
  )
}

/**
 * Quick date filter buttons
 */
export function QuickDateFilters({
  value,
  onChange,
  options = ["today", "last7days", "last30days", "thisMonth"],
  className,
}: {
  value?: DateRangePreset
  onChange: (preset: DateRangePreset) => void
  options?: DateRangePreset[]
  className?: string
}) {
  const presetLabels: Record<DateRangePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last7days: "7 days",
    last30days: "30 days",
    thisWeek: "This week",
    lastWeek: "Last week",
    thisMonth: "This month",
    lastMonth: "Last month",
    thisYear: "This year",
    lastYear: "Last year",
  }

  return (
    <div className={cn("flex gap-1", className)}>
      {options.map((preset) => (
        <Button
          key={preset}
          variant={value === preset ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onChange(preset)}
        >
          {presetLabels[preset]}
        </Button>
      ))}
    </div>
  )
}
