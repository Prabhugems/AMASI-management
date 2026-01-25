/**
 * Array Utilities
 *
 * Common array manipulation functions
 */

/**
 * Group array items by key
 */
export function groupBy<T>(
  array: T[],
  key: keyof T | ((item: T) => string)
): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = typeof key === "function" ? key(item) : String(item[key])
    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * Create a map from array by key
 */
export function keyBy<T>(
  array: T[],
  key: keyof T | ((item: T) => string)
): Record<string, T> {
  return array.reduce((map, item) => {
    const mapKey = typeof key === "function" ? key(item) : String(item[key])
    map[mapKey] = item
    return map
  }, {} as Record<string, T>)
}

/**
 * Split array into chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Get unique values
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

/**
 * Get unique values by key
 */
export function uniqueBy<T>(
  array: T[],
  key: keyof T | ((item: T) => unknown)
): T[] {
  const seen = new Set()
  return array.filter((item) => {
    const k = typeof key === "function" ? key(item) : item[key]
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Get random item from array
 */
export function randomItem<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

/**
 * Get random items from array
 */
export function randomItems<T>(array: T[], count: number): T[] {
  return shuffle(array).slice(0, count)
}

/**
 * Sort by key
 */
export function sortBy<T>(
  array: T[],
  key: keyof T | ((item: T) => number | string),
  order: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = typeof key === "function" ? key(a) : a[key]
    const bVal = typeof key === "function" ? key(b) : b[key]

    let comparison = 0
    if (aVal < bVal) comparison = -1
    if (aVal > bVal) comparison = 1

    return order === "desc" ? -comparison : comparison
  })
}

/**
 * Sort by multiple keys
 */
export function sortByMultiple<T>(
  array: T[],
  keys: Array<{ key: keyof T | ((item: T) => any); order?: "asc" | "desc" }>
): T[] {
  return [...array].sort((a, b) => {
    for (const { key, order = "asc" } of keys) {
      const aVal = typeof key === "function" ? key(a) : a[key]
      const bVal = typeof key === "function" ? key(b) : b[key]

      let comparison = 0
      if (aVal < bVal) comparison = -1
      if (aVal > bVal) comparison = 1

      if (comparison !== 0) {
        return order === "desc" ? -comparison : comparison
      }
    }
    return 0
  })
}

/**
 * Find item and its index
 */
export function findWithIndex<T>(
  array: T[],
  predicate: (item: T, index: number) => boolean
): { item: T; index: number } | null {
  for (let i = 0; i < array.length; i++) {
    if (predicate(array[i], i)) {
      return { item: array[i], index: i }
    }
  }
  return null
}

/**
 * Partition array into two based on predicate
 */
export function partition<T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] {
  const pass: T[] = []
  const fail: T[] = []

  for (const item of array) {
    if (predicate(item)) {
      pass.push(item)
    } else {
      fail.push(item)
    }
  }

  return [pass, fail]
}

/**
 * Flatten nested arrays
 */
export function flatten<T>(array: (T | T[])[]): T[] {
  return array.flat() as T[]
}

/**
 * Deep flatten nested arrays
 */
export function flattenDeep<T>(array: any[]): T[] {
  return array.flat(Infinity) as T[]
}

/**
 * Get intersection of arrays
 */
export function intersection<T>(arr1: T[], arr2: T[]): T[] {
  const set = new Set(arr2)
  return arr1.filter((item) => set.has(item))
}

/**
 * Get difference of arrays (items in arr1 not in arr2)
 */
export function difference<T>(arr1: T[], arr2: T[]): T[] {
  const set = new Set(arr2)
  return arr1.filter((item) => !set.has(item))
}

/**
 * Get symmetric difference (items in either but not both)
 */
export function symmetricDifference<T>(arr1: T[], arr2: T[]): T[] {
  const set1 = new Set(arr1)
  const set2 = new Set(arr2)

  return [
    ...arr1.filter((item) => !set2.has(item)),
    ...arr2.filter((item) => !set1.has(item)),
  ]
}

/**
 * Get union of arrays
 */
export function union<T>(...arrays: T[][]): T[] {
  return unique(arrays.flat())
}

/**
 * Move item in array
 */
