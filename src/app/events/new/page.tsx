"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Loader2,
  Plus,
} from "lucide-react"
import Link from "next/link"

export default function CreateEventPage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    description: "",
    event_type: "conference",
    start_date: "",
    end_date: "",
    venue: "",
    city: "",
    state: "",
    country: "India",
    timezone: "Asia/Kolkata",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const createEvent = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        if (error.details) {
          setErrors(error.details)
        }
        throw new Error(error.error || "Failed to create event")
      }

      return response.json()
    },
    onSuccess: (data) => {
      toast.success("Event created successfully!")
      if (data.event?.id) {
        router.push(`/events/${data.event.id}/settings`)
      } else {
        router.push("/events")
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validation
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = "Event name is required"
    if (!formData.short_name.trim()) newErrors.short_name = "Short name is required"
    if (!formData.start_date) newErrors.start_date = "Start date is required"
    if (!formData.end_date) newErrors.end_date = "End date is required"
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = "End date must be after start date"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Convert dates to ISO format for the API
    createEvent.mutate({
      ...formData,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
    })
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/events">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h4 className="text-lg text-foreground font-semibold">Create New Event</h4>
            <p className="text-sm text-muted-foreground">
              Set up the basics, you can configure more details after creation
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {/* General Info */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 mb-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Event Details</h3>
              <p className="text-sm text-muted-foreground">Basic information about your event</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Event Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., 42nd Annual Conference of AMASI"
              className="mt-1.5"
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Short Name *</label>
              <Input
                value={formData.short_name}
                onChange={(e) => updateField("short_name", e.target.value)}
                placeholder="e.g., AMASI 2026"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Used in navigation and URLs</p>
              {errors.short_name && <p className="text-xs text-destructive mt-1">{errors.short_name}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Event Type</label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => updateField("event_type", value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="symposium">Symposium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of your event..."
              rows={3}
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 mb-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-info" />
            </div>
            <div>
              <h3 className="font-semibold">Date & Time</h3>
              <p className="text-sm text-muted-foreground">When is your event happening?</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">Start Date *</label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
                className="mt-1.5"
              />
              {errors.start_date && <p className="text-xs text-destructive mt-1">{errors.start_date}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">End Date *</label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
                className="mt-1.5"
              />
              {errors.end_date && <p className="text-xs text-destructive mt-1">{errors.end_date}</p>}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Timezone</label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => updateField("timezone", value)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Kolkata">India Standard Time (IST)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                <SelectItem value="Europe/London">British Time (GMT/BST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Location */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5 mb-6">
          <div className="flex items-center gap-3 pb-4 border-b border-border">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold">Location</h3>
              <p className="text-sm text-muted-foreground">Where is your event? (optional)</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Venue Name</label>
            <Input
              value={formData.venue}
              onChange={(e) => updateField("venue", e.target.value)}
              placeholder="e.g., Grand Convention Center"
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground">City</label>
              <Input
                value={formData.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="e.g., Chennai"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">State</label>
              <Input
                value={formData.state}
                onChange={(e) => updateField("state", e.target.value)}
                placeholder="e.g., Tamil Nadu"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Country</label>
              <Select
                value={formData.country}
                onValueChange={(value) => updateField("country", value)}
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
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" asChild>
            <Link href="/events">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createEvent.isPending} className="gap-2">
            {createEvent.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Event
              </>
            )}
          </Button>
        </div>
      </form>
    </DashboardLayout>
  )
}
