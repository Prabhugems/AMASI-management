"use client"

import { Input } from "@/components/ui/input"
import { Link2, Globe, Search } from "lucide-react"
import { type SectionProps } from "./types"

export function LinksSection({ formData, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <Link2 className="h-5 w-5 text-cyan-500" />
          </div>
          <div>
            <h3 className="font-semibold">Contact Information</h3>
            <p className="text-sm text-muted-foreground">Displayed to attendees on registration page</p>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Contact Email</label>
              <Input
                type="email"
                value={formData.contact_email || ""}
                onChange={(e) => updateField("contact_email", e.target.value)}
                placeholder="contact@example.com"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Also used as reply-to in automated emails</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contact Phone</label>
              <Input
                type="tel"
                value={formData.contact_phone || ""}
                onChange={(e) => updateField("contact_phone", e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Event Website</label>
            <Input
              type="url"
              value={formData.website_url || ""}
              onChange={(e) => updateField("website_url", e.target.value)}
              placeholder="https://example.com"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* Social Media */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
            <Globe className="h-5 w-5 text-pink-500" />
          </div>
          <div>
            <h3 className="font-semibold">Social Media</h3>
            <p className="text-sm text-muted-foreground">Linked from registration page footer and emails</p>
          </div>
        </div>

        <div className="grid gap-5">
          <div>
            <label className="text-sm font-medium text-foreground">Twitter / X</label>
            <Input
              type="url"
              value={formData.social_twitter || ""}
              onChange={(e) => updateField("social_twitter", e.target.value)}
              placeholder="https://twitter.com/yourhandle"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Instagram</label>
            <Input
              type="url"
              value={formData.social_instagram || ""}
              onChange={(e) => updateField("social_instagram", e.target.value)}
              placeholder="https://instagram.com/yourhandle"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">LinkedIn</label>
            <Input
              type="url"
              value={formData.social_linkedin || ""}
              onChange={(e) => updateField("social_linkedin", e.target.value)}
              placeholder="https://linkedin.com/company/yourorg"
              className="mt-1.5"
            />
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Search className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold">SEO & Social Sharing</h3>
            <p className="text-sm text-muted-foreground">Controls how your event appears in search results and social media cards</p>
          </div>
        </div>

        <div className="grid gap-5">
          <div>
            <label className="text-sm font-medium text-foreground">SEO Title</label>
            <Input
              value={formData.seo_title || ""}
              onChange={(e) => updateField("seo_title", e.target.value)}
              placeholder={formData.name || "Event name (defaults to event name)"}
              maxLength={70}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(formData.seo_title || "").length}/70 — Browser tab title and og:title
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">SEO Description</label>
            <textarea
              value={formData.seo_description || ""}
              onChange={(e) => updateField("seo_description", e.target.value)}
              placeholder="Brief description for search engines and social sharing cards"
              maxLength={160}
              rows={2}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {(formData.seo_description || "").length}/160 — Meta description for search engines
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
