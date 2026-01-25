"use client"

import { useState, useEffect, useMemo } from "react"

interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isIOS: boolean
  isAndroid: boolean
  isSafari: boolean
  isChrome: boolean
  isFirefox: boolean
  isEdge: boolean
  isOpera: boolean
  isTouchDevice: boolean
  isStandalone: boolean // PWA installed
  deviceType: "mobile" | "tablet" | "desktop"
  os: "ios" | "android" | "windows" | "macos" | "linux" | "unknown"
  browser: "safari" | "chrome" | "firefox" | "edge" | "opera" | "unknown"
}

/**
 * Detect device type and capabilities
 *
 * Usage:
 * ```
 * const { isMobile, isTablet, isDesktop, deviceType, os, browser } = useDeviceDetect()
 *
 * if (isMobile) {
 *   // Show mobile UI
 * }
 * ```
 */
export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(getDeviceInfo())

  useEffect(() => {
    setDeviceInfo(getDeviceInfo())

    const handleResize = () => {
      setDeviceInfo(getDeviceInfo())
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return deviceInfo
}

/**
 * Get device information
 */
function getDeviceInfo(): DeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return getDefaultDeviceInfo()
  }

  const ua = navigator.userAgent.toLowerCase()
  const width = window.innerWidth

  // Device type detection
  const isMobileUA =
    /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
  const isTabletUA = /ipad|android(?!.*mobile)/i.test(ua)

  // Width-based detection as fallback
  const isMobile = isMobileUA && width < 768
  const isTablet = isTabletUA || (isMobileUA && width >= 768 && width < 1024)
  const isDesktop = !isMobile && !isTablet

  // OS detection
  const isIOS = /iphone|ipad|ipod/.test(ua)
  const isAndroid = /android/.test(ua)
  const isWindows = /windows/.test(ua)
  const isMacOS = /macintosh|mac os x/.test(ua) && !isIOS
  const isLinux = /linux/.test(ua) && !isAndroid

  // Browser detection
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua)
  const isChrome = /chrome/.test(ua) && !/edge|edg/.test(ua)
  const isFirefox = /firefox/.test(ua)
  const isEdge = /edge|edg/.test(ua)
  const isOpera = /opera|opr/.test(ua)

  // Touch detection
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0

  // PWA standalone detection
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true

  // Determine device type
  const deviceType: DeviceInfo["deviceType"] = isMobile
    ? "mobile"
    : isTablet
    ? "tablet"
    : "desktop"

  // Determine OS
  const os: DeviceInfo["os"] = isIOS
    ? "ios"
    : isAndroid
    ? "android"
    : isWindows
    ? "windows"
    : isMacOS
    ? "macos"
    : isLinux
    ? "linux"
    : "unknown"

  // Determine browser
  const browser: DeviceInfo["browser"] = isSafari
    ? "safari"
    : isChrome
    ? "chrome"
    : isFirefox
    ? "firefox"
    : isEdge
    ? "edge"
    : isOpera
    ? "opera"
    : "unknown"

  return {
    isMobile,
    isTablet,
    isDesktop,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isFirefox,
    isEdge,
    isOpera,
    isTouchDevice,
    isStandalone,
    deviceType,
    os,
    browser,
  }
}

function getDefaultDeviceInfo(): DeviceInfo {
  return {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isFirefox: false,
    isEdge: false,
    isOpera: false,
    isTouchDevice: false,
    isStandalone: false,
    deviceType: "desktop",
    os: "unknown",
    browser: "unknown",
  }
}

/**
 * Hook to check if device is mobile
 */
export function useIsMobile(): boolean {
  const { isMobile } = useDeviceDetect()
  return isMobile
}

/**
 * Hook to check if device is tablet
 */
export function useIsTablet(): boolean {
  const { isTablet } = useDeviceDetect()
  return isTablet
}

/**
 * Hook to check if device is desktop
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useDeviceDetect()
  return isDesktop
}

/**
 * Hook to check if device supports touch
 */
export function useIsTouchDevice(): boolean {
  const { isTouchDevice } = useDeviceDetect()
  return isTouchDevice
}

/**
 * Hook to check if app is running as PWA
 */
export function useIsPWA(): boolean {
  const { isStandalone } = useDeviceDetect()
  return isStandalone
}

/**
 * Get device orientation
 */
export function useOrientation(): "portrait" | "landscape" {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    typeof window !== "undefined" && window.innerHeight > window.innerWidth
      ? "portrait"
      : "landscape"
  )

  useEffect(() => {
    const handleResize = () => {
      setOrientation(
        window.innerHeight > window.innerWidth ? "portrait" : "landscape"
      )
    }

    window.addEventListener("resize", handleResize)
    window.addEventListener("orientationchange", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("orientationchange", handleResize)
    }
  }, [])

  return orientation
}

/**
 * Check if browser supports a specific feature
 */
export function useFeatureSupport(feature: string): boolean {
  return useMemo(() => {
    if (typeof window === "undefined") return false

    switch (feature) {
      case "webgl":
        try {
          const canvas = document.createElement("canvas")
          return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext("webgl") ||
              canvas.getContext("experimental-webgl"))
          )
        } catch {
          return false
        }

      case "webp":
        const canvas = document.createElement("canvas")
        canvas.width = 1
        canvas.height = 1
        return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0

      case "serviceWorker":
        return "serviceWorker" in navigator

      case "pushNotifications":
        return "PushManager" in window

      case "notifications":
        return "Notification" in window

      case "geolocation":
        return "geolocation" in navigator

      case "clipboard":
        return "clipboard" in navigator

      case "share":
        return "share" in navigator

      case "bluetooth":
        return "bluetooth" in navigator

      case "vibrate":
        return "vibrate" in navigator

      case "speechRecognition":
        return "SpeechRecognition" in window || "webkitSpeechRecognition" in window

      case "indexedDB":
        return "indexedDB" in window

      case "localStorage":
        try {
          localStorage.setItem("test", "test")
          localStorage.removeItem("test")
          return true
        } catch {
          return false
        }

      default:
        return feature in window || feature in navigator
    }
  }, [feature])
}
