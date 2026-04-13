"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Minus, Plus, Clock, Users, Ticket, Check, AlertCircle, Bell, ChevronDown, Star, Flame, Zap } from "lucide-react"
import { TicketType } from "@/lib/types"
import { differenceInDays, differenceInHours, isPast } from "date-fns"
import { WaitlistForm } from "./waitlist-form"

interface TicketSelectorProps {
  tickets: TicketType[]
  selectedTickets: Map<string, number>
  onSelectionChange: (tickets: Map<string, number>) => void
  allowMultipleTicketTypes?: boolean
  eventId?: string
  waitlistEnabled?: boolean
}

function CountdownBadge({ endDate }: { endDate: string; isDark: boolean }) {
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
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [endDate])

  if (timeLeft === "Ended") return null

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.1) 0%, rgba(245, 158, 11, 0.12) 100%)',
        color: '#B45309',
        border: '1px solid rgba(217, 119, 6, 0.15)',
      }}
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
    const timer = setTimeout(() => setIsVisible(true), index * 80)
    return () => clearTimeout(timer)
  }, [index])

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

  const configuredMax = ticket.max_per_order ?? 10
  const _minPerOrder = ticket.min_per_order ?? 1
  const maxPerOrder = remaining !== null ? Math.min(configuredMax, remaining) : configuredMax

  const hasEndDate = ticket.sale_end_date && !isPast(new Date(ticket.sale_end_date))
  const isEarlyBird = ticket.name.toLowerCase().includes("early")
  const isPopular = ticket.metadata?.popular === true || ticket.metadata?.recommended === true
  const isLowStock = remaining !== null && remaining > 0 && remaining < 10

  const taxAmount = (ticket.price * ticket.tax_percentage) / 100
  const totalPrice = ticket.price + taxAmount

  const isSelected = quantity > 0

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        ${justSelected ? "ticket-bounce-select" : ""}
        ${!isAvailable || isSoldOut ? "opacity-60" : ""}
      `}
      style={{
        background: isDark ? '#1E293B' : '#FFFFFF',
        border: isSelected
          ? '2px solid #166534'
          : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(28,25,23,0.08)'}`,
        boxShadow: isSelected
          ? '0 8px 24px rgba(22, 101, 52, 0.12), 0 0 0 1px rgba(22, 101, 52, 0.08)'
          : '0 1px 3px rgba(28, 25, 23, 0.04)',
        transitionDelay: `${index * 80}ms`,
      }}
    >
      {/* ─── Popular Banner ─── */}
      {isPopular && isAvailable && !isSoldOut && (
        <div
          className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-wider uppercase text-white"
          style={{
            background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #D97706 100%)',
            letterSpacing: '0.1em',
          }}
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          Most Popular
        </div>
      )}

      {/* ─── Early Bird Banner ─── */}
      {isEarlyBird && isAvailable && !isPopular && !isSoldOut && (
        <div
          className="flex items-center justify-center gap-2 py-2.5 text-xs font-bold tracking-wider uppercase text-white"
          style={{
            background: 'linear-gradient(135deg, #14532D 0%, #166534 40%, #15803D 100%)',
            letterSpacing: '0.1em',
          }}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          Early Bird Pricing
        </div>
      )}

      <div className={`p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-4 sm:gap-6">
          {/* ─── Ticket Info ─── */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h3
                className="text-lg font-bold"
                style={{ color: isDark ? '#F8FAFC' : '#1C1917' }}
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
                  className={`text-sm leading-relaxed transition-all duration-300 ${
                    !showDescription && (ticket.description?.length || 0) > 100 ? "line-clamp-2" : ""
                  }`}
                  style={{ color: isDark ? '#94A3B8' : '#78716C' }}
                >
                  {ticket.description}
                </p>
                {(ticket.description?.length || 0) > 100 && (
                  <button
                    onClick={() => setShowDescription(!showDescription)}
                    className="text-xs font-semibold mt-1.5 flex items-center gap-0.5 min-h-[44px] sm:min-h-0 py-2 sm:py-0 transition-colors"
                    style={{ color: '#166534' }}
                  >
                    {showDescription ? "Show less" : "Show more"}
                    <ChevronDown
                      className="w-3 h-3 transition-transform duration-200"
                      style={{ transform: showDescription ? 'rotate(180deg)' : 'rotate(0)' }}
                    />
                  </button>
                )}
              </div>
            )}

            {/* ─── Meta badges ─── */}
            <div className="flex items-center gap-2.5 flex-wrap mt-2">
              {isLowStock && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    color: '#DC2626',
                    border: '1px solid rgba(239, 68, 68, 0.12)',
                  }}
                >
                  <Flame className="w-3 h-3" />
                  Only {remaining} left!
                </span>
              )}
              {remaining !== null && remaining > 0 && remaining >= 10 && remaining <= 50 && (
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: isDark ? '#FBBF24' : '#B45309' }}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  {remaining} seats remaining
                </span>
              )}
              {configuredMax <= 5 && !isSoldOut && (
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: isDark ? '#94A3B8' : '#A8A29E' }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Max {configuredMax} per order
                </span>
              )}
              {isSoldOut && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    color: '#DC2626',
                  }}
                >
                  <Users className="w-3.5 h-3.5" />
                  Sold Out
                </span>
              )}
              {isExclusivityBlocked && (
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: '#B45309' }}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Already selected: {disabledByTicket}
                </span>
              )}
            </div>
          </div>

          {/* ─── Price & Quantity ─── */}
          <div className="text-right flex-shrink-0">
            {/* Price */}
            <div className="mb-3">
              <p
                className="text-2xl font-black transition-colors duration-200"
                style={{
                  color: isSelected
                    ? '#166534'
                    : isDark ? '#F8FAFC' : '#1C1917',
                }}
              >
                {ticket.price === 0 ? "FREE" : `\u20B9${Math.round(totalPrice).toLocaleString("en-IN")}`}
              </p>
              {ticket.tax_percentage > 0 && ticket.price > 0 && (
                <p className="text-xs mt-0.5" style={{ color: isDark ? '#475569' : '#A8A29E' }}>
                  incl. {ticket.tax_percentage}% GST
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            {isAvailable && !isSoldOut ? (
              <div
                className="inline-flex items-center gap-0.5 p-1 rounded-xl transition-all duration-200"
                style={{
                  background: isSelected
                    ? 'rgba(22, 101, 52, 0.06)'
                    : isDark ? '#1E293B' : 'rgba(28, 25, 23, 0.04)',
                  border: `1px solid ${isSelected ? 'rgba(22, 101, 52, 0.12)' : 'transparent'}`,
                }}
              >
                <button
                  onClick={() => onQuantityChange(Math.max(0, quantity - 1))}
                  disabled={quantity === 0}
                  className="p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90"
                  style={{
                    opacity: quantity === 0 ? 0.3 : 1,
                    cursor: quantity === 0 ? 'not-allowed' : 'pointer',
                    color: isDark ? '#F8FAFC' : '#44403C',
                  }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span
                  className="w-10 text-center font-bold text-lg transition-all duration-200"
                  style={{
                    color: isSelected ? '#166534' : isDark ? '#F8FAFC' : '#1C1917',
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                  }}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => onQuantityChange(Math.min(maxPerOrder, quantity + 1))}
                  disabled={quantity >= maxPerOrder}
                  className="p-2.5 rounded-lg transition-all min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90"
                  style={{
                    opacity: quantity >= maxPerOrder ? 0.3 : 1,
                    cursor: quantity >= maxPerOrder ? 'not-allowed' : 'pointer',
                    color: isDark ? '#F8FAFC' : '#166534',
                    background: quantity >= maxPerOrder ? 'transparent' : 'rgba(22, 101, 52, 0.06)',
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ) : isSoldOut && eventId && waitlistEnabled ? (
              <button
                onClick={() => setShowWaitlist(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold min-h-[44px] transition-all active:scale-[0.97]"
                style={{
                  background: 'rgba(217, 119, 6, 0.08)',
                  color: '#B45309',
                  border: '1px solid rgba(217, 119, 6, 0.12)',
                }}
              >
                <Bell className="w-4 h-4" />
                Join Waitlist
              </button>
            ) : (
              <span
                className="inline-block px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: isDark ? '#1E293B' : 'rgba(28, 25, 23, 0.04)',
                  color: isDark ? '#475569' : '#A8A29E',
                }}
              >
                Unavailable
              </span>
            )}
          </div>
        </div>

        {/* ─── Selected indicator ─── */}
        {isSelected && (
          <div
            className="mt-5 pt-4 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(22, 101, 52, 0.1)' }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#166534' }}>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: '#166534' }}
              >
                <Check className="w-3 h-3 text-white" />
              </div>
              Selected
            </span>
            <span
              className="text-sm font-bold"
              style={{ color: isDark ? '#F8FAFC' : '#1C1917' }}
            >
              Subtotal: {"\u20B9"}{Math.round(totalPrice * quantity).toLocaleString("en-IN")}
            </span>
          </div>
        )}

        {/* Waitlist Form */}
        {showWaitlist && eventId && (
          <div
            className="mt-5 pt-4"
            style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(28,25,23,0.06)'}` }}
          >
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
  allowMultipleTicketTypes = true,
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
    const ticket = tickets.find(t => t.id === ticketId)

    if (quantity === 0) {
      newSelection.delete(ticketId)
    } else {
      if (!allowMultipleTicketTypes) {
        newSelection.clear()
      }

      if (ticket?.exclusivity_group) {
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

  const isDisabledByExclusivity = (ticketId: string): string | null => {
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket?.exclusivity_group) return null

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

  const sortedTickets = [...tickets].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1
    if (a.status !== "active" && b.status === "active") return 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.price - b.price
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <Ticket className="w-5 h-5" style={{ color: '#166534' }} />
          <h2
            className="text-xl font-bold"
            style={{ color: isDark ? '#F8FAFC' : '#1C1917' }}
          >
            Select {allowMultipleTicketTypes ? "Tickets" : "a Ticket"}
          </h2>
        </div>
        {!allowMultipleTicketTypes && (
          <span className="text-sm" style={{ color: isDark ? '#94A3B8' : '#A8A29E' }}>
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
