"use client"

import { useState, useEffect, useRef } from "react"
import QRCode from "qrcode"
import JsBarcode from "jsbarcode"
import { QrCode, ImageIcon, UserCircle } from "lucide-react"
import type { BadgeElement } from "@/lib/badge-template-types"
import { replacePlaceholders, applyTextCase, type BadgeRegistrationLike, type BadgeEventLike } from "@/lib/badge-placeholders"

export type BadgeRenderMode = "placeholder" | "sample" | "live"

function getGradientStyle(el: BadgeElement): string | undefined {
  if (el.gradient?.enabled && el.gradient.colors.length >= 2) {
    if (el.gradient.type === "radial") {
      return `radial-gradient(circle, ${el.gradient.colors.join(", ")})`
    }
    return `linear-gradient(${el.gradient.angle || 0}deg, ${el.gradient.colors.join(", ")})`
  }
  return undefined
}

function QRCodeContent({ value, size, isSample }: { value: string; size: number; isSample: boolean }) {
  const [qrUrl, setQrUrl] = useState("")
  useEffect(() => {
    if (isSample) return
    QRCode.toDataURL(value || "PREVIEW", { width: size * 2, margin: 1, errorCorrectionLevel: "M" }).then(setQrUrl).catch(() => {})
  }, [value, size, isSample])
  if (isSample) {
    return (
      <div className="w-full h-full bg-white border border-dashed border-muted-foreground/40 flex items-center justify-center rounded">
        <QrCode className="h-1/2 w-1/2 text-muted-foreground/50" />
      </div>
    )
  }
  if (!qrUrl) return <div className="w-full h-full bg-muted flex items-center justify-center rounded"><QrCode className="h-6 w-6 text-muted-foreground" /></div>
  return <img src={qrUrl} alt="QR" className="w-full h-full object-contain" />
}

function BarcodeContent({ value, format, width: _width, height }: { value: string; format: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: format as string,
          width: 2,
          height: Math.max(30, height - 20),
          displayValue: true,
          fontSize: 12,
          margin: 5,
        })
      } catch {
        // Invalid barcode value
      }
    }
  }, [value, format, height])
  return (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%" }} />
    </div>
  )
}

export interface BadgeElementViewProps {
  element: BadgeElement
  mode: BadgeRenderMode
  registration?: BadgeRegistrationLike
  event?: BadgeEventLike
  scale?: number
}

export function BadgeElementView({ element, mode, registration, event, scale = 1 }: BadgeElementViewProps) {
  const isPlaceholder = mode === "placeholder"
  const isSample = mode === "sample"

  const rawContent = isPlaceholder ? (element.content || "") : replacePlaceholders(element.content || "", registration, event)
  const content = element.type === "text" ? applyTextCase(rawContent, element.textCase) : rawContent
  const qrValue = isPlaceholder ? "PREVIEW-QR" : replacePlaceholders(element.content || "", registration, event)
  const barcodeValue = isPlaceholder ? "PREVIEW123" : replacePlaceholders(element.content || "", registration, event)

  if (element.type === "qr_code") {
    return <QRCodeContent value={qrValue} size={Math.min(element.width, element.height) * scale} isSample={isSample} />
  }
  if (element.type === "barcode") {
    return <BarcodeContent value={barcodeValue} format={element.barcodeFormat || "CODE128"} width={element.width * scale} height={element.height * scale} />
  }
  if (element.type === "photo") {
    return element.imageUrl ? (
      <img src={element.imageUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: element.borderRadius || 0, borderWidth: element.borderWidth || 0, borderColor: element.borderColor || "transparent", borderStyle: "solid" }} />
    ) : (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300" style={{ borderRadius: element.borderRadius || 0 }}>
        <UserCircle className="h-8 w-8" />
      </div>
    )
  }
  if (element.type === "shape") {
    const gradientBg = getGradientStyle(element)
    if (element.shapeType === "triangle") {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
            <polygon points="50,0 100,100 0,100" fill={element.backgroundColor || "#e5e7eb"} />
          </svg>
        </div>
      )
    }
    if (element.shapeType === "circle") {
      return (
        <div className="w-full h-full rounded-full" style={{
          backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
          backgroundImage: gradientBg,
          borderWidth: element.borderWidth || 0,
          borderColor: element.borderColor || "transparent",
          borderStyle: "solid",
        }} />
      )
    }
    return (
      <div className="w-full h-full" style={{
        backgroundColor: gradientBg ? undefined : (element.backgroundColor || "#e5e7eb"),
        backgroundImage: gradientBg,
        borderRadius: element.borderRadius || 0,
        borderWidth: element.borderWidth || 0,
        borderColor: element.borderColor || "transparent",
        borderStyle: "solid",
      }} />
    )
  }
  if (element.type === "image") {
    return element.imageUrl ? (
      <img src={element.imageUrl} alt="" className="w-full h-full object-contain" />
    ) : (
      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded">
        <ImageIcon className="h-6 w-6" />
      </div>
    )
  }
  if (element.type === "line") {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: element.height * scale }}>
        <div className="w-full" style={{
          height: Math.max(1, element.height) * scale,
          backgroundColor: element.color || "#000000",
          backgroundImage: element.lineStyle !== "solid"
            ? `repeating-linear-gradient(90deg, ${element.color || "#000000"} 0px, ${element.color || "#000000"} ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "8px" : "2px"}, transparent ${element.lineStyle === "dashed" ? "12px" : "4px"})`
            : "none",
        }} />
      </div>
    )
  }
  const shadowStyle = element.shadowEnabled ? `${element.shadowOffsetX || 2}px ${element.shadowOffsetY || 2}px ${element.shadowBlur || 4}px ${element.shadowColor || "rgba(0,0,0,0.3)"}` : "none"
  return (
    <div className="w-full h-full flex items-center overflow-hidden whitespace-pre-wrap" style={{
      fontSize: (element.fontSize || 14) * scale,
      fontFamily: element.fontFamily || "Arial, sans-serif",
      fontWeight: element.fontWeight || "normal",
      fontStyle: element.fontStyle || "normal",
      color: element.color || "#000000",
      textAlign: element.align || "left",
      justifyContent: element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start",
      backgroundColor: element.backgroundColor || "transparent",
      lineHeight: element.lineHeight || 1.3,
      letterSpacing: element.letterSpacing ? `${element.letterSpacing}px` : "normal",
      textShadow: shadowStyle,
      borderWidth: element.borderWidth || 0,
      borderColor: element.borderColor || "transparent",
      borderStyle: element.borderWidth ? "solid" : "none",
      borderRadius: element.borderRadius || 0,
    }}>
      {content}
    </div>
  )
}
