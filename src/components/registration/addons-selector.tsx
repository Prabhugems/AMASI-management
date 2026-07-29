"use client"

import { useMemo } from "react"
import { Package, Plus, Minus, GraduationCap, Award, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { REG_THEME } from "@/lib/register-theme"
import { getCurrencySymbol } from "@/lib/utils"

export interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  currency?: string | null
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
  exclusive_group?: string | null // Addons sharing this value are mutually exclusive (e.g. separate "Single Occupancy" / "Twin Sharing" addons, not variants of one addon)
}

export interface AddonVariant {
  id: string
  addon_id: string
  name: string
  price: number
  is_active: boolean
  sort_order: number
  sale_start_date?: string | null
  sale_end_date?: string | null
}

// Mirrors ticket-selector.tsx's isWithinSaleWindow — a variant with no dates
// set is always available (e.g. non-date-based variants like room type).
function isVariantWithinSaleWindow(variant: AddonVariant): boolean {
  const now = new Date()
  if (variant.sale_start_date && now < new Date(variant.sale_start_date)) return false
  if (variant.sale_end_date && now > new Date(variant.sale_end_date)) return false
  return true
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
  maxCourseAddons?: number | null // Cap on distinct is_course addons selected (null = unlimited)
}

// Brand-tinted surface tokens, matching the palette already used elsewhere
// on this registration flow (event picker, ticket selection, checkout) —
// keeps Add-ons visually consistent with the rest of the page instead of a
// hardcoded green regardless of tenant.
const T = {
  primary: REG_THEME.primary,
  primaryBg: `rgba(${REG_THEME.primaryRgb}, 0.05)`,
  primaryBgStrong: `rgba(${REG_THEME.primaryRgb}, 0.08)`,
  primaryBorder: `rgba(${REG_THEME.primaryRgb}, 0.2)`,
  accent: REG_THEME.accent,
} as const

