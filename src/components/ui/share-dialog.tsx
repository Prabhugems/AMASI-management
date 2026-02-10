"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Share2,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Linkedin,
  Twitter,
  Facebook,
} from "lucide-react"
import { createWhatsAppUrl, createMailtoUrl } from "@/lib/url-utils"

interface ShareDialogProps {
  url: string
  title?: string
  description?: string
  children?: React.ReactNode
  className?: string
}

/**
 * Share Dialog Component
 *
 * Social sharing with multiple platforms
 *
 * Usage:
 * ```
 * <ShareDialog
 *   url="https://example.com/event/123"
 *   title="My Event"
 *   description="Join us for this amazing event!"
 * >
 *   <Button>Share</Button>
 * </ShareDialog>
 * ```
 */
export function ShareDialog({
  url,
  title = "Share",
  description,
  children,
  className,
}: ShareDialogProps) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const shareLinks = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-green-500 hover:bg-green-600",
      url: createWhatsAppUrl("", `${title}\n${url}`),
    },
    {
      name: "Email",
      icon: Mail,
      color: "bg-gray-500 hover:bg-gray-600",
      url: createMailtoUrl({
        to: "",
        subject: title,
        body: `${description || title}\n\n${url}`,
      }),
    },
    {
      name: "Twitter",
      icon: Twitter,
      color: "bg-sky-500 hover:bg-sky-600",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      color: "bg-blue-600 hover:bg-blue-700",
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      name: "Facebook",
      icon: Facebook,
      color: "bg-blue-500 hover:bg-blue-600",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
  ]

  const handleShare = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "width=600,height=400")
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        })
      } catch (_err) {
        // User cancelled or error
      }
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className={className}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Copy link */}
        <div className="flex items-center gap-2">
          <Input value={url} readOnly className="flex-1" />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="flex-shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-5 gap-2 pt-4">
          {shareLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => handleShare(link.url)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg text-white transition-colors",
                link.color
              )}
            >
              <link.icon className="h-5 w-5" />
              <span className="text-[10px]">{link.name}</span>
            </button>
          ))}
        </div>

        {/* Native share (mobile) */}
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={handleNativeShare}
          >
            <Share2 className="h-4 w-4 mr-2" />
            More options
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Share button with native share fallback
 */
export function ShareButton({
  url,
  title,
  text,
  className,
}: {
  url: string
  title?: string
  text?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (_err) {
        // Fallback to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className={className}>
      {copied ? (
        <>
          <Check className="h-4 w-4 mr-2 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </>
      )}
    </Button>
  )
}

/**
 * Inline share icons
 */
export function ShareIcons({
  url,
  title,
  size = "sm",
  className,
}: {
  url: string
  title?: string
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  }

  const buttonSizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
  }

  const links = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      url: createWhatsAppUrl("", `${title || ""}\n${url}`),
    },
    {
      name: "Twitter",
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title || "")}&url=${encodeURIComponent(url)}`,
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
  ]

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {links.map((link) => (
        <Button
          key={link.name}
          variant="ghost"
          size="icon"
          className={buttonSizes[size]}
          onClick={() => window.open(link.url, "_blank", "width=600,height=400")}
        >
          <link.icon className={iconSizes[size]} />
          <span className="sr-only">Share on {link.name}</span>
        </Button>
      ))}
    </div>
  )
}
