import { getTenant } from "@/lib/tenant"

const isEssurg = getTenant() === "essurg"

/**
 * Brand accent palette for the public registration flow (event picker,
 * ticket selection, checkout). Defaults to AMASI's green/gold; ESSURG
 * substitutes its own navy/sky-blue (sampled from the real logo at
 * essurg2026.org) so app.essurg2026.org visually matches the marketing
 * site instead of showing AMASI's colors. Add a branch here for any future
 * white-label tenant instead of hardcoding hex in the register-flow files.
 */
export const REG_THEME = {
  primary: isEssurg ? "#112248" : "#166534",
  primaryDark: isEssurg ? "#0a1730" : "#14532D",
  primaryMid: isEssurg ? "#163a6b" : "#15803D",
  primaryLight: isEssurg ? "#33a8d6" : "#22C55E",
  primaryLighter: isEssurg ? "#0090cb" : "#16A34A",
  primaryDarkest: isEssurg ? "#050d1c" : "#0F3A22",
  primaryRgb: isEssurg ? "17, 34, 72" : "22, 101, 52",
  accent: isEssurg ? "#0090cb" : "#D97706",
  accentLight: isEssurg ? "#33a8d6" : "#F59E0B",
  accentDark: isEssurg ? "#075985" : "#B45309",
  accentPale: isEssurg ? "#7dd3fc" : "#FBBF24",
  accentRgb: isEssurg ? "0, 144, 203" : "217, 119, 6",
} as const
