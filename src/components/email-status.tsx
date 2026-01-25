"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Send,
  Inbox,
  Eye,
  MousePointerClick,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface EmailStatusProps {
  registrationId?: string
  emailType?: string
  resendEmailId?: string
  className?: string
  showDetails?: boolean
}

type EmailLog = {
  id: string
  email_type: string
  status: string
  sent_at: string
  delivered_at: string | null
  opened_at: string | null
  first_opened_at: string | null
  clicked_at: string | null
  first_clicked_at: string | null
  bounced_at: string | null
  complained_at: string | null
  responded_at: string | null
  response_type: string | null
  open_count: number
  click_count: number
  error_message: string | null
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  responded: { label: "Responded", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  clicked: { label: "Clicked", icon: MousePointerClick, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  opened: { label: "Opened", icon: Eye, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  delivered: { label: "Delivered", icon: Inbox, color: "text-teal-600", bg: "bg-teal-50 border-teal-200" },
  sent: { label: "Sent", icon: Send, color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
  bounced: { label: "Bounced", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  complained: { label: "Spam", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  delayed: { label: "Delayed", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
}

function getEmailStatus(email: EmailLog) {
  if (email.responded_at) return "responded"
  if (email.clicked_at) return "clicked"
  if (email.opened_at) return "opened"
  if (email.status === "bounced" || email.bounced_at) return "bounced"
  if (email.status === "complained" || email.complained_at) return "complained"
  if (email.status === "delayed") return "delayed"
  if (email.delivered_at) return "delivered"
  return "sent"
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function EmailStatus({
  registrationId,
  emailType,
  resendEmailId,
  className,
  showDetails = false,
}: EmailStatusProps) {
  const supabase = createClient()

  const { data: emails, isLoading } = useQuery({
    queryKey: ["email-status", registrationId, emailType, resendEmailId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })

      if (resendEmailId) {
        query = query.eq("resend_email_id", resendEmailId)
      } else if (registrationId) {
        query = query.eq("registration_id", registrationId)
        if (emailType) {
          query = query.eq("email_type", emailType)
        }
      }

      const { data, error } = await query.limit(5)
      if (error) throw error
      return data as EmailLog[]
    },
    enabled: !!(registrationId || resendEmailId),
    staleTime: 30000, // Refresh every 30 seconds
  })

  if (isLoading || !emails || emails.length === 0) {
    return null
  }

  const latestEmail = emails[0]
  const status = getEmailStatus(latestEmail)
  const config = statusConfig[status] || { label: "Unknown", icon: HelpCircle, color: "text-gray-400", bg: "bg-gray-50" }
  const Icon = config.icon

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1", config.bg, config.color, className)}>
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p><strong>Sent:</strong> {formatDateTime(latestEmail.sent_at)}</p>
              {latestEmail.delivered_at && <p><strong>Delivered:</strong> {formatDateTime(latestEmail.delivered_at)}</p>}
              {latestEmail.opened_at && (
                <p><strong>Opened:</strong> {formatDateTime(latestEmail.first_opened_at)} ({latestEmail.open_count}x)</p>
              )}
              {latestEmail.clicked_at && (
                <p><strong>Clicked:</strong> {formatDateTime(latestEmail.first_clicked_at)} ({latestEmail.click_count}x)</p>
              )}
              {latestEmail.responded_at && <p><strong>Responded:</strong> {formatDateTime(latestEmail.responded_at)}</p>}
              {latestEmail.error_message && <p className="text-red-500"><strong>Error:</strong> {latestEmail.error_message}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Detailed view
  return (
    <div className={cn("space-y-2", className)}>
      {emails.map((email) => {
        const emailStatus = getEmailStatus(email)
        const emailConfig = statusConfig[emailStatus] || statusConfig.sent
        const EmailIcon = emailConfig.icon

        return (
          <div key={email.id} className={cn("rounded-lg border p-3", emailConfig.bg)}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <EmailIcon className={cn("h-4 w-4", emailConfig.color)} />
                <span className={cn("font-medium text-sm", emailConfig.color)}>{emailConfig.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {email.email_type.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <Send className="h-3 w-3 text-gray-400" />
                <span className="text-muted-foreground">Sent:</span>
                <span>{formatDateTime(email.sent_at)}</span>
              </div>

              {email.delivered_at && (
                <div className="flex items-center gap-1">
                  <Inbox className="h-3 w-3 text-teal-500" />
                  <span className="text-muted-foreground">Delivered:</span>
                  <span>{formatDateTime(email.delivered_at)}</span>
                </div>
              )}

              {email.opened_at && (
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-purple-500" />
                  <span className="text-muted-foreground">Opened:</span>
                  <span>{formatDateTime(email.first_opened_at)} ({email.open_count}x)</span>
                </div>
              )}

              {email.clicked_at && (
                <div className="flex items-center gap-1">
                  <MousePointerClick className="h-3 w-3 text-blue-500" />
                  <span className="text-muted-foreground">Clicked:</span>
                  <span>{formatDateTime(email.first_clicked_at)} ({email.click_count}x)</span>
                </div>
              )}

              {email.responded_at && (
                <div className="flex items-center gap-1 col-span-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span className="text-muted-foreground">Responded:</span>
                  <span>{formatDateTime(email.responded_at)}</span>
                  {email.response_type && <Badge variant="outline" className="ml-1 text-xs">{email.response_type}</Badge>}
                </div>
              )}

              {email.error_message && (
                <div className="flex items-center gap-1 col-span-2 text-red-600">
                  <XCircle className="h-3 w-3" />
                  <span>{email.error_message}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Simple inline status badge for tables
export function EmailStatusBadge({
  registrationId,
  emailType,
}: {
  registrationId: string
  emailType: string
}) {
  const supabase = createClient()

  const { data: email } = useQuery({
    queryKey: ["email-status-badge", registrationId, emailType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_logs")
        .select("status, delivered_at, opened_at, clicked_at, responded_at, bounced_at")
        .eq("registration_id", registrationId)
        .eq("email_type", emailType)
        .order("sent_at", { ascending: false })
        .limit(1)
        .single()

      if (error) return null
      return data as EmailLog
    },
    enabled: !!registrationId,
    staleTime: 30000,
  })

  if (!email) return null

  const status = getEmailStatus(email as EmailLog)
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}
