"use client"

import { useQuery } from "@tanstack/react-query"
import { Activity, RefreshCw, Database, Mail, CreditCard, MessageCircle, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useState } from "react"

type ServiceStatus = "healthy" | "degraded" | "down" | "not_configured"

interface ServiceCheck {
  name: string
  status: ServiceStatus
  latency?: number
  provider?: string
}

interface HealthResponse {
  services: ServiceCheck[]
  overall: ServiceStatus
  checked_at: string
}

const STATUS_CONFIG: Record<ServiceStatus, { color: string; label: string; dotClass: string }> = {
  healthy: {
    color: "text-emerald-600 dark:text-emerald-400",
    label: "Healthy",
    dotClass: "bg-emerald-500",
  },
  degraded: {
    color: "text-amber-600 dark:text-amber-400",
    label: "Degraded",
    dotClass: "bg-amber-500",
  },
  down: {
    color: "text-red-600 dark:text-red-400",
    label: "Down",
    dotClass: "bg-red-500",
  },
  not_configured: {
    color: "text-gray-400 dark:text-slate-500",
    label: "Not configured",
    dotClass: "bg-gray-400 dark:bg-slate-500",
  },
}

const SERVICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Database: Database,
  Email: Mail,
  Payments: CreditCard,
  WhatsApp: MessageCircle,
}

export function HealthWidget() {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const { data, isLoading, refetch } = useQuery<HealthResponse>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const res = await fetch("/api/health")
      if (!res.ok) throw new Error("Failed to fetch health status")
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetch()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="paper-card">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h5 className="text-base font-semibold text-foreground">System Health</h5>
          </div>
        </div>
        <div className="p-5 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="paper-card">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h5 className="text-base font-semibold text-foreground">System Health</h5>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Refresh health status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Services List */}
      <div className="p-5 space-y-3">
        {data?.services.map((service) => {
          const config = STATUS_CONFIG[service.status]
          const Icon = SERVICE_ICONS[service.name] || Activity

          return (
            <div key={service.name} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{service.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`relative flex h-2 w-2`}>
                      {service.status === "healthy" && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotClass} opacity-75`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotClass}`} />
                    </span>
                    <span className={`text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {service.provider && (
                    <span className="text-[11px] text-muted-foreground capitalize">
                      {service.provider}
                    </span>
                  )}
                  {service.latency !== undefined && (
                    <span className="text-[11px] text-muted-foreground">
                      {service.latency}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {data?.checked_at && (
        <div className="card-stats-footer px-5 pb-4">
          <span className="text-xs text-muted-foreground/70">
            Checked {formatDistanceToNow(new Date(data.checked_at), { addSuffix: true })}
          </span>
        </div>
      )}
    </div>
  )
}
