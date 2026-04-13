"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ImageUpload } from "@/components/ui/image-upload"
import { Image, Globe, Palette } from "lucide-react"
import { cn } from "@/lib/utils"
import { type SectionProps } from "./types"

export function BrandingSection({ eventId, formData, updateField }: SectionProps) {
  return (
    <div className="space-y-6">
      {/* Live Preview Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-secondary/30">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Live Preview — Registration Page</h3>
        </div>
        <div
          className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
          style={{
            backgroundImage: formData.banner_url ? `url(${formData.banner_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!formData.banner_url && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Banner preview will appear here</p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex items-end gap-4">
              {formData.logo_url ? (
                <img
                  src={formData.logo_url}
                  alt="Event logo"
                  className="h-16 w-16 rounded-xl bg-white object-contain shadow-lg border-2 border-white"
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
                  style={{ backgroundColor: formData.primary_color || '#10b981' }}
                >
                  {(formData.short_name || formData.name || 'E')[0]}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white drop-shadow-lg">
                  {formData.name || 'Event Name'}
                </h2>
                <p className="text-white/80 text-sm">
                  {formData.city ? `${formData.city}, ` : ''}{formData.start_date ? new Date(formData.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date TBD'}
                </p>
              </div>
              <Button
                size="sm"
                className="shadow-lg"
                style={{
                  backgroundColor: formData.primary_color || '#10b981',
                  color: 'white'
                }}
              >
                Register Now
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Logo Upload */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Image className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Event Logo</h4>
              <p className="text-xs text-muted-foreground">Square, 200x200px</p>
            </div>
          </div>
          <ImageUpload
            value={formData.logo_url || ""}
            onChange={(url) => updateField("logo_url", url)}
            eventId={eventId}
            folder={`events/${eventId}/logo`}
            aspectRatio="square"
          />
        </div>

        {/* Banner Upload */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Image className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Banner Image</h4>
              <p className="text-xs text-muted-foreground">Wide, 1200x400px</p>
            </div>
          </div>
          <ImageUpload
            value={formData.banner_url || ""}
            onChange={(url) => updateField("banner_url", url)}
            eventId={eventId}
            folder={`events/${eventId}/banner`}
            aspectRatio="banner"
          />
        </div>

        {/* Favicon Upload */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm">Favicon</h4>
              <p className="text-xs text-muted-foreground">Square, 32x32px ICO/PNG</p>
            </div>
          </div>
          <ImageUpload
            value={formData.favicon_url || ""}
            onChange={(url) => updateField("favicon_url", url)}
            eventId={eventId}
            folder={`events/${eventId}/favicon`}
            aspectRatio="square"
          />
        </div>
      </div>

      {/* Color Settings */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-5">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Palette className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Brand Color</h3>
            <p className="text-sm text-muted-foreground">Used for buttons and accents</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Quick Select</label>
            <div className="flex flex-wrap gap-2">
              {[
                { color: '#10b981', name: 'Emerald' },
                { color: '#3b82f6', name: 'Blue' },
                { color: '#8b5cf6', name: 'Violet' },
                { color: '#f59e0b', name: 'Amber' },
                { color: '#ef4444', name: 'Red' },
                { color: '#ec4899', name: 'Pink' },
                { color: '#06b6d4', name: 'Cyan' },
                { color: '#84cc16', name: 'Lime' },
                { color: '#f97316', name: 'Orange' },
                { color: '#6366f1', name: 'Indigo' },
              ].map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => updateField("primary_color", preset.color)}
                  className={cn(
                    "h-10 w-10 rounded-lg transition-all hover:scale-110 border-2",
                    formData.primary_color === preset.color
                      ? "border-foreground ring-2 ring-offset-2 ring-offset-background"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: preset.color }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">Custom Color</label>
            <div className="flex items-center gap-3">
              <div
                className="relative h-12 w-12 rounded-xl overflow-hidden border-2 border-border cursor-pointer group"
                style={{ backgroundColor: formData.primary_color || '#10b981' }}
              >
                <input
                  type="color"
                  value={formData.primary_color || "#10b981"}
                  onChange={(e) => updateField("primary_color", e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
                  <Palette className="h-5 w-5 text-white" />
                </div>
              </div>
              <Input
                value={formData.primary_color || "#10b981"}
                onChange={(e) => updateField("primary_color", e.target.value)}
                placeholder="#10b981"
                className="flex-1 font-mono"
              />
              <div
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: formData.primary_color || '#10b981' }}
              >
                Preview
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
