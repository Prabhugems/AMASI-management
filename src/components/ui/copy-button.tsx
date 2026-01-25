"use client"

import * as React from "react"
import { Check, Copy, Mail, Phone, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { copyToClipboard, copyEmails, copyPhones, copyLink } from "@/lib/clipboard"

interface CopyButtonProps {
  value: string
  className?: string
  variant?: "default" | "ghost" | "outline"
  size?: "default" | "sm" | "icon"
  showToast?: boolean
  label?: string
}

/**
 * Copy button with visual feedback
 */
export function CopyButton({
  value,
  className,
  variant = "ghost",
  size = "icon",
  showToast = true,
  label = "Copy",
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(value, { showToast })
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={cn("h-8 w-8", className)}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Copy email button
 */
export function CopyEmailButton({
  email,
  className,
}: {
  email: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(email, { successMessage: "Email copied" })
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", className)}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Mail className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Copy email"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Copy phone button
 */
export function CopyPhoneButton({
  phone,
  className,
}: {
  phone: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const success = await copyToClipboard(phone, { successMessage: "Phone copied" })
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6", className)}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Phone className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Copy phone"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Copy link button
 */
export function CopyLinkButton({
  url,
  title,
  className,
}: {
  url: string
  title?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const success = await copyLink(url, title)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", className)}
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? "Copied!" : "Copy link"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Inline copyable text
 */
export function CopyableText({
  children,
  value,
  className,
}: {
  children: React.ReactNode
  value?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const textValue = value || (typeof children === "string" ? children : "")

  const handleCopy = async () => {
    const success = await copyToClipboard(textValue, { showToast: false })
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
        copied && "text-green-600",
        className
      )}
      onClick={handleCopy}
      title="Click to copy"
    >
      {children}
      {copied && <Check className="h-3 w-3" />}
    </span>
  )
}

/**
 * Bulk copy emails button
 */
export function BulkCopyEmailsButton({
  emails,
  className,
  disabled,
}: {
  emails: string[]
  className?: string
  disabled?: boolean
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    const success = await copyEmails(emails)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={handleCopy}
      disabled={disabled || emails.length === 0}
    >
      {copied ? (
        <Check className="h-4 w-4 mr-2 text-green-500" />
      ) : (
        <Mail className="h-4 w-4 mr-2" />
      )}
      {copied ? "Copied!" : `Copy ${emails.length} Email${emails.length !== 1 ? "s" : ""}`}
    </Button>
  )
}
