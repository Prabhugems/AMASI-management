"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface SlidingCard {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  gradient: string
  iconBg: string
}

interface SlidingCardsProps {
  cards: SlidingCard[]
  className?: string
}

export function SlidingCards({ cards, className }: SlidingCardsProps) {
  const [activeCard, setActiveCard] = React.useState<string>(cards[0]?.id || "")

  return (
    <div className={cn("flex gap-3 h-[200px]", className)}>
      {cards.map((card) => {
        const isActive = activeCard === card.id
        const Icon = card.icon

        return (
          <div
            key={card.id}
            onClick={() => setActiveCard(card.id)}
            className={cn(
              "relative rounded-2xl cursor-pointer overflow-hidden flex items-end transition-all duration-500 ease-slide",
              "shadow-lg hover:shadow-xl",
              card.gradient,
              isActive ? "w-[300px] flex-shrink-0" : "w-[70px] flex-shrink-0"
            )}
          >
            {/* Content Row */}
            <div className="flex items-center w-full p-4">
              {/* Icon */}
              <div
                className={cn(
                  "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
                  card.iconBg
                )}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>

              {/* Description */}
              <div
                className={cn(
                  "ml-3 overflow-hidden transition-all duration-300",
                  isActive
                    ? "opacity-100 translate-y-0 delay-200"
                    : "opacity-0 translate-y-4 w-0"
                )}
              >
                <h4 className="text-white font-semibold text-sm uppercase tracking-wide whitespace-nowrap">
                  {card.title}
                </h4>
                <p className="text-white/70 text-xs mt-0.5 whitespace-nowrap">
                  {card.subtitle}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Variant with values/stats
interface SlidingStatCard {
  id: string
  label: string
  value: string | number
  change?: string
  icon: LucideIcon
  gradient: string
  iconBg: string
}

interface SlidingStatCardsProps {
  cards: SlidingStatCard[]
  className?: string
}

export function SlidingStatCards({ cards, className }: SlidingStatCardsProps) {
  const [activeCard, setActiveCard] = React.useState<string>(cards[0]?.id || "")

  return (
    <div className={cn("flex gap-3 h-[140px]", className)}>
      {cards.map((card) => {
        const isActive = activeCard === card.id
        const Icon = card.icon

        return (
          <div
            key={card.id}
            onClick={() => setActiveCard(card.id)}
            className={cn(
              "relative rounded-2xl cursor-pointer overflow-hidden flex items-center transition-all duration-500 ease-slide",
              "shadow-lg hover:shadow-xl",
              card.gradient,
              isActive ? "w-[280px] flex-shrink-0" : "w-[70px] flex-shrink-0"
            )}
          >
            {/* Content */}
            <div className="flex items-center w-full px-4">
              {/* Icon */}
              <div
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  card.iconBg,
                  isActive ? "scale-100" : "scale-90"
                )}
              >
                <Icon className="h-6 w-6 text-white" />
              </div>

              {/* Stats */}
              <div
                className={cn(
                  "ml-4 overflow-hidden transition-all duration-300",
                  isActive
                    ? "opacity-100 translate-x-0 delay-150"
                    : "opacity-0 -translate-x-4 w-0"
                )}
              >
                <p className="text-white/70 text-xs uppercase tracking-wide whitespace-nowrap">
                  {card.label}
                </p>
                <p className="text-white font-bold text-2xl whitespace-nowrap">
                  {card.value}
                </p>
                {card.change && (
                  <p className="text-white/60 text-xs whitespace-nowrap mt-0.5">
                    {card.change}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Vertical sliding cards variant
interface VerticalSlidingCardsProps {
  cards: SlidingCard[]
  className?: string
}

export function VerticalSlidingCards({ cards, className }: VerticalSlidingCardsProps) {
  const [activeCard, setActiveCard] = React.useState<string>(cards[0]?.id || "")

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {cards.map((card) => {
        const isActive = activeCard === card.id
        const Icon = card.icon

        return (
          <div
            key={card.id}
            onClick={() => setActiveCard(card.id)}
            className={cn(
              "relative rounded-xl cursor-pointer overflow-hidden transition-all duration-500 ease-slide",
              "shadow-md hover:shadow-lg",
              card.gradient,
              isActive ? "h-[100px]" : "h-[50px]"
            )}
          >
            <div className="flex items-center h-full px-4">
              <div
                className={cn(
                  "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                  card.iconBg
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </div>

              <div className="ml-3 flex-1">
                <h4 className="text-white font-medium text-sm">
                  {card.title}
                </h4>
                <p
                  className={cn(
                    "text-white/60 text-xs transition-all duration-300 overflow-hidden",
                    isActive ? "opacity-100 max-h-10 mt-1" : "opacity-0 max-h-0"
                  )}
                >
                  {card.subtitle}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