export function move<T>(array: T[], from: number, to: number): T[] {
  const result = [...array]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

/**
 * Insert item at index
 */
export function insert<T>(array: T[], index: number, item: T): T[] {
  const result = [...array]
  result.splice(index, 0, item)
  return result
}

/**
 * Remove item at index
 */
export function removeAt<T>(array: T[], index: number): T[] {
  const result = [...array]
  result.splice(index, 1)
  return result
}

/**
 * Remove item by value
 */
export function remove<T>(array: T[], item: T): T[] {
  return array.filter((i) => i !== item)
}

/**
 * Update item at index
 */
export function updateAt<T>(array: T[], index: number, item: T): T[] {
  const result = [...array]
  result[index] = item
  return result
}

/**
 * Sum of numbers
 */
export function sum(array: number[]): number {
  return array.reduce((acc, val) => acc + val, 0)
}

/**
 * Sum by key
 */
export function sumBy<T>(array: T[], key: keyof T | ((item: T) => number)): number {
  return array.reduce((acc, item) => {
    const value = typeof key === "function" ? key(item) : (item[key] as number)
    return acc + (value || 0)
  }, 0)
}

/**
 * Average of numbers
 */
export function average(array: number[]): number {
  if (array.length === 0) return 0
  return sum(array) / array.length
}

/**
 * Min value
 */
export function min(array: number[]): number {
  return Math.min(...array)
}

/**
 * Max value
 */
export function max(array: number[]): number {
  return Math.max(...array)
}

/**
 * Min by key
 */
export function minBy<T>(array: T[], key: keyof T | ((item: T) => number)): T | undefined {
  if (array.length === 0) return undefined

  return array.reduce((min, item) => {
    const minVal = typeof key === "function" ? key(min) : (min[key] as number)
    const itemVal = typeof key === "function" ? key(item) : (item[key] as number)
    return itemVal < minVal ? item : min
  })
}

/**
 * Max by key
 */
export function maxBy<T>(array: T[], key: keyof T | ((item: T) => number)): T | undefined {
  if (array.length === 0) return undefined

  return array.reduce((max, item) => {
    const maxVal = typeof key === "function" ? key(max) : (max[key] as number)
    const itemVal = typeof key === "function" ? key(item) : (item[key] as number)
    return itemVal > maxVal ? item : max
  })
}

/**
 * Count occurrences
 */
export function countBy<T>(
  array: T[],
  key: keyof T | ((item: T) => string)
): Record<string, number> {
  return array.reduce((counts, item) => {
    const k = typeof key === "function" ? key(item) : String(item[key])
    counts[k] = (counts[k] || 0) + 1
    return counts
  }, {} as Record<string, number>)
}

/**
 * First n items
 */
export function take<T>(array: T[], n: number): T[] {
  return array.slice(0, n)
}

/**
 * Last n items
 */
export function takeLast<T>(array: T[], n: number): T[] {
  return array.slice(-n)
}

/**
 * Drop first n items
 */
export function drop<T>(array: T[], n: number): T[] {
  return array.slice(n)
}

/**
 * Drop last n items
 */
export function dropLast<T>(array: T[], n: number): T[] {
  return array.slice(0, -n)
}

/**
 * Create range of numbers
 */
export function range(start: number, end: number, step = 1): number[] {
  const result: number[] = []
  for (let i = start; i < end; i += step) {
    result.push(i)
  }
  return result
}

/**
 * Zip multiple arrays
 */
export function zip<T>(...arrays: T[][]): T[][] {
  const length = Math.min(...arrays.map((arr) => arr.length))
  return range(0, length).map((i) => arrays.map((arr) => arr[i]))
}

/**
 * Check if arrays are equal
 */
export function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false
  return arr1.every((item, index) => item === arr2[index])
}

/**
 * Check if array is empty
 */
export function isEmpty<T>(array: T[] | null | undefined): boolean {
  return !array || array.length === 0
}

/**
 * Get first item
 */
export function first<T>(array: T[]): T | undefined {
  return array[0]
}

/**
 * Get last item
 */
export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1]
}

/**
 * Compact - remove falsy values
 */
export function compact<T>(array: (T | null | undefined | false | 0 | "")[]): T[] {
  return array.filter(Boolean) as T[]
}
