"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Users,
  UserPlus,
  Sparkles,
  Phone,
  TrendingUp,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { Lead } from "./leads-types"
import LeadsPipeline from "./leads-pipeline"
import { LeadsTable } from "./leads-table"
import LeadsAnalytics from "./leads-analytics"
import { LeadDetailSheet } from "./lead-detail-sheet"
import { AddLeadDialog } from "./add-lead-dialog"

interface AnalyticsData {
  byStatus: Record<string, number>
  bySource: Record<string, number>
  total: number
  conversionRate: number
}

export default function EventLeadsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [activeTab, setActiveTab] = useState("pipeline")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  // Fetch leads
  const {
    data: leadsData,
    isLoading: leadsLoading,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["event-leads", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads?limit=200`)
      if (!res.ok) throw new Error("Failed to fetch leads")
      return res.json() as Promise<{ data: Lead[]; count: number }>
    },
    enabled: !!eventId,
  })

  // Fetch analytics
  const { data: analytics, refetch: refetchAnalytics } = useQuery({
    queryKey: ["event-leads-analytics", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/leads/analytics`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      return res.json() as Promise<AnalyticsData>
    },
    enabled: !!eventId,
  })

  const leads = leadsData?.data || []
  const totalCount = leadsData?.count ?? leads.length

  const handleRefresh = () => {
    refetchLeads()
    refetchAnalytics()
  }

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead)
    setDetailOpen(true)
  }

  const statCards = [
    {
      label: "Total Leads",
      value: analytics?.total ?? totalCount,
      icon: Users,
      accent: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "New",
      value: analytics?.byStatus?.new ?? leads.filter((l) => l.status === "new").length,
      icon: Sparkles,
      accent: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/40",
    },
    {
      label: "Contacted",
      value: analytics?.byStatus?.contacted ?? leads.filter((l) => l.status === "contacted").length,
      icon: Phone,
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "Converted",
      value: analytics?.byStatus?.converted ?? leads.filter((l) => l.status === "converted").length,
      icon: TrendingUp,
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCount > 0
              ? `${totalCount} lead${totalCount !== 1 ? "s" : ""} tracked`
              : "Track and manage event interest"}
          </p>
        </div>
        <Button className="w-fit" onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-card rounded-xl border p-4 flex items-start gap-3 transition-shadow hover:shadow-sm"
            >
              <div className={cn("p-2 rounded-lg", stat.bg)}>
                <Icon className={cn("w-4 h-4", stat.accent)} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold text-foreground tabular-nums mt-0.5">
                  {stat.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          {leadsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <LeadsPipeline
              leads={leads}
              eventId={eventId}
              onSelectLead={handleSelectLead}
              onStatusChange={handleRefresh}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <LeadsTable
            leads={leads}
            eventId={eventId}
            isLoading={leadsLoading}
            onSelectLead={handleSelectLead}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <LeadsAnalytics eventId={eventId} />
        </TabsContent>
      </Tabs>

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        eventId={eventId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedLead(null)
        }}
        onUpdate={handleRefresh}
      />

      {/* Add Lead Dialog */}
      <AddLeadDialog
        eventId={eventId}
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
