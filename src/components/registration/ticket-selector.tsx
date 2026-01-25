"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Minus, Plus, Clock, Users, Ticket, Check, AlertCircle, Bell } from "lucide-react"
import { TicketType } from "@/lib/types"
import { format, differenceInDays, differenceInHours, isPast } from "date-fns"
import { WaitlistForm } from "./waitlist-form"

interface TicketSelectorProps {
  tickets: TicketType[]
  selectedTickets: Map<string, number>
  onSelectionChange: (tickets: Map<string, number>) => void
  allowMultipleTicketTypes?: boolean // When false, only one ticket type can be selected (radio behavior)
  eventId?: string // Event ID for waitlist functionality
}

function CountdownBadge({ endDate, isDark }: { endDate: string; isDark: boolean }) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const end = new Date(endDate)
      const now = new Date()

      if (isPast(end)) {
        setTimeLeft("Ended")
        return
      }

      const days = differenceInDays(end, now)
      const hours = differenceInHours(end, now) % 24

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h left`)
      } else if (hours > 0) {
        setTimeLeft(`${hours}h left`)
      } else {
        setTimeLeft("Ending soon")
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [endDate])

  if (timeLeft === "Ended") return null

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
        ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}
      `}
    >
      <Clock className="w-3 h-3" />
      {timeLeft}
    </span>
  )
}

