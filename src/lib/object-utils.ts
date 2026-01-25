/**
 * Object Utilities
 *
 * Common object manipulation functions
 */

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target

  const result = { ...target }

  for (const source of sources) {
    if (!source) continue

    for (const key of Object.keys(source)) {
      const targetValue = result[key as keyof T]
      const sourceValue = source[key as keyof T]

      if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
        (result as any)[key] = deepMerge(
          targetValue as Record<string, any>,
          sourceValue as Record<string, any>
        )
      } else if (sourceValue !== undefined) {
        (result as any)[key] = sourceValue
      }
    }
  }

  return result
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as unknown as T
  }

  if (isPlainObject(obj)) {
    const cloned: Record<string, any> = {}
    for (const key of Object.keys(obj)) {
      cloned[key] = deepClone((obj as Record<string, any>)[key])
    }
    return cloned as T
  }

  return obj
}

/**
 * Pick specific keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Omit specific keys from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj }
  for (const key of keys) {
    delete result[key]
  }
  return result
}

/**
 * Get nested value by path
 */
export function get<T = any>(
  obj: Record<string, any>,
  path: string,
  defaultValue?: T
): T {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let result: any = obj

  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue as T
    }
    result = result[key]
  }

  return result === undefined ? (defaultValue as T) : result
}

/**
 * Set nested value by path
 */
export function set<T extends Record<string, any>>(
  obj: T,
  path: string,
  value: any
): T {
  const result = deepClone(obj)
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: any = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || current[key] === null) {
      current[key] = isNaN(Number(keys[i + 1])) ? {} : []
    }
    current = current[key]
  }

  current[keys[keys.length - 1]] = value
  return result
}

/**
 * Check if path exists in object
 */
export function has(obj: Record<string, any>, path: string): boolean {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: any = obj

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return false
    }
    current = current[key]
  }

  return true
}

/**
 * Delete nested value by path
 */
export function unset<T extends Record<string, any>>(obj: T, path: string): T {
  const result = deepClone(obj)
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: any = result

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current)) return result
    current = current[key]
  }

  delete current[keys[keys.length - 1]]
  return result
}

/**
 * Flatten object (nested to flat with dot notation)
 */
export function flatten(
  obj: Record<string, any>,
  prefix = ""
): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    const value = obj[key]

    if (isPlainObject(value)) {
      Object.assign(result, flatten(value, newKey))
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isPlainObject(item)) {
          Object.assign(result, flatten(item, `${newKey}[${index}]`))
        } else {
          result[`${newKey}[${index}]`] = item
        }
      })
    } else {
      result[newKey] = value
    }
  }

  return result
}

/**
 * Unflatten object (flat with dot notation to nested)
 */
export function unflatten(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key of Object.keys(obj)) {
    set(result, key, obj[key])
  }

  return result
}

/**
 * Get difference between two objects
 */
export function diff<T extends Record<string, any>>(
  obj1: T,
  obj2: T
): Partial<T> {
  const result: Partial<T> = {}

  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)])

  for (const key of allKeys) {
    const val1 = obj1[key as keyof T]
    const val2 = obj2[key as keyof T]

    if (!isEqual(val1, val2)) {
      result[key as keyof T] = val2
    }
  }

  return result
}

/**
 * Check if two values are deeply equal
 */
export function isEqual(val1: any, val2: any): boolean {
  if (val1 === val2) return true

  if (val1 === null || val2 === null) return false
  if (typeof val1 !== typeof val2) return false

  if (val1 instanceof Date && val2 instanceof Date) {
    return val1.getTime() === val2.getTime()
  }

  if (Array.isArray(val1) && Array.isArray(val2)) {
    if (val1.length !== val2.length) return false
    return val1.every((item, index) => isEqual(item, val2[index]))
  }

  if (isPlainObject(val1) && isPlainObject(val2)) {
    const keys1 = Object.keys(val1)
    const keys2 = Object.keys(val2)

    if (keys1.length !== keys2.length) return false
    return keys1.every((key) => isEqual(val1[key], val2[key]))
  }

  return false
}

/**
 * Check if value is plain object
 */
export function isPlainObject(value: any): value is Record<string, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    value.constructor === Object
  )
}

/**
 * Check if object is empty
 */
export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0
}

/**
 * Map object values
 */
export function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (value: T, key: string) => U
): Record<string, U> {
  const result: Record<string, U> = {}
  for (const key of Object.keys(obj)) {
    result[key] = fn(obj[key], key)
  }
  return result
}

/**
 * Map object keys
 */
export function mapKeys<T>(
  obj: Record<string, T>,
  fn: (key: string, value: T) => string
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const key of Object.keys(obj)) {
    result[fn(key, obj[key])] = obj[key]
  }
  return result
}

/**
 * Filter object by predicate
 */
export function filterObject<T>(
  obj: Record<string, T>,
  predicate: (value: T, key: string) => boolean
): Record<string, T> {
  const result: Record<string, T> = {}
  for (const key of Object.keys(obj)) {
    if (predicate(obj[key], key)) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Remove null and undefined values
 */
export function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key of Object.keys(obj)) {
    if (obj[key] !== null && obj[key] !== undefined) {
      result[key as keyof T] = obj[key]
    }
  }
  return result
}

/**
 * Invert object (swap keys and values)
 */
export function invert<T extends Record<string, string | number>>(
  obj: T
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of Object.keys(obj)) {
    result[String(obj[key])] = key
  }
  return result
}

/**
 * Get object entries as typed tuples
 */
export function entries<T extends Record<string, any>>(
  obj: T
): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

/**
 * Create object from entries
 */
export function fromEntries<K extends string, V>(
  entries: [K, V][]
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>
}

/**
 * Transform object
 */
export function transform<T extends Record<string, any>, U>(
  obj: T,
  fn: (acc: U, value: T[keyof T], key: keyof T) => U,
  initial: U
): U {
  let result = initial
  for (const key of Object.keys(obj)) {
    result = fn(result, obj[key as keyof T], key as keyof T)
  }
  return result
}

/**
 * Rename keys
 */
export function renameKeys<T extends Record<string, any>>(
  obj: T,
  keyMap: Partial<Record<keyof T, string>>
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    const newKey = keyMap[key as keyof T] || key
    result[newKey] = obj[key]
  }
  return result
}

/**
 * Sort object keys
 */
export function sortKeys<T extends Record<string, any>>(
  obj: T,
  compareFn?: (a: string, b: string) => number
): T {
  const sortedKeys = Object.keys(obj).sort(compareFn)
  const result = {} as T
  for (const key of sortedKeys) {
    result[key as keyof T] = obj[key as keyof T]
  }
  return result
}
