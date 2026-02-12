"use client"

import { Form } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Palette,
  Image,
  X,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface FormDesignProps {
  form: Form
  onUpdate: (updates: Partial<Form>) => void
}

const colorPresets = [
  { name: "Purple", primary: "#8B5CF6", bg: "#F5F3FF" },
  { name: "Blue", primary: "#3B82F6", bg: "#EFF6FF" },
  { name: "Green", primary: "#10B981", bg: "#ECFDF5" },
  { name: "Orange", primary: "#F97316", bg: "#FFF7ED" },
  { name: "Pink", primary: "#EC4899", bg: "#FDF2F8" },
  { name: "Cyan", primary: "#06B6D4", bg: "#ECFEFF" },
  { name: "Red", primary: "#EF4444", bg: "#FEF2F2" },
  { name: "Slate", primary: "#475569", bg: "#F8FAFC" },
]

export function FormDesign({ form, onUpdate }: FormDesignProps) {
  const [_showPreview, _setShowPreview] = useState(true)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Design Controls */}
      <div className="space-y-6">
        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Colors
            </CardTitle>
            <CardDescription>
              Customize your form&apos;s color scheme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Color Presets */}
            <div>
              <Label className="mb-3 block">Quick Presets</Label>
              <div className="grid grid-cols-4 gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() =>
                      onUpdate({
                        primary_color: preset.primary,
                        background_color: preset.bg,
                      })
                    }
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all hover:scale-105",
                      form.primary_color === preset.primary &&
                        "ring-2 ring-primary ring-offset-2"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2 mt-1">
                  <div
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: form.primary_color || "#8B5CF6" }}
                    onClick={() => document.getElementById("primary_color")?.click()}
                  />
                  <Input
                    id="primary_color"
                    type="color"
                    value={form.primary_color || "#8B5CF6"}
                    onChange={(e) => onUpdate({ primary_color: e.target.value })}
                    className="w-0 h-0 opacity-0 absolute"
                  />
                  <Input
                    value={form.primary_color || "#8B5CF6"}
                    onChange={(e) => onUpdate({ primary_color: e.target.value })}
                    placeholder="#8B5CF6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="background_color">Background Color</Label>
                <div className="flex gap-2 mt-1">
                  <div
                    className="w-10 h-10 rounded-lg border cursor-pointer"
                    style={{ backgroundColor: form.background_color || "#F5F3FF" }}
                    onClick={() =>
                      document.getElementById("background_color")?.click()
                    }
                  />
                  <Input
                    id="background_color"
                    type="color"
                    value={form.background_color || "#F5F3FF"}
                    onChange={(e) => onUpdate({ background_color: e.target.value })}
                    className="w-0 h-0 opacity-0 absolute"
                  />
                  <Input
                    value={form.background_color || "#F5F3FF"}
                    onChange={(e) => onUpdate({ background_color: e.target.value })}
                    placeholder="#F5F3FF"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo & Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image className="w-5 h-5" />
              Branding
            </CardTitle>
            <CardDescription>
              Add your logo and header image
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo URL */}
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="logo_url"
                  value={form.logo_url || ""}
                  onChange={(e) => onUpdate({ logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                {form.logo_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onUpdate({ logo_url: undefined })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {form.logo_url && (
                <div className="mt-2 p-2 bg-secondary rounded-lg inline-block">
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    className="max-h-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}
            </div>

            {/* Header Image URL */}
            <div>
              <Label htmlFor="header_image_url">Header Image URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="header_image_url"
                  value={form.header_image_url || ""}
                  onChange={(e) => onUpdate({ header_image_url: e.target.value })}
                  placeholder="https://example.com/header.jpg"
                />
                {form.header_image_url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onUpdate({ header_image_url: undefined })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {form.header_image_url && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <img
                    src={form.header_image_url}
                    alt="Header preview"
                    className="w-full max-h-32 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Live Preview
          </h3>
        </div>

        <div
          className="rounded-xl border overflow-hidden shadow-lg"
          style={{ backgroundColor: form.background_color || "#F5F3FF" }}
        >
          {/* Header Image */}
          {form.header_image_url && (
            <div className="h-32 overflow-hidden">
              <img
                src={form.header_image_url}
                alt="Header"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
          )}

          {/* Form Content Preview */}
          <div className="p-6 bg-white/90 backdrop-blur mx-4 my-6 rounded-xl shadow-sm">
            {/* Logo */}
            {form.logo_url && (
              <div className="flex justify-center mb-4">
                <img
                  src={form.logo_url}
                  alt="Logo"
                  className="max-h-12 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
            )}

            {/* Title */}
            <h1
              className="text-xl font-bold text-center mb-2"
              style={{ color: form.primary_color || "#8B5CF6" }}
            >
              {form.name || "Form Title"}
            </h1>

            {/* Description */}
            {form.description && (
              <p className="text-sm text-muted-foreground text-center mb-6">
                {form.description}
              </p>
            )}

            {/* Sample Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </label>
                <div
                  className="h-10 rounded-md border bg-secondary/30"
                  style={{ borderColor: `${form.primary_color}30` || "#8B5CF630" }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <div
                  className="h-10 rounded-md border bg-secondary/30"
                  style={{ borderColor: `${form.primary_color}30` || "#8B5CF630" }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Message</label>
                <div
                  className="h-24 rounded-md border bg-secondary/30"
                  style={{ borderColor: `${form.primary_color}30` || "#8B5CF630" }}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              className="w-full mt-6 h-10 rounded-md text-white font-medium"
              style={{ backgroundColor: form.primary_color || "#8B5CF6" }}
            >
              {form.submit_button_text || "Submit"}
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pb-4">
            <p className="text-xs text-muted-foreground">
              Powered by AMASI Forms
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
