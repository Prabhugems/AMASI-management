"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Minus, Plus, Clock, Users, Ticket, Check, AlertCircle, Bell, ChevronDown, Star, Flame } from "lucide-react"
import { TicketType } from "@/lib/types"
import { differenceInDays, differenceInHours, isPast } from "date-fns"
import { WaitlistForm } from "./waitlist-form"

interface TicketSelectorProps {
  tickets: TicketType[]
  selectedTickets: Map<string, number>
  onSelectionChange: (tickets: Map<string, number>) => void
  allowMultipleTicketTypes?: boolean // When false, only one ticket type can be selected (radio behavior)
  eventId?: string // Event ID for waitlist functionality
  waitlistEnabled?: boolean // When false, hide waitlist button even when sold out
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
        inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
        ${isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"}
        animate-pulse-scale
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
  waitlistEnabled = true,
}: {
  ticket: TicketType
  quantity: number
  onQuantityChange: (quantity: number) => void
  isDark: boolean
  index: number
  disabledByTicket: string | null
  eventId?: string
  waitlistEnabled?: boolean
}) {
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const [justSelected, setJustSelected] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100)
    return () => clearTimeout(timer)
  }, [index])

  // Trigger selection animation
  useEffect(() => {
    if (quantity > 0) {
      setJustSelected(true)
      const timer = setTimeout(() => setJustSelected(false), 300)
      return () => clearTimeout(timer)
    }
  }, [quantity])

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
  const _minPerOrder = ticket.min_per_order ?? 1
  // The actual max should be the minimum of: configured max and remaining stock
  const maxPerOrder = remaining !== null ? Math.min(configuredMax, remaining) : configuredMax

  const hasEndDate = ticket.sale_end_date && !isPast(new Date(ticket.sale_end_date))
  const isEarlyBird = ticket.name.toLowerCase().includes("early")
  const isPopular = ticket.metadata?.popular === true || ticket.metadata?.recommended === true
  const isLowStock = remaining !== null && remaining > 0 && remaining < 10
  const hasLongDescription = (ticket.description?.length || 0) > 100

  const taxAmount = (ticket.price * ticket.tax_percentage) / 100
  const totalPrice = ticket.price + taxAmount

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl transition-all duration-500 group
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${quantity > 0
          ? `ring-2 ring-emerald-500 shadow-lg ${isDark ? "shadow-emerald-500/10" : "shadow-emerald-500/20"}`
          : `${isDark ? "hover:shadow-lg hover:shadow-white/5" : "hover:shadow-lg hover:shadow-gray-200/80"}`
        }
        ${justSelected ? "animate-ticket-select" : ""}
        ${isDark
          ? "bg-slate-900 border border-slate-800 hover:border-slate-700"
          : "bg-white border border-gray-200 hover:border-emerald-200"
        }
        ${!isAvailable || isSoldOut ? "opacity-60 hover:opacity-60" : ""}
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Popular/Recommended Badge */}
      {isPopular && isAvailable && !isSoldOut && (
        <div className="absolute top-0 left-0 right-0">
          <div className={`
            flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold
            ${isDark ? "bg-gradient-to-r from-amber-600 to-orange-500 text-white" : "bg-gradient-to-r from-amber-500 to-orange-400 text-white"}
          `}>
            <Star className="w-3 h-3 fill-current" />
            MOST POPULAR
          </div>
        </div>
      )}

      {/* Early Bird Badge */}
      {isEarlyBird && isAvailable && !isPopular && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-primary text-white text-xs font-bold px-3 py-1.5 rounded-bl-lg flex items-center gap-1">
            <Flame className="w-3 h-3" />
            EARLY BIRD
          </div>
        </div>
      )}

      <div className={`p-5 ${isPopular ? "pt-10" : ""}`}>
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
              <div className="mb-3">
                <p
                  className={`
                    text-sm transition-all duration-300
                    ${isDark ? "text-slate-400" : "text-gray-500"}
                    ${!showDescription && hasLongDescription ? "line-clamp-2" : ""}
                  `}
                >
                  {ticket.description}
                </p>
                {hasLongDescription && (
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    className={`
                      text-xs font-medium mt-1 flex items-center gap-0.5 min-h-[44px] sm:min-h-0 py-2 sm:py-0
                      ${isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-600 hover:text-emerald-700"}
                      transition-colors
                    `}
                  >
                    {showDescription ? "Show less" : "Show more"}
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showDescription ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center gap-3 flex-wrap text-sm">
              {isLowStock && (
                <span
                  className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                    ${isDark ? "bg-red-500/20 text-red-400" : "bg-red-50 text-red-600 border border-red-100"}
                    animate-pulse
                  `}
                >
                  <Flame className="w-3 h-3" />
                  Only {remaining} seats left!
                </span>
              )}
              {remaining !== null && remaining > 0 && remaining >= 10 && remaining <= 50 && (
                <span
                  className={`
                    inline-flex items-center gap-1
                    ${isDark ? "text-amber-400" : "text-amber-600"}
                  `}
                >
                  <AlertCircle className="w-4 h-4" />
                  {remaining} seats remaining
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
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                    ${isDark ? "bg-rose-500/20 text-rose-400" : "bg-rose-50 text-rose-600"}
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
                  text-2xl font-black transition-colors duration-200
                  ${quantity > 0
                    ? "text-emerald-600"
                    : isDark ? "text-white" : "text-gray-900"
                  }
                `}
              >
                {ticket.price === 0 ? "FREE" : `\u20B9${Math.round(totalPrice).toLocaleString("en-IN")}`}
              </p>
              {ticket.tax_percentage > 0 && ticket.price > 0 && (
                <p
                  className={`
                    text-xs
                    ${isDark ? "text-slate-500" : "text-gray-400"}
                  `}
                >
                  incl. {ticket.tax_percentage}% GST
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            {isAvailable && !isSoldOut ? (
              <div
                className={`
                  inline-flex items-center gap-1 p-1 rounded-lg transition-all duration-200
                  ${isDark ? "bg-slate-800" : "bg-gray-100"}
                  ${quantity > 0 ? (isDark ? "bg-emerald-500/10" : "bg-emerald-50") : ""}
                `}
              >
                <button
                  onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                  disabled={quantity === 0}
                  className={`
                    p-2.5 rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center
                    active:scale-90
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
                    w-10 text-center font-bold text-lg transition-all duration-200
                    ${quantity > 0 ? "text-emerald-600 scale-110" : ""}
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
                    p-2.5 rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center
                    active:scale-90
                    ${quantity >= maxPerOrder
                      ? "opacity-30 cursor-not-allowed"
                      : isDark
                        ? "hover:bg-slate-700 text-white"
                        : "hover:bg-emerald-100 text-emerald-700"
                    }
                  `}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : isSoldOut && eventId && waitlistEnabled ? (
              <button
                onClick={() => setShowWaitlist(true)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px]
                  ${isDark
                    ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                    : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  }
                  transition-colors active:scale-95
                `}
              >
                <Bell className="w-4 h-4" />
                Join Waitlist
              </button>
            ) : (
              <span
                className={`
                  inline-block px-4 py-2.5 rounded-lg text-sm font-medium
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
              animate-slide-up-fade
              ${isDark ? "border-slate-800" : "border-emerald-100"}
            `}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              Selected
            </span>
            <span
              className={`
                text-sm font-bold
                ${isDark ? "text-white" : "text-gray-900"}
              `}
            >
              Subtotal: {"\u20B9"}{(totalPrice * quantity).toLocaleString()}
            </span>
          </div>
        )}

        {/* Waitlist Form Modal */}
        {showWaitlist && eventId && (
          <div className="mt-4 pt-4 border-t border-gray-200 animate-slide-up-fade">
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
  waitlistEnabled = true,
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
            waitlistEnabled={waitlistEnabled}
          />
        ))}
      </div>
    </div>
  )
}
