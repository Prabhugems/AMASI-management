"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface UseClipboardOptions {
  timeout?: number
  onSuccess?: (text: string) => void
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  copy: (text: string) => Promise<boolean>
  copied: boolean
  error: Error | null
  reset: () => void
}

/**
 * Clipboard operations with feedback
 *
 * Usage:
 * ```
 * const { copy, copied } = useClipboard()
 *
 * <Button onClick={() => copy("Hello World")}>
 *   {copied ? "Copied!" : "Copy"}
 * </Button>
 * ```
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { timeout = 2000, onSuccess, onError } = options
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount to prevent setState after unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        if (!navigator.clipboard) {
          // Fallback for older browsers
          const textarea = document.createElement("textarea")
          textarea.value = text
          textarea.style.position = "fixed"
          textarea.style.left = "-9999px"
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand("copy")
          document.body.removeChild(textarea)
        } else {
          await navigator.clipboard.writeText(text)
        }

        setCopied(true)
        setError(null)
        onSuccess?.(text)

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => setCopied(false), timeout)
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to copy")
        setError(error)
        setCopied(false)
        onError?.(error)
        return false
      }
    },
    [timeout, onSuccess, onError]
  )

  const reset = useCallback(() => {
    setCopied(false)
    setError(null)
  }, [])

  return { copy, copied, error, reset }
}

/**
 * Read from clipboard
 */
export async function readClipboard(): Promise<string | null> {
  try {
    if (!navigator.clipboard) {
      return null
    }
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}

/**
 * Copy rich HTML content
 */
export async function copyRichText(html: string, plainText?: string): Promise<boolean> {
  try {
    const blob = new Blob([html], { type: "text/html" })
    const plainBlob = new Blob([plainText || stripHtml(html)], { type: "text/plain" })

    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": blob,
        "text/plain": plainBlob,
      }),
    ])
    return true
  } catch {
    // Fallback to plain text
    try {
      await navigator.clipboard.writeText(plainText || stripHtml(html))
      return true
    } catch {
      return false
    }
  }
}

/**
 * Copy image to clipboard
 */
export async function copyImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()

    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob,
      }),
    ])
    return true
  } catch {
    return false
  }
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}
