"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SearchHighlightProps {
  text: string
  query: string
  className?: string
  highlightClassName?: string
}

/**
 * Search Highlight Component
 *
 * Highlights matching text in search results
 *
 * Usage:
 * ```
 * <SearchHighlight
 *   text="John Doe"
 *   query="john"
 *   highlightClassName="bg-yellow-200"
 * />
 * ```
 */
export function SearchHighlight({
  text,
  query,
  className,
  highlightClassName = "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5",
}: SearchHighlightProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  const parts = highlightText(text, query)

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlighted ? (
          <mark key={index} className={cn("bg-transparent", highlightClassName)}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}

/**
 * Split text into highlighted and non-highlighted parts
 */
export function highlightText(
  text: string,
  query: string
): Array<{ text: string; highlighted: boolean }> {
  if (!query.trim()) {
    return [{ text, highlighted: false }]
  }

  const regex = new RegExp(`(${escapeRegExp(query)})`, "gi")
  const parts = text.split(regex)

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: regex.test(part),
    }))
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Multi-term highlight (matches any of the terms)
 */
export function SearchHighlightMulti({
  text,
  queries,
  className,
  highlightClassName = "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5",
}: {
  text: string
  queries: string[]
  className?: string
  highlightClassName?: string
}) {
  const validQueries = queries.filter((q) => q.trim().length > 0)

  if (validQueries.length === 0) {
    return <span className={className}>{text}</span>
  }

  const pattern = validQueries.map(escapeRegExp).join("|")
  const regex = new RegExp(`(${pattern})`, "gi")
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts
        .filter((part) => part.length > 0)
        .map((part, index) =>
          regex.test(part) ? (
            <mark key={index} className={cn("bg-transparent", highlightClassName)}>
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
    </span>
  )
}

/**
 * Fuzzy highlight (matches characters in order, not necessarily adjacent)
 */
export function FuzzyHighlight({
  text,
  query,
  className,
  highlightClassName = "text-primary font-semibold",
}: SearchHighlightProps) {
  if (!query.trim()) {
    return <span className={className}>{text}</span>
  }

  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  let queryIndex = 0
  const result: Array<{ char: string; highlighted: boolean }> = []

  for (let i = 0; i < text.length; i++) {
    if (queryIndex < queryLower.length && textLower[i] === queryLower[queryIndex]) {
      result.push({ char: text[i], highlighted: true })
      queryIndex++
    } else {
      result.push({ char: text[i], highlighted: false })
    }
  }

  return (
    <span className={className}>
      {result.map((item, index) =>
        item.highlighted ? (
          <span key={index} className={highlightClassName}>
            {item.char}
          </span>
        ) : (
          <span key={index}>{item.char}</span>
        )
      )}
    </span>
  )
}

/**
 * Hook for debounced search highlighting
 */
export function useSearchHighlight(delay: number = 300) {
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, delay)

    return () => clearTimeout(timer)
  }, [query, delay])

  const highlight = React.useCallback(
    (text: string) => {
      if (!debouncedQuery.trim()) return text

      const regex = new RegExp(`(${escapeRegExp(debouncedQuery)})`, "gi")
      return text.replace(regex, "<mark>$1</mark>")
    },
    [debouncedQuery]
  )

  return {
    query,
    setQuery,
    debouncedQuery,
    highlight,
  }
}

/**
 * Check if text matches search query
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query.trim()) return true
  return text.toLowerCase().includes(query.toLowerCase())
}

/**
 * Check if text matches any of the search queries
 */
export function matchesAnySearch(text: string, queries: string[]): boolean {
  if (queries.length === 0) return true
  return queries.some((q) => matchesSearch(text, q))
}

/**
 * Fuzzy match check
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query.trim()) return true

  const queryLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  let queryIndex = 0
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++
    }
  }

  return queryIndex === queryLower.length
}
