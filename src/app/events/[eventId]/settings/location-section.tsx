"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin } from "lucide-react"
import { type SectionProps } from "./types"

export function LocationSection({ formData, updateField }: SectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-success" />
        </div>
        <div>
          <h3 className="font-semibold">Location</h3>
          <p className="text-sm text-muted-foreground">Where is your event taking place?</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div>
          <label className="text-sm font-medium text-foreground">Venue Name</label>
          <Input
            value={formData.venue_name || ""}
            onChange={(e) => updateField("venue_name", e.target.value)}
            placeholder="Grand Convention Center"
            className="mt-1.5"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Venue Address</label>
          <Input
            value={formData.venue_address || ""}
            onChange={(e) => updateField("venue_address", e.target.value)}
            placeholder="123 Main Street, Near City Mall"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Street address used in travel emails and invitation letters</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">City</label>
            <Input
              value={formData.city || ""}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="Chennai"
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">State / Province</label>
            <Input
              value={formData.state || ""}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder="Tamil Nadu"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Country</label>
          <Select
            value={
              ["India", "United States", "United Kingdom", "Singapore", "UAE", "Malaysia", "Sri Lanka", "Bangladesh", "Nepal", "Thailand", "Australia", "Canada", "Germany", "France"].includes(formData.country || "")
                ? formData.country
                : formData.country ? "Other" : "India"
            }
            onValueChange={(value) => {
              if (value === "Other") {
                updateField("country", "")
              } else {
                updateField("country", value)
              }
            }}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="India">India</SelectItem>
              <SelectItem value="United States">United States</SelectItem>
              <SelectItem value="United Kingdom">United Kingdom</SelectItem>
              <SelectItem value="Singapore">Singapore</SelectItem>
              <SelectItem value="UAE">UAE</SelectItem>
              <SelectItem value="Malaysia">Malaysia</SelectItem>
              <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
              <SelectItem value="Bangladesh">Bangladesh</SelectItem>
              <SelectItem value="Nepal">Nepal</SelectItem>
              <SelectItem value="Thailand">Thailand</SelectItem>
              <SelectItem value="Australia">Australia</SelectItem>
              <SelectItem value="Canada">Canada</SelectItem>
              <SelectItem value="Germany">Germany</SelectItem>
              <SelectItem value="France">France</SelectItem>
              <SelectItem value="Other">Other...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Custom country input when Other is selected */}
        {formData.country !== undefined && !["India", "United States", "United Kingdom", "Singapore", "UAE", "Malaysia", "Sri Lanka", "Bangladesh", "Nepal", "Thailand", "Australia", "Canada", "Germany", "France"].includes(formData.country || "India") && (
          <div>
            <label className="text-sm font-medium text-foreground">Country Name</label>
            <Input
              value={formData.country || ""}
              onChange={(e) => updateField("country", e.target.value)}
              placeholder="Enter country name"
              className="mt-1.5"
              autoFocus
            />
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground">Google Maps URL</label>
          <Input
            type="url"
            value={formData.venue_map_url || ""}
            onChange={(e) => updateField("venue_map_url", e.target.value)}
            placeholder="https://maps.google.com/..."
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">Paste a Google Maps share link. Shown on registration page and in emails.</p>
        </div>
      </div>
    </div>
  )
}
