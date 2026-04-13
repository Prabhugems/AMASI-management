export interface Lead {
  id: string
  event_id: string
  email: string
  name: string | null
  phone: string | null
  source: string
  status: LeadStatus
  visitor_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  notes: string | null
  registration_id: string | null
  converted_at: string | null
  created_at: string
  updated_at: string | null
}

export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "unsubscribed"

export interface LeadNote {
  id: string
  lead_id: string
  content: string
  type: "note" | "status_change" | "email_sent" | "call"
  created_by: string | null
  created_at: string
}

export const LEAD_STATUSES: { value: LeadStatus; label: string; color: string; bgColor: string }[] = [
  { value: "new", label: "New", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/50" },
  { value: "contacted", label: "Contacted", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/50" },
  { value: "qualified", label: "Qualified", color: "text-purple-700 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950/50" },
  { value: "converted", label: "Converted", color: "text-emerald-700 dark:text-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/50" },
  { value: "unsubscribed", label: "Unsubscribed", color: "text-gray-500 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
]

export const LEAD_SOURCES = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "email_campaign", label: "Email Campaign" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone Call" },
  { value: "notify_me", label: "Notify Me" },
  { value: "manual", label: "Manual Entry" },
  { value: "csv_import", label: "CSV Import" },
  { value: "other", label: "Other" },
]
