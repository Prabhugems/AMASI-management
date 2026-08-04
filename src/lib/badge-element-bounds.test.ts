import { describe, it, expect } from "vitest"
import { clampElementToCanvas } from "./badge-element-bounds"

describe("clampElementToCanvas", () => {
  const canvas = { width: 384, height: 576 } // 4x6 badge at 96 DPI

  it("leaves an element that already fits fully within bounds unchanged", () => {
    const result = clampElementToCanvas({ x: 20, y: 30, width: 100, height: 50 }, canvas)
    expect(result).toEqual({ x: 20, y: 30, width: 100, height: 50 })
  })

  it("pulls the right edge back to the canvas width when x + width overflows", () => {
    const result = clampElementToCanvas({ x: 350, y: 30, width: 100, height: 50 }, canvas)
    expect(result.x + result.width).toBeLessThanOrEqual(canvas.width)
    expect(result.width).toBe(100)
    expect(result.x).toBe(284)
  })

  it("pulls the bottom edge back to the canvas height when y + height overflows", () => {
    const result = clampElementToCanvas({ x: 30, y: 550, width: 50, height: 100 }, canvas)
    expect(result.y + result.height).toBeLessThanOrEqual(canvas.height)
    expect(result.height).toBe(100)
    expect(result.y).toBe(476)
  })

  it("clamps negative x back to 0", () => {
    const result = clampElementToCanvas({ x: -40, y: 30, width: 50, height: 50 }, canvas)
    expect(result.x).toBe(0)
  })

  it("clamps negative y back to 0", () => {
    const result = clampElementToCanvas({ x: 30, y: -40, width: 50, height: 50 }, canvas)
    expect(result.y).toBe(0)
  })

  it("shrinks width down to canvas width when the element itself is wider than the canvas", () => {
    const result = clampElementToCanvas({ x: 0, y: 30, width: 500, height: 50 }, canvas)
    expect(result.width).toBe(canvas.width)
    expect(result.x).toBe(0)
  })

  it("shrinks height down to canvas height when the element itself is taller than the canvas", () => {
    const result = clampElementToCanvas({ x: 30, y: 0, width: 50, height: 700 }, canvas)
    expect(result.height).toBe(canvas.height)
    expect(result.y).toBe(0)
  })
})
