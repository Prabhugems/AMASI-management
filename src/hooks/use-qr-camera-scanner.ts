"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"

interface UseQrCameraScannerOptions {
  enabled: boolean
  elementId: string
  onDecode: (text: string) => void
  facingMode?: "environment" | "user"
  fps?: number
  qrboxSize?: number
}

interface UseQrCameraScannerResult {
  cameraError: string | null
  scannerReady: boolean
  retry: () => void
}

// Generic Html5Qrcode lifecycle, extracted from the staff scanner
// (src/app/checkin/access/[accessToken]/page.tsx) so other scan surfaces can
// reuse it without duplicating the start/stop/permission-error handling.
// `onDecode` is kept in a ref so callers don't need to memoize it themselves —
// passing a fresh inline function every render must NOT restart the camera.
export function useQrCameraScanner({
  enabled,
  elementId,
  onDecode,
  facingMode = "environment",
  fps = 10,
  qrboxSize = 250,
}: UseQrCameraScannerOptions): UseQrCameraScannerResult {
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scannerReady, setScannerReady] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isStartingRef = useRef(false)
  const onDecodeRef = useRef(onDecode)
  onDecodeRef.current = onDecode

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch {
        // Ignore — already stopped or never fully started.
      }
      scannerRef.current = null
    }
    setScannerReady(false)
  }, [])

  const startScanner = useCallback(async () => {
    if (isStartingRef.current) return
    isStartingRef.current = true
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop()
        } catch {
          // Ignore
        }
      }

      setCameraError(null)
      setScannerReady(false)

      try {
        const scanner = new Html5Qrcode(elementId)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode },
          {
            fps,
            qrbox: { width: qrboxSize, height: qrboxSize },
            aspectRatio: 1,
          },
          (decodedText: string) => onDecodeRef.current(decodedText),
          () => {}
        )
        setScannerReady(true)
      } catch (err) {
        console.error("Camera error:", err)
        const message = err instanceof Error ? err.message : ""
        setCameraError(
          message.includes("Permission")
            ? "Camera permission denied. Please allow camera access."
            : "Could not access camera. Try manual entry instead."
        )
      }
    } finally {
      isStartingRef.current = false
    }
  }, [elementId, facingMode, fps, qrboxSize])

  useEffect(() => {
    if (enabled) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, facingMode])

  return { cameraError, scannerReady, retry: startScanner }
}
