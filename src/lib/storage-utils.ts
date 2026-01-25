/**
 * Storage Utilities
 *
 * Local storage with expiry, type safety, and fallbacks
 */

interface StorageOptions {
  expiresIn?: number // milliseconds
  prefix?: string
}

interface StoredItem<T> {
  value: T
  expiresAt?: number
  createdAt: number
}

const DEFAULT_PREFIX = "app_"

/**
 * Set item in localStorage with optional expiry
 *
 * Usage:
 * ```
 * setStorageItem("user", { name: "John" }, { expiresIn: 3600000 }) // 1 hour
 * ```
 */
export function setStorageItem<T>(
  key: string,
  value: T,
  options: StorageOptions = {}
): boolean {
  try {
    const { expiresIn, prefix = DEFAULT_PREFIX } = options
    const fullKey = `${prefix}${key}`

    const item: StoredItem<T> = {
      value,
      createdAt: Date.now(),
      expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
    }

    localStorage.setItem(fullKey, JSON.stringify(item))
    return true
  } catch {
    console.warn("Failed to set storage item:", key)
    return false
  }
}

/**
 * Get item from localStorage (respects expiry)
 */
export function getStorageItem<T>(
  key: string,
  options: Pick<StorageOptions, "prefix"> = {}
): T | null {
  try {
    const { prefix = DEFAULT_PREFIX } = options
    const fullKey = `${prefix}${key}`

    const stored = localStorage.getItem(fullKey)
    if (!stored) return null

    const item: StoredItem<T> = JSON.parse(stored)

    // Check if expired
    if (item.expiresAt && Date.now() > item.expiresAt) {
      localStorage.removeItem(fullKey)
      return null
    }

    return item.value
  } catch {
    return null
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(
  key: string,
  options: Pick<StorageOptions, "prefix"> = {}
): void {
  const { prefix = DEFAULT_PREFIX } = options
  localStorage.removeItem(`${prefix}${key}`)
}

/**
 * Clear all items with prefix
 */
export function clearStorage(prefix = DEFAULT_PREFIX): void {
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key)
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key))
}

/**
 * Clear expired items
 */
export function clearExpiredItems(prefix = DEFAULT_PREFIX): number {
  let cleared = 0

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue

    try {
      const stored = localStorage.getItem(key)
      if (!stored) continue

      const item: StoredItem<unknown> = JSON.parse(stored)
      if (item.expiresAt && Date.now() > item.expiresAt) {
        localStorage.removeItem(key)
        cleared++
      }
    } catch {
      // Invalid item, skip
    }
  }

  return cleared
}

/**
 * Get storage usage info
 */
export function getStorageInfo(prefix = DEFAULT_PREFIX): {
  itemCount: number
  totalSize: number
  items: Array<{ key: string; size: number; expiresAt?: number }>
} {
  const items: Array<{ key: string; size: number; expiresAt?: number }> = []
  let totalSize = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(prefix)) continue

    const value = localStorage.getItem(key)
    if (!value) continue

    const size = new Blob([value]).size

    try {
      const item: StoredItem<unknown> = JSON.parse(value)
      items.push({
        key: key.slice(prefix.length),
        size,
        expiresAt: item.expiresAt,
      })
    } catch {
      items.push({ key: key.slice(prefix.length), size })
    }

    totalSize += size
  }

  return { itemCount: items.length, totalSize, items }
}

// ==================== Session Storage ====================

/**
 * Set item in sessionStorage
 */
export function setSessionItem<T>(key: string, value: T): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/**
 * Get item from sessionStorage
 */
export function getSessionItem<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

/**
 * Remove item from sessionStorage
 */
export function removeSessionItem(key: string): void {
  sessionStorage.removeItem(key)
}

// ==================== Typed Storage ====================

/**
 * Create a typed storage accessor
 *
 * Usage:
 * ```
 * const userStorage = createTypedStorage<User>("user", { expiresIn: 3600000 })
 * userStorage.set({ name: "John", email: "john@example.com" })
 * const user = userStorage.get()
 * ```
 */
export function createTypedStorage<T>(key: string, options: StorageOptions = {}) {
  return {
    get: () => getStorageItem<T>(key, options),
    set: (value: T) => setStorageItem(key, value, options),
    remove: () => removeStorageItem(key, options),
    exists: () => getStorageItem<T>(key, options) !== null,
  }
}

// ==================== Cache ====================

interface CacheOptions extends StorageOptions {
  staleTime?: number // Time after which data is considered stale
}

/**
 * Create a cache with stale-while-revalidate pattern
 */
export function createCache<T>(key: string, options: CacheOptions = {}) {
  const { staleTime = 60000, ...storageOptions } = options

  return {
    get: (): { data: T | null; isStale: boolean } => {
      const stored = localStorage.getItem(`${DEFAULT_PREFIX}cache_${key}`)
      if (!stored) return { data: null, isStale: true }

      try {
        const item: StoredItem<T> = JSON.parse(stored)
        const isStale = Date.now() - item.createdAt > staleTime
        const isExpired = item.expiresAt ? Date.now() > item.expiresAt : false

        if (isExpired) {
          localStorage.removeItem(`${DEFAULT_PREFIX}cache_${key}`)
          return { data: null, isStale: true }
        }

        return { data: item.value, isStale }
      } catch {
        return { data: null, isStale: true }
      }
    },

    set: (value: T): boolean => {
      return setStorageItem(`cache_${key}`, value, storageOptions)
    },

    invalidate: (): void => {
      removeStorageItem(`cache_${key}`)
    },
  }
}

// ==================== Storage Event Listener ====================

type StorageListener<T> = (newValue: T | null, oldValue: T | null) => void

/**
 * Listen for storage changes (cross-tab)
 */
export function onStorageChange<T>(
  key: string,
  callback: StorageListener<T>,
  options: Pick<StorageOptions, "prefix"> = {}
): () => void {
  const { prefix = DEFAULT_PREFIX } = options
  const fullKey = `${prefix}${key}`

  const handler = (event: StorageEvent) => {
    if (event.key !== fullKey) return

    let newValue: T | null = null
    let oldValue: T | null = null

    try {
      if (event.newValue) {
        const item: StoredItem<T> = JSON.parse(event.newValue)
        newValue = item.value
      }
    } catch {
      // Invalid JSON
    }

    try {
      if (event.oldValue) {
        const item: StoredItem<T> = JSON.parse(event.oldValue)
        oldValue = item.value
      }
    } catch {
      // Invalid JSON
    }

    callback(newValue, oldValue)
  }

  window.addEventListener("storage", handler)
  return () => window.removeEventListener("storage", handler)
}
