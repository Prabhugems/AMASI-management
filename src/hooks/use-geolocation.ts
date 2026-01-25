"use client"

import { useState, useEffect, useCallback } from "react"

interface GeolocationState {
  loading: boolean
  error: GeolocationPositionError | null
  position: GeolocationPosition | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  altitude: number | null
  altitudeAccuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number | null
}

interface GeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watch?: boolean
}

/**
 * Get user's geolocation
 *
 * Usage:
 * ```
 * const { latitude, longitude, loading, error } = useGeolocation()
 *
 * // With options
 * const { position } = useGeolocation({
 *   enableHighAccuracy: true,
 *   watch: true
 * })
 * ```
 */
export function useGeolocation(options: GeolocationOptions = {}): GeolocationState & {
  refresh: () => void
  isSupported: boolean
} {
  const { enableHighAccuracy = false, timeout = 10000, maximumAge = 0, watch = false } = options

  const [state, setState] = useState<GeolocationState>({
    loading: true,
    error: null,
    position: null,
    latitude: null,
    longitude: null,
    accuracy: null,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
  })

  const isSupported = typeof navigator !== "undefined" && "geolocation" in navigator

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    setState({
      loading: false,
      error: null,
      position,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
      timestamp: position.timestamp,
    })
  }, [])

  const handleError = useCallback((error: GeolocationPositionError) => {
    setState((prev) => ({
      ...prev,
      loading: false,
      error,
    }))
  }, [])

  const getPosition = useCallback(() => {
    if (!isSupported) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: {
          code: 0,
          message: "Geolocation is not supported",
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError,
      }))
      return
    }

    setState((prev) => ({ ...prev, loading: true }))

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy,
      timeout,
      maximumAge,
    })
  }, [isSupported, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError])

  useEffect(() => {
    if (!isSupported) return

    getPosition()

    if (watch) {
      const watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      )

      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [isSupported, watch, enableHighAccuracy, timeout, maximumAge, handleSuccess, handleError, getPosition])

  return {
    ...state,
    refresh: getPosition,
    isSupported,
  }
}

/**
 * Get distance between two coordinates (in km)
 */
export function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(
  latitude: number,
  longitude: number,
  format: "decimal" | "dms" = "decimal"
): string {
  if (format === "decimal") {
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  }

  // Degrees, Minutes, Seconds format
  const formatDMS = (coord: number, isLat: boolean) => {
    const absolute = Math.abs(coord)
    const degrees = Math.floor(absolute)
    const minutesNotTruncated = (absolute - degrees) * 60
    const minutes = Math.floor(minutesNotTruncated)
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(2)
    const direction = isLat
      ? coord >= 0 ? "N" : "S"
      : coord >= 0 ? "E" : "W"

    return `${degrees}°${minutes}'${seconds}"${direction}`
  }

  return `${formatDMS(latitude, true)} ${formatDMS(longitude, false)}`
}

/**
 * Create Google Maps URL
 */
export function createGoogleMapsUrl(
  latitude: number,
  longitude: number,
  zoom: number = 15
): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}`
}

/**
 * Create directions URL
 */
export function createDirectionsUrl(
  destLat: number,
  destLon: number,
  originLat?: number,
  originLon?: number
): string {
  const destination = `${destLat},${destLon}`
  const origin = originLat && originLon ? `${originLat},${originLon}` : ""

  return `https://www.google.com/maps/dir/${origin}/${destination}`
}
