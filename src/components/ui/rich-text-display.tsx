"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface RichTextDisplayProps {
  content: string
  className?: string
  maxLength?: number
  allowedTags?: string[]
}

// Default allowed tags for safe HTML rendering
const DEFAULT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "code",
  "pre",
  "hr",
  "span",
  "div",
]

// Allowed attributes per tag
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  span: ["class"],
  div: ["class"],
}

/**
 * Rich Text Display Component
 *
 * Safely render HTML/rich text content
 *
 * Usage:
 * ```
 * <RichTextDisplay content={htmlContent} />
 * <RichTextDisplay content={markdownContent} />
 * ```
 */
export function RichTextDisplay({
  content,
  className,
  maxLength,
  allowedTags = DEFAULT_ALLOWED_TAGS,
}: RichTextDisplayProps) {
  const sanitizedContent = React.useMemo(() => {
    let html = content

    // Truncate if needed
    if (maxLength && html.length > maxLength) {
      html = html.substring(0, maxLength) + "..."
    }

    // Sanitize HTML
    return sanitizeHtml(html, allowedTags)
  }, [content, maxLength, allowedTags])

  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}

/**
 * Markdown to HTML display
 */
export function MarkdownDisplay({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const html = React.useMemo(() => {
    return parseMarkdown(content)
  }, [content])

  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/**
 * Simple markdown parser (basic support)
 */
function parseMarkdown(text: string): string {
  let html = text

  // Escape HTML
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>")
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>")
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>")

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
  html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>")

  // Italic
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>")
  html = html.replace(/_(.*?)_/gim, "<em>$1</em>")

  // Strikethrough
  html = html.replace(/~~(.*?)~~/gim, "<s>$1</s>")

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gim, "<pre><code>$1</code></pre>")

  // Inline code
  html = html.replace(/`(.*?)`/gim, "<code>$1</code>")

  // Links - sanitize href to block javascript:/data: URLs
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/gim,
    (_match: string, text: string, url: string) => {
      const trimmedUrl = url.trim().toLowerCase()
      if (trimmedUrl.startsWith("javascript:") || trimmedUrl.startsWith("data:") || trimmedUrl.startsWith("vbscript:")) {
        return text // Strip dangerous links, keep text only
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  )

  // Unordered lists
  html = html.replace(/^\* (.*$)/gim, "<li>$1</li>")
  html = html.replace(/^- (.*$)/gim, "<li>$1</li>")
  html = html.replace(/(<li>.*<\/li>\n?)+/gim, (match) => `<ul>${match}</ul>`)

  // Ordered lists
  html = html.replace(/^\d+\. (.*$)/gim, "<li>$1</li>")

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")

  // Horizontal rule
  html = html.replace(/^---$/gim, "<hr>")

  // Line breaks
  html = html.replace(/\n\n/g, "</p><p>")
  html = html.replace(/\n/g, "<br>")

  // Wrap in paragraph
  html = `<p>${html}</p>`

  return html
}

/**
 * Basic HTML sanitizer
 */
function sanitizeHtml(html: string, allowedTags: string[]): string {
  const doc = new DOMParser().parseFromString(html, "text/html")

  function clean(node: Node): void {
    const children = Array.from(node.childNodes)

    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element
        const tagName = element.tagName.toLowerCase()

        if (!allowedTags.includes(tagName)) {
          // Replace with text content
          const text = document.createTextNode(element.textContent || "")
          node.replaceChild(text, child)
        } else {
          // Remove disallowed attributes
          const allowedAttrs = ALLOWED_ATTRIBUTES[tagName] || []
          const attrs = Array.from(element.attributes)

          for (const attr of attrs) {
            if (!allowedAttrs.includes(attr.name)) {
              element.removeAttribute(attr.name)
            }
          }

          // Sanitize href attributes
          if (tagName === "a") {
            const href = element.getAttribute("href") || ""
            if (href.startsWith("javascript:") || href.startsWith("data:")) {
              element.removeAttribute("href")
            }
            // Add security attributes
            element.setAttribute("rel", "noopener noreferrer")
          }

          // Recursively clean children
          clean(child)
        }
      }
    }
  }

  clean(doc.body)
  return doc.body.innerHTML
}

/**
 * Plain text display with basic formatting
 */
export function PlainTextDisplay({
  content,
  className,
  preserveNewlines = true,
  linkify = true,
}: {
  content: string
  className?: string
  preserveNewlines?: boolean
  linkify?: boolean
}) {
  const formattedContent = React.useMemo(() => {
    let text = content

    // Escape HTML
    text = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

    // Linkify URLs
    if (linkify) {
      text = text.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>'
      )
    }

    // Preserve newlines
    if (preserveNewlines) {
      text = text.replace(/\n/g, "<br>")
    }

    return text
  }, [content, preserveNewlines, linkify])

  return (
    <div
      className={cn("text-sm", className)}
      dangerouslySetInnerHTML={{ __html: formattedContent }}
    />
  )
}

/**
 * Truncated text with expand option
 */
export function TruncatedText({
  content,
  maxLength = 200,
  className,
}: {
  content: string
  maxLength?: number
  className?: string
}) {
  const [expanded, setExpanded] = React.useState(false)
  const needsTruncation = content.length > maxLength

  const displayContent = expanded || !needsTruncation
    ? content
    : content.substring(0, maxLength) + "..."

  return (
    <div className={className}>
      <PlainTextDisplay content={displayContent} />
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary text-sm hover:underline mt-1"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

/**
 * Code display with syntax highlighting placeholder
 */
export function CodeDisplay({
  code,
  language,
  className,
}: {
  code: string
  language?: string
  className?: string
}) {
  return (
    <pre
      className={cn(
        "p-4 bg-muted rounded-lg overflow-x-auto text-sm font-mono",
        className
      )}
    >
      <code className={language ? `language-${language}` : undefined}>
        {code}
      </code>
    </pre>
  )
}