export function AddonsSelector({
  addons,
  selectedAddons,
  onSelectionChange,
  selectedTicketIds = [],
  taxPercentage = 18,
  maxCourseAddons = null,
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

  // Count of distinct course/workshop addons currently selected (qty > 0),
  // regardless of variant — each addon counts once even with multiple variants selected.
  const selectedCourseAddonCount = useMemo(() => {
    const courseAddonIds = new Set(addons.filter(a => a.is_course).map(a => a.id))
    const selectedIds = new Set<string>()
    for (const selected of selectedAddons.values()) {
      if (courseAddonIds.has(selected.addonId)) selectedIds.add(selected.addonId)
    }
    return selectedIds.size
  }, [addons, selectedAddons])

  const isCourseAddonCapped = (addon: Addon, key: string) => {
    if (!addon.is_course || maxCourseAddons == null) return false
    const alreadySelected = selectedAddons.has(key)
    return !alreadySelected && selectedCourseAddonCount >= maxCourseAddons
  }

  const handleQuantityChange = (addon: Addon, delta: number, variantId?: string) => {
    const key = variantId ? `${addon.id}-${variantId}` : addon.id
    const newSelection = new Map(selectedAddons)

    const current = newSelection.get(key)
    const currentQty = current?.quantity || 0
    const newQty = Math.max(0, currentQty + delta)
    const maxQty = addon.max_quantity || 10

    if (newQty === 0) {
      newSelection.delete(key)
    } else if (delta > 0 && currentQty === 0 && isCourseAddonCapped(addon, key)) {
      // Selecting a new distinct course/workshop addon would exceed the cap
    } else if (newQty <= maxQty) {
      // Variants of the same addon are mutually exclusive for a single
      // registration (e.g. a delegate can't book Single Occupancy AND Twin
      // Sharing at once) — clear any other variant of this addon first.
      if (addon.has_variants && variantId) {
        for (const k of Array.from(newSelection.keys())) {
          if (k !== key && k.startsWith(`${addon.id}-`)) {
            newSelection.delete(k)
          }
        }
      }

      // Separate addons (not variants of one addon) can also be marked
      // mutually exclusive via a shared exclusive_group — e.g. "Single
      // Occupancy" and "Twin Sharing" modeled as two distinct addons rather
      // than two variants of one "Accommodation" addon. Clear any other
      // selected addon sharing this group.
      if (addon.exclusive_group) {
        const groupAddonIds = new Set(
          addons.filter(a => a.exclusive_group === addon.exclusive_group).map(a => a.id)
        )
        for (const [k, sel] of Array.from(newSelection.entries())) {
          if (sel.addonId !== addon.id && groupAddonIds.has(sel.addonId)) {
            newSelection.delete(k)
          }
        }
      }

      const variant = addon.variants?.find(v => v.id === variantId)
      const unitPrice = variant ? variant.price : addon.price
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
        <Package className="w-5 h-5" style={{ color: T.primary }} />
        <h3 className="text-lg font-semibold text-gray-900">Add-ons</h3>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Enhance your registration with additional options
      </p>

      <div className="space-y-3">
        {availableAddons.map((addon) => {
          // Workshop/course addons here are named "W01 - Title" or "C01 - Title" —
          // the code isn't decoration, the source form explicitly requires
          // "the exact W-code on payment proof and correspondence", so it's
          // pulled out as its own badge rather than buried in the heading text.
          const codeMatch = addon.name.match(/^([A-Z]\d{2})\s*-\s*(.+)$/)
          const code = codeMatch?.[1]
          const title = codeMatch?.[2] || addon.name

          const visibleVariants = addon.has_variants
            ? (addon.variants || [])
                .filter(v => v.is_active && isVariantWithinSaleWindow(v))
                .sort((a, b) => a.sort_order - b.sort_order)
            : []
          // Date-gating means only one fee slab is ever open at a time in the
          // normal case — rendering a whole "select one of N" grid for a
          // single option wastes space, so that case gets the same compact
          // inline price treatment as a plain (non-variant) addon.
          const singleVariant = visibleVariants.length === 1 ? visibleVariants[0] : undefined
          const showInlinePrice = !addon.has_variants || singleVariant
          const inlinePrice = singleVariant ? singleVariant.price : addon.price
          const inlineVariantId = singleVariant?.id

          return (
          <div
            key={addon.id}
            className="border rounded-2xl p-5 bg-white transition-all duration-200"
            style={{ borderColor: "rgba(28, 25, 23, 0.08)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = T.primaryBorder
              e.currentTarget.style.boxShadow = `0 4px 16px rgba(${REG_THEME.primaryRgb}, 0.08)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(28, 25, 23, 0.08)"
              e.currentTarget.style.boxShadow = "none"
            }}
          >
            <div className="flex items-start gap-3.5">
              {/* Addon Image, Code Badge, or Icon */}
              {addon.image_url ? (
                <img
                  src={addon.image_url}
                  alt={addon.name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                />
              ) : code ? (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: T.primary }}
                >
                  <span
                    className="text-white font-bold text-[13px] leading-none"
                    style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}
                  >
                    {code}
                  </span>
                </div>
              ) : (
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: T.primaryBg }}
                >
                  {addon.is_course ? (
                    <GraduationCap className="w-5 h-5" style={{ color: T.primary }} />
                  ) : (
                    <Package className="w-5 h-5" style={{ color: T.primary }} />
                  )}
                </div>
              )}

              {/* Addon Details */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between sm:block">
                      <h4 className="font-semibold text-gray-900">{title}</h4>
                      {/* Mobile: Price next to title */}
                      {showInlinePrice && (
                        <div className="text-right sm:hidden">
                          <p className="font-bold" style={{ color: T.accent }}>
                            {inlinePrice > 0 ? `${getCurrencySymbol(addon.currency)}${inlinePrice.toLocaleString()}` : "Free"}
                          </p>
                          {singleVariant && (
                            <p className="text-[11px] font-medium" style={{ color: T.primary }}>{singleVariant.name}</p>
                          )}
                          {inlinePrice > 0 && taxPercentage > 0 && (
                            <p className="text-[10px] text-gray-400">+{taxPercentage}% GST</p>
                          )}
                        </div>
                      )}
                    </div>
                    {addon.description && (
                      <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                        {addon.description}
                      </p>
                    )}

                    {/* Course badge & details */}
                    {addon.is_course && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
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

                  {/* Price & Quantity (non-variant addons, or exactly one active fee slab) */}
                  {showInlinePrice && (
                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      {/* Desktop: Price on left of controls */}
                      <div className="hidden sm:block text-right">
                        <p className="font-bold" style={{ color: T.accent }}>
                          {inlinePrice > 0 ? `${getCurrencySymbol(addon.currency)}${inlinePrice.toLocaleString()}` : "Free"}
                        </p>
                        {singleVariant && (
                          <p className="text-[11px] font-medium" style={{ color: T.primary }}>{singleVariant.name}</p>
                        )}
                        {inlinePrice > 0 && taxPercentage > 0 && (
                          <p className="text-[10px] text-gray-400">+{taxPercentage}% GST</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(addon, -1, inlineVariantId)}
                          disabled={getSelectedQuantity(addon.id, inlineVariantId) === 0}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                            getSelectedQuantity(addon.id, inlineVariantId) === 0
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">
                          {getSelectedQuantity(addon.id, inlineVariantId)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(addon, 1, inlineVariantId)}
                          disabled={getSelectedQuantity(addon.id, inlineVariantId) >= (addon.max_quantity || 10) || isCourseAddonCapped(addon, inlineVariantId ? `${addon.id}-${inlineVariantId}` : addon.id)}
                          title={isCourseAddonCapped(addon, inlineVariantId ? `${addon.id}-${inlineVariantId}` : addon.id) ? `You can select up to ${maxCourseAddons} workshops` : undefined}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors text-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          style={
                            getSelectedQuantity(addon.id, inlineVariantId) >= (addon.max_quantity || 10) || isCourseAddonCapped(addon, inlineVariantId ? `${addon.id}-${inlineVariantId}` : addon.id)
                              ? undefined
                              : { background: T.primary }
                          }
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {addon.is_course && maxCourseAddons != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedCourseAddonCount}/{maxCourseAddons} workshops selected
                  </p>
                )}

                {/* Variants — if has_variants is true but the variants array hasn't
                    loaded/come back yet, show a visible placeholder instead of
                    silently rendering nothing (this section previously vanished
                    with no indication anything was missing). */}
                {addon.has_variants && (!addon.variants || addon.variants.length === 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-400 italic">
                      Room type options are loading — refresh if this doesn&apos;t appear.
                    </p>
                  </div>
                )}
                {/* Full selection grid only when genuinely 2+ fee slabs/variants
                    are active at once — the single-slab case is handled by the
                    compact inline price above instead. */}
                {addon.has_variants && visibleVariants.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2.5">
                      Select {addon.variant_type || "variant"}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {visibleVariants
                        .map((variant) => {
                          const selected = getSelectedQuantity(addon.id, variant.id)
                          const variantPrice = variant.price
                          const isSelected = selected > 0
                          return (
                            <div
                              key={variant.id}
                              className="relative border rounded-xl p-3 transition-all duration-200"
                              style={
                                isSelected
                                  ? {
                                      borderColor: T.primary,
                                      background: T.primaryBg,
                                      boxShadow: `0 2px 10px rgba(${REG_THEME.primaryRgb}, 0.12)`,
                                    }
                                  : { borderColor: "rgba(28, 25, 23, 0.1)" }
                              }
                            >
                              {isSelected && (
                                <div
                                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: T.primary }}
                                >
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                </div>
                              )}
                              <div className="mb-2">
                                <span className="text-sm font-medium text-gray-900 block">
                                  {variant.name}
                                </span>
                                <span className="text-sm font-bold" style={{ color: T.accent }}>
                                  {variantPrice > 0 ? `${getCurrencySymbol(addon.currency)}${variantPrice.toLocaleString()}` : "Free"}
                                </span>
                                {variantPrice > 0 && taxPercentage > 0 && (
                                  <span className="text-[10px] text-gray-400 ml-1">
                                    +{taxPercentage}% GST
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(addon, -1, variant.id)}
                                  disabled={selected === 0}
                                  className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                                    selected === 0
                                      ? "bg-gray-100 text-gray-400"
                                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                  )}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">
                                  {selected}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(addon, 1, variant.id)}
                                  disabled={selected >= (addon.max_quantity || 10) || isCourseAddonCapped(addon, `${addon.id}-${variant.id}`)}
                                  title={isCourseAddonCapped(addon, `${addon.id}-${variant.id}`) ? `You can select up to ${maxCourseAddons} workshops` : undefined}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-white disabled:bg-gray-100 disabled:text-gray-400"
                                  style={
                                    selected >= (addon.max_quantity || 10) || isCourseAddonCapped(addon, `${addon.id}-${variant.id}`)
                                      ? undefined
                                      : { background: T.primary }
                                  }
                                >
                                  <Plus className="w-3.5 h-3.5" />
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
          )
        })}
      </div>
    </div>
  )
}
