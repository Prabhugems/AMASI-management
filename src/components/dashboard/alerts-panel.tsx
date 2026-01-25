"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, Clock, Mail, CreditCard, Hotel, LucideIcon } from "lucide-react"
import { PremiumAlertCard } from "./premium-alert-card"
import { useTheme } from "next-themes"

interface Alert {
  id: string
  type: "critical" | "warning" | "info" | "success"
  icon: LucideIcon
  title: string
  description: string
  action: string
  actionHref?: string
  dismissible?: boolean
  count?: number
  time?: string
}

const initialAlerts: Alert[] = [
  {
    id: "1",
    type: "critical",
    icon: Clock,
    title: "12 Faculty Haven't Responded",
    description: "AMASICON 2026 - Invitations sent 7+ days ago. Follow up required to confirm participation.",
    action: "Send Reminders",
    actionHref: "/events/amasicon-2026/faculty?filter=no_response",
    count: 12,
    time: "7 days",
  },
  {
    id: "2",
    type: "warning",
    icon: Mail,
    title: "3 Emails Bounced",
    description: "Update email addresses for these faculty members to ensure communications.",
    action: "View Details",
    actionHref: "/communications?filter=bounced",
    count: 3,
    time: "2h ago",
  },
  {
    id: "3",
    type: "info",
    icon: CreditCard,
    title: "TDS Filing Due",
    description: "Q3 TDS return due in 5 days for Rs.2,45,000. Prepare documentation.",
    action: "View Report",
    actionHref: "/finance/tds",
    dismissible: true,
    time: "5 days left",
  },
  {
    id: "4",
    type: "success",
    icon: Hotel,
    title: "Hotel Block Release Tomorrow",
    description: "AMASICON 2026 - Confirm remaining 15 rooms or they will be released.",
    action: "Manage Hotels",
    actionHref: "/events/amasicon-2026/accommodation",
    dismissible: true,
    count: 15,
    time: "Tomorrow",
  },
]

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted ? resolvedTheme === "dark" : false

  const dismissAlert = (id: string) => {
    setAlerts(alerts.filter((alert) => alert.id !== id))
  }

  if (alerts.length === 0) {
    return (
      <div
        className={`
        relative overflow-hidden rounded-3xl p-16 text-center
        ${isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-white border border-gray-200"}
      `}
      >
        <div
          className={`absolute inset-0 ${
            isDark ? "bg-gradient-to-br from-emerald-900/30 to-teal-900/30" : "bg-gradient-to-br from-emerald-50 to-teal-50"
          }`}
        />
        <div className="relative z-10">
          <div className="inline-flex p-8 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-6 shadow-2xl shadow-emerald-500/40">
            <AlertTriangle className="w-16 h-16 text-white" />
          </div>
          <h3 className={`text-3xl font-black mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>All Caught Up!</h3>
          <p className={`max-w-sm mx-auto ${isDark ? "text-slate-400" : "text-gray-500"}`}>
            No pending alerts. Great job staying on top of things!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div
        className={`
        flex items-center justify-between p-5 rounded-2xl
        transition-all duration-300
        ${isDark ? "bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm" : "bg-white border border-gray-200 shadow-sm"}
      `}
      >
        <div className="flex items-center gap-4">
          <div
            className={`
            p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600
            transition-all duration-300 shadow-lg shadow-amber-500/30
            group-hover:scale-110 group-hover:rotate-12
          `}
          >
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Needs Attention</h2>
            <p className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}>Action required items</p>
          </div>
        </div>

        <div
          className={`
          flex items-center gap-2 px-5 py-3 rounded-xl
          transition-all duration-300
          ${isDark ? "bg-slate-700/50 border border-slate-600/50" : "bg-gray-100 border border-gray-200"}
        `}
        >
          <span className={`text-3xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>{alerts.length}</span>
          <span className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}>items</span>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {alerts.map((alert, index) => (
          <PremiumAlertCard
            key={alert.id}
            icon={alert.icon}
            title={alert.title}
            description={alert.description}
            action={alert.action}
            actionHref={alert.actionHref}
            type={alert.type}
            delay={index * 150}
            onDismiss={() => dismissAlert(alert.id)}
            count={alert.count}
            time={alert.time}
            dismissible={alert.dismissible !== false}
          />
        ))}
      </div>
    </div>
  )
}
