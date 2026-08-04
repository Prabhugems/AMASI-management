export interface BadgeElementRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasSize {
  width: number
  height: number
}

/**
 * Keeps a badge element's box fully inside the badge canvas. Oversized
 * elements are shrunk to the canvas dimension first, then repositioned
 * against 0 and (canvasDimension - elementDimension) so they never sit
 * off the right/bottom edge the way an unclamped drag or resize can.
 */
export function clampElementToCanvas(rect: BadgeElementRect, canvas: CanvasSize): BadgeElementRect {
  const width = Math.min(rect.width, canvas.width)
  const height = Math.min(rect.height, canvas.height)
  const x = Math.min(Math.max(rect.x, 0), canvas.width - width)
  const y = Math.min(Math.max(rect.y, 0), canvas.height - height)
  return { x, y, width, height }
}