function TicketCard({
  ticket,
  quantity,
  onQuantityChange,
  isDark,
  index,
  disabledByTicket,
  eventId,
}: {
  ticket: TicketType
  quantity: number
  onQuantityChange: (quantity: number) => void
  isDark: boolean
  index: number
  disabledByTicket: string | null
  eventId?: string
}) {
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  const isAvailable = ticket.status === "active" && !disabledByTicket
  const isSoldOut = ticket.status === "sold_out" ||
    (ticket.quantity_total && ticket.quantity_sold >= ticket.quantity_total)
  const isExclusivityBlocked = !!disabledByTicket
  const remaining = ticket.quantity_total
    ? ticket.quantity_total - ticket.quantity_sold
    : null

  // Use max_per_order from ticket, default to 10 if not set
  const configuredMax = ticket.max_per_order ?? 10
  // Also respect min_per_order
  const minPerOrder = ticket.min_per_order ?? 1
  // The actual max should be the minimum of: configured max and remaining stock
  const maxPerOrder = remaining !== null ? Math.min(configuredMax, remaining) : configuredMax

  const hasEndDate = ticket.sale_end_date && !isPast(new Date(ticket.sale_end_date))
  const isEarlyBird = ticket.name.toLowerCase().includes("early")

  const taxAmount = (ticket.price * ticket.tax_percentage) / 100
  const totalPrice = ticket.price + taxAmount

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl transition-all duration-500
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${quantity > 0 ? "ring-2 ring-primary" : ""}
        ${isDark
          ? "bg-slate-900 border border-slate-800"
          : "bg-white border border-gray-200"
        }
        ${!isAvailable || isSoldOut ? "opacity-60" : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Early Bird Badge */}
      {isEarlyBird && isAvailable && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
            EARLY BIRD
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Ticket Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3
                className={`
                  text-lg font-bold
                  ${isDark ? "text-white" : "text-gray-900"}
                `}
              >
                {ticket.name}
              </h3>
              {hasEndDate && (
                <CountdownBadge endDate={ticket.sale_end_date!} isDark={isDark} />
              )}
            </div>

            {ticket.description && (
              <p
                className={`
                  text-sm mb-3
                  ${isDark ? "text-slate-400" : "text-gray-500"}
                `}
              >
                {ticket.description}
              </p>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              {remaining !== null && remaining <= 50 && remaining > 0 && (
                <span
                  className={`
                    inline-flex items-center gap-1
                    ${isDark ? "text-amber-400" : "text-amber-600"}
                  `}
                >
                  <AlertCircle className="w-4 h-4" />
                  Only {remaining} left
                </span>
              )}
              {configuredMax <= 5 && !isSoldOut && (
                <span
                  className={`
                    inline-flex items-center gap-1
                    ${isDark ? "text-slate-400" : "text-gray-500"}
                  `}
                >
                  <Users className="w-4 h-4" />
                  Max {configuredMax} per order
                </span>
              )}
              {isSoldOut && (
                <span
                  className={`
                    inline-flex items-center gap-1
                    ${isDark ? "text-rose-400" : "text-rose-600"}
                  `}
                >
                  <Users className="w-4 h-4" />
                  Sold Out
                </span>
              )}
              {isExclusivityBlocked && (
                <span
                  className={`
                    inline-flex items-center gap-1
                    ${isDark ? "text-amber-400" : "text-amber-600"}
                  `}
                >
                  <AlertCircle className="w-4 h-4" />
                  Already selected: {disabledByTicket}
                </span>
              )}
            </div>
          </div>

          {/* Price & Quantity */}
          <div className="text-right flex-shrink-0">
            {/* Price */}
            <div className="mb-3">
              <p
                className={`
                  text-2xl font-black
                  ${isDark ? "text-white" : "text-gray-900"}
                `}
              >
                ₹{ticket.price.toLocaleString()}
              </p>
              {ticket.tax_percentage > 0 && (
                <p
                  className={`
                    text-xs
                    ${isDark ? "text-slate-500" : "text-gray-400"}
                  `}
                >
                  +{ticket.tax_percentage}% GST
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            {isAvailable && !isSoldOut ? (
              <div
                className={`
                  inline-flex items-center gap-1 p-1 rounded-lg
                  ${isDark ? "bg-slate-800" : "bg-gray-100"}
                `}
              >
                <button
                  onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                  disabled={quantity === 0}
                  className={`
                    p-2 rounded-md transition-all
                    ${quantity === 0
                      ? "opacity-30 cursor-not-allowed"
                      : isDark
                        ? "hover:bg-slate-700 text-white"
                        : "hover:bg-gray-200 text-gray-700"
                    }
                  `}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  className={`
                    w-8 text-center font-bold
                    ${isDark ? "text-white" : "text-gray-900"}
                  `}
                >
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    onQuantityChange(Math.min(maxPerOrder, quantity + 1))
                  }
                  disabled={quantity >= maxPerOrder}
                  className={`
                    p-2 rounded-md transition-all
                    ${quantity >= maxPerOrder
                      ? "opacity-30 cursor-not-allowed"
                      : isDark
                        ? "hover:bg-slate-700 text-white"
                        : "hover:bg-gray-200 text-gray-700"
                    }
                  `}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : isSoldOut && eventId ? (
              <button
                onClick={() => setShowWaitlist(true)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                  ${isDark
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }
                  transition-colors
                `}
              >
                <Bell className="w-4 h-4" />
                Join Waitlist
              </button>
            ) : (
              <span
                className={`
                  inline-block px-4 py-2 rounded-lg text-sm font-medium
                  ${isDark ? "bg-slate-800 text-slate-500" : "bg-gray-100 text-gray-400"}
                `}
              >
                Unavailable
              </span>
            )}
          </div>
        </div>

        {/* Selected indicator */}
        {quantity > 0 && (
          <div
            className={`
              mt-4 pt-4 border-t flex items-center justify-between
              ${isDark ? "border-slate-800" : "border-gray-100"}
            `}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <Check className="w-4 h-4" />
              Selected
            </span>
            <span
              className={`
                text-sm font-bold
                ${isDark ? "text-white" : "text-gray-900"}
              `}
            >
              Subtotal: ₹{(totalPrice * quantity).toLocaleString()}
            </span>
          </div>
        )}

        {/* Waitlist Form Modal */}
        {showWaitlist && eventId && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <WaitlistForm
              eventId={eventId}
              ticketTypeId={ticket.id}
              ticketName={ticket.name}
              onSuccess={() => setShowWaitlist(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function TicketSelector({
  tickets,
  selectedTickets,
  onSelectionChange,
  allowMultipleTicketTypes = true, // Default to true for backward compatibility
  eventId,
}: TicketSelectorProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  const handleQuantityChange = (ticketId: string, quantity: number) => {
    const newSelection = new Map(selectedTickets)

    // Find the ticket being changed
    const ticket = tickets.find(t => t.id === ticketId)

    if (quantity === 0) {
      newSelection.delete(ticketId)
    } else {
      // If multiple ticket types NOT allowed, clear all other selections first
      if (!allowMultipleTicketTypes) {
        newSelection.clear()
      }

      // Check for exclusivity group
      if (ticket?.exclusivity_group) {
        // Remove any other tickets in the same exclusivity group
        tickets.forEach(t => {
          if (t.id !== ticketId && t.exclusivity_group === ticket.exclusivity_group) {
            newSelection.delete(t.id)
          }
        })
      }
      newSelection.set(ticketId, quantity)
    }
    onSelectionChange(newSelection)
  }

  // Helper to check if a ticket is disabled due to exclusivity
  const isDisabledByExclusivity = (ticketId: string): string | null => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket?.exclusivity_group) return null

    // Check if another ticket in the same group is selected
    for (const [selectedId, qty] of selectedTickets) {
      if (qty > 0 && selectedId !== ticketId) {
        const selectedTicket = tickets.find(t => t.id === selectedId)
        if (selectedTicket?.exclusivity_group === ticket.exclusivity_group) {
          return selectedTicket.name
        }
      }
    }
    return null
  }

  // Sort tickets: active first, then by sort_order, then by price
  const sortedTickets = [...tickets].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (a.status !== "active" && b.status === "active") return 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.price - b.price
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Ticket className={`w-5 h-5 ${isDark ? "text-primary" : "text-primary"}`} />
          <h2
            className={`
              text-xl font-bold
              ${isDark ? "text-white" : "text-gray-900"}
            `}
          >
            Select {allowMultipleTicketTypes ? "Tickets" : "a Ticket"}
          </h2>
        </div>
        {!allowMultipleTicketTypes && (
          <span className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            Choose one option
          </span>
        )}
      </div>

      <div className="space-y-4">
        {sortedTickets.map((ticket, index) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            quantity={selectedTickets.get(ticket.id) || 0}
            onQuantityChange={(qty) => handleQuantityChange(ticket.id, qty)}
            isDark={isDark}
            index={index}
            disabledByTicket={isDisabledByExclusivity(ticket.id)}
            eventId={eventId}
          />
        ))}
      </div>
    </div>
  )
}
