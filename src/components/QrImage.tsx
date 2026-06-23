"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

/**
 * Renders a QR code locally (via the `qrcode` lib) instead of calling
 * api.qrserver.com. Keeps tokens / verify URLs / access links off third-party
 * services and works offline at the check-in desk.
 */
export function QrImage({
  value,
  size = 200,
  className,
  light = "#ffffff",
  dark = "#000000",
}: {
  value: string
  size?: number
  className?: string
  light?: string
  dark?: string
}) {
  const [src, setSrc] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    if (!value) {
      setSrc("")
      return
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { light, dark },
    })
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc("")
      })
    return () => {
      cancelled = true
    }
  }, [value, size, light, dark])

  if (!src) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}
        aria-label="QR code unavailable"
      />
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} className={className} alt="QR code" />
}
