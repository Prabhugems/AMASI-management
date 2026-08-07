export const BADGE_SIZES: Record<string, { width: number; height: number; label: string }> = {
  "4x3": { width: 384, height: 288, label: '4" × 3"' },
  "3x4": { width: 288, height: 384, label: '3" × 4"' },
  "4x6": { width: 384, height: 576, label: '4" × 6"' },
  "3.5x2": { width: 336, height: 192, label: '3.5" × 2"' },
  "62x86": { width: 234, height: 325, label: "62mm × 86mm (Brother QL)" },
  A6: { width: 397, height: 559, label: "A6" },
}

export interface BadgeElement {
  id: string
  type: "text" | "qr_code" | "image" | "shape" | "line" | "barcode" | "photo"
  x: number
  y: number
  width: number
  height: number
  content?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: "normal" | "bold"
  fontStyle?: "normal" | "italic"
  textCase?: "none" | "uppercase" | "lowercase" | "capitalize"
  letterSpacing?: number
  lineHeight?: number
  color?: string
  backgroundColor?: string
  align?: "left" | "center" | "right"
  borderRadius?: number
  borderWidth?: number
  borderColor?: string
  opacity?: number
  locked?: boolean
  visible?: boolean
  imageUrl?: string
  zIndex: number
  lineStyle?: "solid" | "dashed" | "dotted"
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  rotation?: number
  shapeType?: "rectangle" | "circle" | "rounded" | "triangle"
  barcodeFormat?: "CODE128" | "CODE39" | "EAN13" | "UPC"
  gradient?: {
    enabled: boolean
    type: "linear" | "radial"
    colors: string[]
    angle?: number
  }
}

export interface BadgeTemplate {
  id: string
  name: string
  size: keyof typeof BADGE_SIZES
  backgroundColor: string
  backgroundImageUrl: string | null
  elements: BadgeElement[]
}
