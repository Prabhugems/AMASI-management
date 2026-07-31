// Single source of truth for check-in list category colours (Badge
// Printing / Kiosk spec, July 2026: "Colour by category, not per job").
// Every screen that shows a list's colour imports from here -- never
// hardcode a category's colour inline elsewhere.
//
// Exactly three categories, exactly these colours. Never green, amber, or
// red -- those are reserved for scan results (success/warning/error) across
// the kiosk and must never be confused with list identity.
export type ListCategory = "entry_access" | "food_drink" | "goods_kits"

export const LIST_CATEGORIES: { value: ListCategory; label: string; description: string }[] = [
  {
    value: "entry_access",
    label: "Entry & access",
    description: "Registration, hall entry, course entry, sessions",
  },
  {
    value: "food_drink",
    label: "Food & drink",
    description: "Breakfast, lunch, dinner, tea",
  },
  {
    value: "goods_kits",
    label: "Goods & kits",
    description: "Kit, bag, headset, certificate",
  },
]

export const CATEGORY_COLORS: Record<
  ListCategory,
  {
    // Checkin Hub list card icon circle + kiosk menu tile background.
    solid: string
    // Kiosk scan-screen header band background.
    header: string
    // Admin "list pill" badge -- border/background/text, light+dark safe.
    pill: string
    // Small status dot (e.g. group headers, legends).
    dot: string
    // Admin category-picker card -- selected-state border+background.
    formSelected: string
    // Admin category-picker card -- unselected-state hover border.
    formHover: string
  }
> = {
  entry_access: {
    solid: "bg-blue-600",
    header: "bg-blue-600",
    pill: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    formSelected: "border-blue-500 bg-blue-500/10",
    formHover: "hover:border-blue-500/40",
  },
  food_drink: {
    solid: "bg-violet-600",
    header: "bg-violet-600",
    pill: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    formSelected: "border-violet-500 bg-violet-500/10",
    formHover: "hover:border-violet-500/40",
  },
  goods_kits: {
    solid: "bg-cyan-600",
    header: "bg-cyan-600",
    pill: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
    formSelected: "border-cyan-500 bg-cyan-500/10",
    formHover: "hover:border-cyan-500/40",
  },
}

// Every screen that renders a category colour receives `category` typed as
// `ListCategory | null | undefined` in practice (SSR selects, cached
// offline data, etc.) -- this is the one shared fallback for "no category
// yet" so every surface degrades identically instead of each screen
// inventing its own grey.
export function categoryColors(category: ListCategory | null | undefined) {
  return category ? CATEGORY_COLORS[category] : null
}
