"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker"
import { cn } from "@/lib/utils"
import { format, setMonth, setYear } from "date-fns"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  fromYear?: number
  toYear?: number
}

// Custom caption component with year/month dropdowns
function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth } = useNavigation()

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - 80 + i) // 1946 to 2045

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value)
    goToMonth(setMonth(displayMonth, newMonth))
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    goToMonth(setYear(displayMonth, newYear))
  }

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <select
        value={displayMonth.getMonth()}
        onChange={handleMonthChange}
        className="px-3 py-2 bg-gray-100 hover:bg-violet-100 rounded-xl font-bold text-gray-800 cursor-pointer border-0 outline-none focus:ring-2 focus:ring-violet-400 transition-all"
      >
        {months.map((month, idx) => (
          <option key={month} value={idx}>
            {month}
          </option>
        ))}
      </select>
      <select
        value={displayMonth.getFullYear()}
        onChange={handleYearChange}
        className="px-3 py-2 bg-gray-100 hover:bg-violet-100 rounded-xl font-bold text-gray-800 cursor-pointer border-0 outline-none focus:ring-2 focus:ring-violet-400 transition-all"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fromYear,
  toYear,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "hidden",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-9 w-9 bg-gray-100 hover:bg-violet-100 p-0 rounded-xl flex items-center justify-center transition-colors border-0"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex mb-1",
        head_cell:
          "text-gray-600 rounded-md w-10 font-bold text-sm",
        row: "flex w-full mt-1",
        cell: cn(
          "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-violet-100 [&:has([aria-selected].day-outside)]:bg-violet-100/50 [&:has([aria-selected].day-range-end)]:rounded-r-md rounded-lg",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-lg"
        ),
        day: cn(
          "h-10 w-10 p-0 font-bold text-gray-700 aria-selected:opacity-100 rounded-lg hover:bg-violet-100 hover:text-violet-900 transition-all cursor-pointer inline-flex items-center justify-center"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-gradient-to-br from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 hover:text-white focus:from-violet-600 focus:to-purple-700 focus:text-white shadow-lg",
        day_today: "bg-orange-100 text-orange-700 font-black ring-2 ring-orange-300",
        day_outside:
          "day-outside text-gray-300 aria-selected:bg-violet-100/50 aria-selected:text-gray-400",
        day_disabled: "text-gray-300",
        day_range_middle:
          "aria-selected:bg-violet-100 aria-selected:text-violet-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ ...props }) => <ChevronLeft className="h-5 w-5 text-gray-700" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-5 w-5 text-gray-700" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
