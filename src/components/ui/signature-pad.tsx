"use client"

import * as React from "react"
import { Eraser, RotateCcw, Download, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SignaturePadProps {
  width?: number
  height?: number
  strokeColor?: string
  strokeWidth?: number
  backgroundColor?: string
  onSave?: (dataUrl: string) => void
  onChange?: (dataUrl: string | null) => void
  className?: string
  disabled?: boolean
}

/**
 * Signature Pad Component
 *
 * Capture handwritten signatures
 *
 * Usage:
 * ```
 * <SignaturePad
 *   onSave={(dataUrl) => saveSignature(dataUrl)}
 *   onChange={(dataUrl) => setSignature(dataUrl)}
 * />
 * ```
 */
export function SignaturePad({
  width = 400,
  height = 200,
  strokeColor = "#000000",
  strokeWidth = 2,
  backgroundColor = "#ffffff",
  onSave,
  onChange,
  className,
  disabled = false,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const contextRef = React.useRef<CanvasRenderingContext2D | null>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [isEmpty, setIsEmpty] = React.useState(true)

  // Initialize canvas
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set up for high DPI displays
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const context = canvas.getContext("2d")
    if (!context) return

    context.scale(dpr, dpr)
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, width, height)
    context.strokeStyle = strokeColor
    context.lineWidth = strokeWidth
    context.lineCap = "round"
    context.lineJoin = "round"

    contextRef.current = context
  }, [width, height, strokeColor, strokeWidth, backgroundColor])

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()

    if ("touches" in e) {
      const touch = e.touches[0]
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      }
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled) return

    const coords = getCoordinates(e)
    if (!coords || !contextRef.current) return

    contextRef.current.beginPath()
    contextRef.current.moveTo(coords.x, coords.y)
    setIsDrawing(true)
    setIsEmpty(false)
  }

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || disabled) return

    const coords = getCoordinates(e)
    if (!coords || !contextRef.current) return

    contextRef.current.lineTo(coords.x, coords.y)
    contextRef.current.stroke()
  }

  const stopDrawing = () => {
    if (!isDrawing) return

    contextRef.current?.closePath()
    setIsDrawing(false)

    // Notify parent of change
    const canvas = canvasRef.current
    if (canvas) {
      onChange?.(canvas.toDataURL("image/png"))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) return

    context.fillStyle = backgroundColor
    context.fillRect(0, 0, width, height)
    context.strokeStyle = strokeColor
    setIsEmpty(true)
    onChange?.(null)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return

    const dataUrl = canvas.toDataURL("image/png")
    onSave?.(dataUrl)
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return

    const link = document.createElement("a")
    link.download = "signature.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg overflow-hidden",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-crosshair"
        )}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="touch-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={disabled || isEmpty}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={download}
          disabled={disabled || isEmpty}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>

        {onSave && (
          <Button
            size="sm"
            onClick={save}
            disabled={disabled || isEmpty}
            className="ml-auto"
          >
            <Check className="h-4 w-4 mr-2" />
            Save
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Draw your signature above using mouse or touch
      </p>
    </div>
  )
}

/**
 * Compact signature input
 */
export function SignatureInput({
  value,
  onChange,
  placeholder = "Click to sign",
  className,
  disabled = false,
}: {
  value?: string | null
  onChange?: (dataUrl: string | null) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleSave = (dataUrl: string) => {
    onChange?.(dataUrl)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange?.(null)
  }

  if (value) {
    return (
      <div className={cn("relative", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt="Signature"
          className="h-16 border rounded-lg bg-white"
        />
        {!disabled && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleClear}
          >
            <Eraser className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={cn(
          "h-16 w-full border-2 border-dashed rounded-lg",
          "flex items-center justify-center text-sm text-muted-foreground",
          "hover:bg-muted/50 transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {placeholder}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-background border rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Draw your signature</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
              >
                <Eraser className="h-4 w-4" />
              </Button>
            </div>
            <SignaturePad
              onSave={handleSave}
              onChange={(url) => url && onChange?.(url)}
            />
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Signature display
 */
export function SignatureDisplay({
  src,
  alt = "Signature",
  className,
}: {
  src: string
  alt?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-block border rounded-lg bg-white p-2",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-12" />
    </div>
  )
}
