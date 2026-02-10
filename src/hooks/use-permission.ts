"use client"

import { useState, useEffect, useCallback } from "react"

type PermissionName =
  | "camera"
  | "microphone"
  | "geolocation"
  | "notifications"
  | "clipboard-read"
  | "clipboard-write"
  | "persistent-storage"
  | "push"

type PermissionState = "granted" | "denied" | "prompt" | "unsupported"

interface UsePermissionReturn {
  state: PermissionState
  isGranted: boolean
  isDenied: boolean
  isPrompt: boolean
  isSupported: boolean
  request: () => Promise<PermissionState>
}

/**
 * Check and request browser permissions
 *
 * Usage:
 * ```
 * const { state, isGranted, request } = usePermission("notifications")
 *
 * if (!isGranted) {
 *   await request()
 * }
 * ```
 */
export function usePermission(permissionName: PermissionName): UsePermissionReturn {
  const [state, setState] = useState<PermissionState>("prompt")
  const [_isSupported, setIsSupported] = useState(true)

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !("permissions" in navigator)) {
      setIsSupported(false)
      setState("unsupported")
      return
    }

    try {
      // Map our permission names to browser API names
      const apiName = mapPermissionName(permissionName)

      if (!apiName) {
        // Use fallback check for permissions not in Permissions API
        const fallbackState = await checkFallbackPermission(permissionName)
        setState(fallbackState)
        return
      }

      const permission = await navigator.permissions.query({
        name: apiName as globalThis.PermissionName,
      })

      setState(permission.state as PermissionState)

      // Listen for permission changes
      permission.addEventListener("change", () => {
        setState(permission.state as PermissionState)
      })
    } catch (_error) {
      // Permission not supported in this browser
      const fallbackState = await checkFallbackPermission(permissionName)
      setState(fallbackState)
    }
  }, [permissionName])

  // Request permission
  const request = useCallback(async (): Promise<PermissionState> => {
    try {
      switch (permissionName) {
        case "notifications": {
          if (!("Notification" in window)) {
            setState("unsupported")
            return "unsupported"
          }
          const result = await Notification.requestPermission()
          const newState = result === "default" ? "prompt" : result
          setState(newState as PermissionState)
          return newState as PermissionState
        }

        case "camera":
        case "microphone": {
          const constraints = {
            video: permissionName === "camera",
            audio: permissionName === "microphone",
          }
          try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints)
            stream.getTracks().forEach((track) => track.stop())
            setState("granted")
            return "granted"
          } catch (_error) {
            setState("denied")
            return "denied"
          }
        }

        case "geolocation": {
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              () => {
                setState("granted")
                resolve("granted")
              },
              (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                  setState("denied")
                  resolve("denied")
                } else {
                  setState("prompt")
                  resolve("prompt")
                }
              }
            )
          })
        }

        case "clipboard-read":
        case "clipboard-write": {
          try {
            if (permissionName === "clipboard-read") {
              await navigator.clipboard.readText()
            } else {
              await navigator.clipboard.writeText("")
            }
            setState("granted")
            return "granted"
          } catch {
            setState("denied")
            return "denied"
          }
        }

        case "push": {
          if (!("PushManager" in window)) {
            setState("unsupported")
            return "unsupported"
          }
          // Push permission is tied to notification permission
          const result = await Notification.requestPermission()
          const newState = result === "default" ? "prompt" : result
          setState(newState as PermissionState)
          return newState as PermissionState
        }

        case "persistent-storage": {
          if (!navigator.storage?.persist) {
            setState("unsupported")
            return "unsupported"
          }
          const persisted = await navigator.storage.persist()
          const newState = persisted ? "granted" : "denied"
          setState(newState)
          return newState
        }

        default:
          return state
      }
    } catch (_error) {
      setState("denied")
      return "denied"
    }
  }, [permissionName, state])

  useEffect(() => {
    checkPermission()
  }, [checkPermission])

  return {
    state,
    isGranted: state === "granted",
    isDenied: state === "denied",
    isPrompt: state === "prompt",
    isSupported: state !== "unsupported",
    request,
  }
}

/**
 * Map our permission names to Permissions API names
 */
function mapPermissionName(name: PermissionName): string | null {
  const mapping: Record<string, string | null> = {
    camera: "camera",
    microphone: "microphone",
    geolocation: "geolocation",
    notifications: "notifications",
    "clipboard-read": "clipboard-read",
    "clipboard-write": "clipboard-write",
    "persistent-storage": "persistent-storage",
    push: "push",
  }
  return mapping[name] ?? null
}

/**
 * Fallback permission checks for browsers without Permissions API
 */
async function checkFallbackPermission(
  name: PermissionName
): Promise<PermissionState> {
  switch (name) {
    case "notifications":
      if (!("Notification" in window)) return "unsupported"
      return Notification.permission === "default"
        ? "prompt"
        : (Notification.permission as PermissionState)

    case "geolocation":
      if (!("geolocation" in navigator)) return "unsupported"
      return "prompt"

    case "camera":
    case "microphone":
      if (!navigator.mediaDevices?.getUserMedia) return "unsupported"
      return "prompt"

    case "clipboard-read":
    case "clipboard-write":
      if (!navigator.clipboard) return "unsupported"
      return "prompt"

    case "push":
      if (!("PushManager" in window)) return "unsupported"
      return "prompt"

    case "persistent-storage":
      if (!navigator.storage?.persist) return "unsupported"
      return "prompt"

    default:
      return "prompt"
  }
}

/**
 * Hook to check multiple permissions at once
 */
export function usePermissions(
  permissionNames: PermissionName[]
): Record<PermissionName, UsePermissionReturn> {
  const results: Record<string, UsePermissionReturn> = {}

  for (const name of permissionNames) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    results[name] = usePermission(name)
  }

  return results as Record<PermissionName, UsePermissionReturn>
}

/**
 * Request multiple permissions at once
 */
export async function requestPermissions(
  permissionNames: PermissionName[]
): Promise<Record<PermissionName, PermissionState>> {
  const results: Record<string, PermissionState> = {}

  for (const name of permissionNames) {
    // Request each permission sequentially
    switch (name) {
      case "notifications":
        if ("Notification" in window) {
          const result = await Notification.requestPermission()
          results[name] = result === "default" ? "prompt" : result
        } else {
          results[name] = "unsupported"
        }
        break

      case "geolocation":
        results[name] = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve("granted"),
            () => resolve("denied")
          )
        })
        break

      default:
        results[name] = "prompt"
    }
  }

  return results as Record<PermissionName, PermissionState>
}
