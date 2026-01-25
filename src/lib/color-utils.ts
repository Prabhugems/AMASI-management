/**
 * Color Utilities
 *
 * Color manipulation, contrast, and accessibility
 */

interface RGB {
  r: number
  g: number
  b: number
}

interface HSL {
  h: number
  s: number
  l: number
}

/**
 * Parse color string to RGB
 */
export function parseColor(color: string): RGB | null {
  // Hex color
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    }
  }

  // Short hex
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i)
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
    }
  }

  // RGB(A)
  const rgbMatch = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    }
  }

  return null
}

/**
 * Convert RGB to hex
 */
export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360
  s /= 100
  l /= 100

  let r: number, g: number, b: number

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Get relative luminance for contrast calculation
 */
export function getLuminance({ r, g, b }: RGB): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 * WCAG 2.0 recommends:
 * - 4.5:1 for normal text
 * - 3:1 for large text (18pt+ or 14pt+ bold)
 * - 7:1 for AAA level
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = parseColor(color1)
  const rgb2 = parseColor(color2)

  if (!rgb1 || !rgb2) return 0

  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast meets WCAG requirements
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  level: "AA" | "AAA" = "AA",
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)

  if (level === "AAA") {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  }

  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * Get best text color (black or white) for a background
 */
export function getTextColorForBackground(
  background: string,
  lightColor = "#ffffff",
  darkColor = "#000000"
): string {
  const rgb = parseColor(background)
  if (!rgb) return darkColor

  const luminance = getLuminance(rgb)
  return luminance > 0.179 ? darkColor : lightColor
}

/**
 * Lighten a color by percentage
 */
export function lighten(color: string, amount: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  const hsl = rgbToHsl(rgb)
  hsl.l = Math.min(100, hsl.l + amount)

  return rgbToHex(hslToRgb(hsl))
}

/**
 * Darken a color by percentage
 */
export function darken(color: string, amount: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  const hsl = rgbToHsl(rgb)
  hsl.l = Math.max(0, hsl.l - amount)

  return rgbToHex(hslToRgb(hsl))
}

/**
 * Adjust color saturation
 */
export function saturate(color: string, amount: number): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  const hsl = rgbToHsl(rgb)
  hsl.s = Math.min(100, Math.max(0, hsl.s + amount))

  return rgbToHex(hslToRgb(hsl))
}

/**
 * Mix two colors
 */
export function mixColors(color1: string, color2: string, weight = 0.5): string {
  const rgb1 = parseColor(color1)
  const rgb2 = parseColor(color2)

  if (!rgb1 || !rgb2) return color1

  return rgbToHex({
    r: Math.round(rgb1.r * weight + rgb2.r * (1 - weight)),
    g: Math.round(rgb1.g * weight + rgb2.g * (1 - weight)),
    b: Math.round(rgb1.b * weight + rgb2.b * (1 - weight)),
  })
}

/**
 * Generate a color palette from a base color
 */
export function generatePalette(
  baseColor: string
): Record<string, string> {
  return {
    50: lighten(baseColor, 45),
    100: lighten(baseColor, 40),
    200: lighten(baseColor, 30),
    300: lighten(baseColor, 20),
    400: lighten(baseColor, 10),
    500: baseColor,
    600: darken(baseColor, 10),
    700: darken(baseColor, 20),
    800: darken(baseColor, 30),
    900: darken(baseColor, 40),
    950: darken(baseColor, 45),
  }
}

/**
 * Generate complementary color
 */
export function getComplementary(color: string): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  const hsl = rgbToHsl(rgb)
  hsl.h = (hsl.h + 180) % 360

  return rgbToHex(hslToRgb(hsl))
}

/**
 * Generate analogous colors
 */
export function getAnalogous(color: string, angle = 30): [string, string, string] {
  const rgb = parseColor(color)
  if (!rgb) return [color, color, color]

  const hsl = rgbToHsl(rgb)

  const color1: HSL = { ...hsl, h: (hsl.h - angle + 360) % 360 }
  const color2: HSL = { ...hsl, h: (hsl.h + angle) % 360 }

  return [
    rgbToHex(hslToRgb(color1)),
    color,
    rgbToHex(hslToRgb(color2)),
  ]
}

/**
 * Generate triadic colors
 */
export function getTriadic(color: string): [string, string, string] {
  const rgb = parseColor(color)
  if (!rgb) return [color, color, color]

  const hsl = rgbToHsl(rgb)

  const color1: HSL = { ...hsl, h: (hsl.h + 120) % 360 }
  const color2: HSL = { ...hsl, h: (hsl.h + 240) % 360 }

  return [color, rgbToHex(hslToRgb(color1)), rgbToHex(hslToRgb(color2))]
}

/**
 * Check if a color is light or dark
 */
export function isLightColor(color: string): boolean {
  const rgb = parseColor(color)
  if (!rgb) return true

  return getLuminance(rgb) > 0.179
}

/**
 * Format color for CSS
 */
export function formatColor(
  color: string,
  format: "hex" | "rgb" | "hsl" = "hex"
): string {
  const rgb = parseColor(color)
  if (!rgb) return color

  switch (format) {
    case "rgb":
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    case "hsl":
      const hsl = rgbToHsl(rgb)
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
    default:
      return rgbToHex(rgb)
  }
}
