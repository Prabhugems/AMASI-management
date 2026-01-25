"use client"

import { useState, useMemo } from "react"
import { Package, Plus, Minus, GraduationCap, Award, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  max_quantity: number | null
  image_url: string | null
  has_variants: boolean
  variant_type: string | null
  is_course: boolean
  certificate_template_id: string | null
  course_description: string | null
  course_duration: string | null
  course_instructor: string | null
  variants?: AddonVariant[]
  linked_ticket_ids?: string[] // Ticket IDs this addon is linked to
}

export interface AddonVariant {
  id: string
  addon_id: string
  name: string
  price_adjustment: number
  is_available: boolean
  sort_order: number
}

export interface SelectedAddon {
  addonId: string
  variantId?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface AddonsSelectorProps {
  addons: Addon[]
  selectedAddons: Map<string, SelectedAddon>
  onSelectionChange: (selection: Map<string, SelectedAddon>) => void
  selectedTicketIds?: string[] // All selected ticket IDs for filtering
  taxPercentage?: number // GST percentage to display
}

export function AddonsSelector({
  addons,
  selectedAddons,
  onSelectionChange,
  selectedTicketIds = [],
  taxPercentage = 18,
}: AddonsSelectorProps) {
  // Filter available addons based on ticket linking
  const availableAddons = useMemo(() => {
    return addons.filter(addon => {
      // Basic availability check
      if (addon.price < 0) return false

      // If addon has no ticket links, it's available for all tickets
      if (!addon.linked_ticket_ids || addon.linked_ticket_ids.length === 0) {
        return true
      }

      // If addon has ticket links, check if any selected ticket matches
      return selectedTicketIds.some(ticketId =>
        addon.linked_ticket_ids?.includes(ticketId)
      )
    })
  }, [addons, selectedTicketIds])

  const handleQuantityChange = (addon: Addon, delta: number, variantId?: string) => {
    const key = variantId ? `${addon.id}-${variantId}` : addon.id
    const newSelection = new Map(selectedAddons)

    const current = newSelection.get(key)
    const currentQty = current?.quantity || 0
    const newQty = Math.max(0, currentQty + delta)
    const maxQty = addon.max_quantity || 10

    if (newQty === 0) {
      newSelection.delete(key)
    } else if (newQty <= maxQty) {
      const variant = addon.variants?.find(v => v.id === variantId)
      const unitPrice = addon.price + (variant?.price_adjustment || 0)
      newSelection.set(key, {
        addonId: addon.id,
        variantId,
        quantity: newQty,
        unitPrice,
        totalPrice: unitPrice * newQty,
      })
    }

    onSelectionChange(newSelection)
  }

  const getSelectedQuantity = (addonId: string, variantId?: string) => {
    const key = variantId ? `${addonId}-${variantId}` : addonId
    return selectedAddons.get(key)?.quantity || 0
  }

  if (availableAddons.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-5 h-5 text-emerald-600" />
        <h3 className="text-lg font-semibold text-gray-900">Add-ons</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Enhance your registration with additional options
      </p>

      <div className="space-y-3">
        {availableAddons.map((addon) => (
          <div
            key={addon.id}
            className="border border-gray-200 rounded-xl p-4 bg-white hover:border-emerald-200 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Addon Image or Icon */}
              {addon.image_url ? (
                <img
                  src={addon.image_url}
                  alt={addon.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  {addon.is_course ? (
                    <GraduationCap className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <Package className="w-8 h-8 text-emerald-600" />
                  )}
                </div>
              )}

              {/* Addon Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{addon.name}</h4>
                    {addon.description && (
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                        {addon.description}
                      </p>
                    )}

                    {/* Course badge & details */}
                    {addon.is_course && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                          <Award className="w-3 h-3" />
                          Course with Certificate
                        </span>
                        {addon.course_instructor && (
                          <span className="text-xs text-gray-500">
                            by {addon.course_instructor}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price & Quantity (for non-variant addons) */}
                  {!addon.has_variants && (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">
                          {addon.price > 0 ? `₹${addon.price.toLocaleString()}` : "Free"}
                        </p>
                        {addon.price > 0 && taxPercentage > 0 && (
                          <p className="text-[10px] text-gray-400">+{taxPercentage}% GST</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(addon, -1)}
                          disabled={getSelectedQuantity(addon.id) === 0}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            getSelectedQuantity(addon.id) === 0
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">
                          {getSelectedQuantity(addon.id)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(addon, 1)}
                          disabled={getSelectedQuantity(addon.id) >= (addon.max_quantity || 10)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            getSelectedQuantity(addon.id) >= (addon.max_quantity || 10)
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variants */}
                {addon.has_variants && addon.variants && addon.variants.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      Select {addon.variant_type || "variant"}:
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {addon.variants
                        .filter(v => v.is_available)
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((variant) => {
                          const selected = getSelectedQuantity(addon.id, variant.id)
                          const variantPrice = addon.price + variant.price_adjustment
                          return (
                            <div
                              key={variant.id}
                              className={cn(
                                "border rounded-lg p-2 transition-all",
                                selected > 0
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-gray-200 hover:border-emerald-200"
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {variant.name}
                                </span>
                                <div className="text-right">
                                  <span className="text-xs text-emerald-600 font-semibold">
                                    {variantPrice > 0 ? `₹${variantPrice}` : "Free"}
                                  </span>
                                  {variantPrice > 0 && taxPercentage > 0 && (
                                    <p className="text-[8px] text-gray-400">+GST</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(addon, -1, variant.id)}
                                  disabled={selected === 0}
                                  className={cn(
                                    "w-6 h-6 rounded flex items-center justify-center text-xs",
                                    selected === 0
                                      ? "bg-gray-100 text-gray-400"
                                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  )}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">
                                  {selected}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(addon, 1, variant.id)}
                                  disabled={selected >= (addon.max_quantity || 10)}
                                  className={cn(
                                    "w-6 h-6 rounded flex items-center justify-center text-xs",
                                    selected >= (addon.max_quantity || 10)
                                      ? "bg-gray-100 text-gray-400"
                                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                                  )}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
