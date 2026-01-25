"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  allowDuplicates?: boolean
  suggestions?: string[]
  disabled?: boolean
  className?: string
}

/**
 * Tag Input Component
 *
 * Multi-value input with chips/tags
 *
 * Usage:
 * ```
 * <TagInput
 *   value={tags}
 *   onChange={setTags}
 *   placeholder="Add tags..."
 *   maxTags={5}
 *   suggestions={["React", "TypeScript", "Next.js"]}
 * />
 * ```
 */
export function TagInput({
  value,
  onChange,
  placeholder = "Add tag...",
  maxTags,
  allowDuplicates = false,
  suggestions = [],
  disabled = false,
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const canAddMore = !maxTags || value.length < maxTags

  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return []
    return suggestions.filter(
      (s) =>
        s.toLowerCase().includes(inputValue.toLowerCase()) &&
        (allowDuplicates || !value.includes(s))
    )
  }, [inputValue, suggestions, value, allowDuplicates])

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim()
    if (!trimmedTag) return
    if (!canAddMore) return
    if (!allowDuplicates && value.includes(trimmedTag)) return

    onChange([...value, trimmedTag])
    setInputValue("")
    setShowSuggestions(false)
  }

  const removeTag = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value.length - 1)
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setShowSuggestions(true)
  }

  const handleFocus = () => {
    if (inputValue.trim() && filteredSuggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[42px]",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(index)
                }}
                className="rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {canAddMore && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled}
            className={cn(
              "flex-1 min-w-[100px] bg-transparent outline-none text-sm",
              "placeholder:text-muted-foreground"
            )}
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => addTag(suggestion)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {maxTags && (
        <p className="text-xs text-muted-foreground mt-1">
          {value.length}/{maxTags} tags
        </p>
      )}
    </div>
  )
}

/**
 * Email tag input
 */
export function EmailTagInput({
  value,
  onChange,
  placeholder = "Add email...",
  maxEmails,
  disabled = false,
  className,
}: {
  value: string[]
  onChange: (emails: string[]) => void
  placeholder?: string
  maxEmails?: number
  disabled?: boolean
  className?: string
}) {
  const [inputValue, setInputValue] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const canAddMore = !maxEmails || value.length < maxEmails

  const addEmail = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) return

    if (!isValidEmail(trimmedEmail)) {
      setError("Invalid email address")
      return
    }

    if (value.includes(trimmedEmail)) {
      setError("Email already added")
      return
    }

    if (!canAddMore) {
      setError(`Maximum ${maxEmails} emails allowed`)
      return
    }

    onChange([...value, trimmedEmail])
    setInputValue("")
    setError(null)
  }

  const removeEmail = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault()
      addEmail(inputValue)
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeEmail(value.length - 1)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedText = e.clipboardData.getData("text")
    const emails = pastedText.split(/[,;\s]+/).filter(Boolean)

    const validEmails: string[] = []
    for (const email of emails) {
      const trimmed = email.trim().toLowerCase()
      if (isValidEmail(trimmed) && !value.includes(trimmed) && !validEmails.includes(trimmed)) {
        validEmails.push(trimmed)
      }
    }

    if (validEmails.length > 0) {
      const canAdd = maxEmails ? maxEmails - value.length : validEmails.length
      onChange([...value, ...validEmails.slice(0, canAdd)])
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[42px]",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((email, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="flex items-center gap-1 pr-1"
          >
            {email}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeEmail(index)
                }}
                className="rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        ))}

        {canAddMore && (
          <input
            ref={inputRef}
            type="email"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={value.length === 0 ? placeholder : ""}
            disabled={disabled}
            className={cn(
              "flex-1 min-w-[150px] bg-transparent outline-none text-sm",
              "placeholder:text-muted-foreground"
            )}
          />
        )}
      </div>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

/**
 * Simple chips display (read-only)
 */
export function ChipList({
  items,
  variant = "secondary",
  size = "default",
  className,
}: {
  items: string[]
  variant?: "default" | "secondary" | "outline" | "destructive"
  size?: "default" | "sm"
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item, index) => (
        <Badge
          key={index}
          variant={variant}
          className={cn(size === "sm" && "text-[10px] px-1.5 py-0")}
        >
          {item}
        </Badge>
      ))}
    </div>
  )
}
