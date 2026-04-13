"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, AlertTriangle } from "lucide-react"
import { type SectionProps } from "./types"

export function DatetimeSection({ formData, updateField }: SectionProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-info" />
        </div>
        <div>
          <h3 className="font-semibold">Date & Time</h3>
          <p className="text-sm text-muted-foreground">When is your event happening?</p>
        </div>
      </div>

      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-foreground">Start Date</label>
            <Input
              type="date"
              value={formData.start_date?.split("T")[0] || ""}
              onChange={(e) => updateField("start_date", e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">End Date</label>
            <Input
              type="date"
              value={formData.end_date?.split("T")[0] || ""}
              onChange={(e) => updateField("end_date", e.target.value)}
              className="mt-1.5"
            />
            {formData.end_date && formData.start_date && formData.end_date < formData.start_date && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                End date must be after start date
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Registration Deadline</label>
          <Input
            type="datetime-local"
            value={formData.registration_deadline?.slice(0, 16) || ""}
            onChange={(e) => updateField("registration_deadline", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Optional. Registration auto-closes at this date/time regardless of the Registration Open toggle.
          </p>
          {formData.registration_deadline && new Date(formData.registration_deadline) < new Date() && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Deadline has already passed — registration is effectively closed
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground">Timezone</label>
          <Select
            value={formData.timezone || "Asia/Kolkata"}
            onValueChange={(value) => updateField("timezone", value)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Asia/Kolkata">India Standard Time (IST, UTC+5:30)</SelectItem>
              <SelectItem value="Asia/Singapore">Singapore Time (SGT, UTC+8:00)</SelectItem>
              <SelectItem value="Asia/Dubai">Gulf Standard Time (GST, UTC+4:00)</SelectItem>
              <SelectItem value="Asia/Colombo">Sri Lanka Time (SLST, UTC+5:30)</SelectItem>
              <SelectItem value="Asia/Kuala_Lumpur">Malaysia Time (MYT, UTC+8:00)</SelectItem>
              <SelectItem value="Asia/Bangkok">Indochina Time (ICT, UTC+7:00)</SelectItem>
              <SelectItem value="Australia/Sydney">Australian Eastern (AEST, UTC+10:00)</SelectItem>
              <SelectItem value="Europe/London">British Time (GMT/BST)</SelectItem>
              <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
              <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
              <SelectItem value="UTC">UTC</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
