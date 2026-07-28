import { getTenant } from "@/lib/tenant"

type Palette = {
  primary: string
  primaryDark: string
  primaryMid: string
  primaryLight: string
  primaryLighter: string
  primaryDarkest: string
  primaryRgb: string
  accent: string
  accentLight: string
  accentDark: string
  accentPale: string
  accentRgb: string
}

const DEFAULT_PALETTE: Palette = {
  primary: "#166534",
  primaryDark: "#14532D",
  primaryMid: "#15803D",
  primaryLight: "#22C55E",
  primaryLighter: "#16A34A",
  primaryDarkest: "#0F3A22",
  primaryRgb: "22, 101, 52",
  accent: "#D97706",
  accentLight: "#F59E0B",
  accentDark: "#B45309",
  accentPale: "#FBBF24",
  accentRgb: "217, 119, 6",
}

// ESSURG's own navy/sky-blue (sampled from the real logo at essurg2026.org)
// so app.essurg2026.org visually matches the marketing site instead of
// showing AMASI's colors.
const ESSURG_PALETTE: Palette = {
  primary: "#112248",
  primaryDark: "#0a1730",
  primaryMid: "#163a6b",
  primaryLight: "#33a8d6",
  primaryLighter: "#0090cb",
  primaryDarkest: "#050d1c",
  primaryRgb: "17, 34, 72",
  accent: "#0090cb",
  accentLight: "#33a8d6",
  accentDark: "#075985",
  accentPale: "#7dd3fc",
  accentRgb: "0, 144, 203",
}

// TAMILCON 2026's purple/gold, matching the brochure and the rest of the
// cos-tenant site (landing page, policy pages).
const COS_PALETTE: Palette = {
  primary: "#3B0764",
  primaryDark: "#2A0548",
  primaryMid: "#4C0A82",
  primaryLight: "#8B5CF6",
  primaryLighter: "#7C3AED",
  primaryDarkest: "#1A0330",
  primaryRgb: "59, 7, 100",
  accent: "#C9A24B",
  accentLight: "#E8CD8A",
  accentDark: "#A8822E",
  accentPale: "#F3E4BE",
  accentRgb: "201, 162, 75",
}

const PALETTES: Partial<Record<ReturnType<typeof getTenant>, Palette>> = {
  essurg: ESSURG_PALETTE,
  cos: COS_PALETTE,
}

/**
 * Brand accent palette for the public registration flow (event picker,
 * ticket selection, checkout). Defaults to AMASI's green/gold; white-label
 * tenants substitute their own palette so their registration flow visually
 * matches their marketing site instead of showing AMASI's colors. Add a
 * palette above and register it in PALETTES for any future tenant instead
 * of hardcoding hex in the register-flow files.
 */
export const REG_THEME: Palette = PALETTES[getTenant()] ?? DEFAULT_PALETTE
