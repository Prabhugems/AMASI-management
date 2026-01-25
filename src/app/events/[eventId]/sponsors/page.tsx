"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Award,
  Grid3X3,
  Users,
  ArrowRight,
  Loader2,
  Plus,
  CheckCircle,
  Clock,
  IndianRupee,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Sponsor = {
  id: string
  name: string
  logo_url: string | null
  status: string
  amount_agreed: number
  amount_paid: number
  tier_id: string | null
  sponsor_tiers?: { name: string; color: string } | null
}

type Tier = {
  id: string
  name: string
  color: string
  display_order: number
}

type Stall = {
  id: string
  stall_number: string
  status: string
  sponsor_id: string | null
}

export default function SponsorsOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch sponsors
  const { data: sponsorsRaw, isLoading: sponsorsLoading } = useQuery({
    queryKey: ["sponsors", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsors")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
      return (data || []) as Sponsor[]
    },
  })

  // Fetch tiers
  const { data: tiers } = useQuery({
    queryKey: ["sponsor-tiers", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("sponsor_tiers")
        .select("*")
        .eq("event_id", eventId)
        .order("display_order")
      return (data || []) as Tier[]
    },
  })

  // Fetch stalls
  const { data: stalls } = useQuery({
    queryKey: ["stalls", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stalls")
        .select("*")
        .eq("event_id", eventId)
      return (data || []) as Stall[]
    },
  })

  // Map tier info
  const tierMap = useMemo(() => {
    if (!tiers) return {}
    return tiers.reduce((acc, t) => {
      acc[t.id] = { name: t.name, color: t.color }
      return acc
    }, {} as Record<string, { name: string; color: string }>)
  }, [tiers])

  // Combine sponsors with tier data
  const sponsors = useMemo(() => {
    if (!sponsorsRaw) return []
    return sponsorsRaw.map(s => ({
      ...s,
      sponsor_tiers: s.tier_id ? tierMap[s.tier_id] || null : null
    }))
  }, [sponsorsRaw, tierMap])

  // Calculate stats
  const stats = useMemo(() => {
    const totalSponsors = sponsors?.length || 0
    const confirmed = sponsors?.filter(s => s.status === "confirmed").length || 0
    const pending = sponsors?.filter(s => s.status === "pending").length || 0

    const totalAgreed = sponsors?.reduce((sum, s) => sum + Number(s.amount_agreed), 0) || 0
    const totalPaid = sponsors?.reduce((sum, s) => sum + Number(s.amount_paid), 0) || 0

    const totalStalls = stalls?.length || 0
    const assignedStalls = stalls?.filter(s => s.sponsor_id).length || 0
    const availableStalls = stalls?.filter(s => s.status === "available" && !s.sponsor_id).length || 0

    // Sponsors by tier
    const byTier = tiers?.map(tier => ({
      ...tier,
      count: sponsors?.filter(s => s.tier_id === tier.id).length || 0,
    })) || []

    return {
      totalSponsors,
      confirmed,
      pending,
      totalAgreed,
      totalPaid,
      totalStalls,
      assignedStalls,
      availableStalls,
      byTier,
    }
  }, [sponsors, stalls, tiers])

  const basePath = `/events/${eventId}/sponsors`

  if (sponsorsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sponsors Overview</h1>
          <p className="text-muted-foreground">Manage sponsors, tiers, and exhibition stalls</p>
        </div>
        <Link href={`${basePath}/list`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Sponsor
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="text-sm">Total Sponsors</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats.totalSponsors}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Confirmed</span>
          </div>
          <p className="text-3xl font-bold mt-2 text-green-600">{stats.confirmed}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Grid3X3 className="h-4 w-4" />
            <span className="text-sm">Stalls Assigned</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats.assignedStalls}/{stats.totalStalls}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Revenue Collected</span>
          </div>
          <p className="text-2xl font-bold mt-2 flex items-center">
            <IndianRupee className="h-5 w-5" />
            {stats.totalPaid.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">of ₹{stats.totalAgreed.toLocaleString()}</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Sponsors by Tier */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Sponsors by Tier</h3>
            <Link href={`${basePath}/tiers`}>
              <Button variant="ghost" size="sm">
                Manage Tiers <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {stats.byTier.length === 0 ? (
            <div className="text-center py-8">
              <Award className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No sponsor tiers created</p>
              <Link href={`${basePath}/tiers`}>
                <Button size="sm">Create Tiers</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.byTier.map(tier => (
                <div
                  key={tier.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: tier.color }}
                    />
                    <span className="font-medium">{tier.name}</span>
                  </div>
                  <span className="text-2xl font-bold">{tier.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sponsors */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Sponsors</h3>
            <Link href={`${basePath}/list`}>
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {!sponsors || sponsors.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No sponsors added yet</p>
              <Link href={`${basePath}/list`}>
                <Button size="sm">Add Sponsor</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {sponsors.slice(0, 5).map(sponsor => (
                <div
                  key={sponsor.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {sponsor.logo_url ? (
                      <img
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        className="w-10 h-10 object-contain rounded border bg-white"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{sponsor.name}</p>
                      {sponsor.sponsor_tiers && (
                        <p className="text-xs" style={{ color: sponsor.sponsor_tiers.color }}>
                          {sponsor.sponsor_tiers.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded",
                    sponsor.status === "confirmed" ? "bg-green-100 text-green-700" :
                    sponsor.status === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {sponsor.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stall Summary */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Exhibition Stalls</h3>
          <div className="flex gap-2">
            <Link href={`${basePath}/floor-plan`}>
              <Button variant="outline" size="sm">
                Floor Plan
              </Button>
            </Link>
            <Link href={`${basePath}/stalls`}>
              <Button variant="ghost" size="sm">
                Manage <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-3xl font-bold">{stats.totalStalls}</p>
            <p className="text-sm text-muted-foreground">Total Stalls</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50">
            <p className="text-3xl font-bold text-green-600">{stats.assignedStalls}</p>
            <p className="text-sm text-green-600">Assigned</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-blue-50">
            <p className="text-3xl font-bold text-blue-600">{stats.availableStalls}</p>
            <p className="text-sm text-blue-600">Available</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/list`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Building2 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Sponsors</p>
          <p className="text-xs text-muted-foreground">Manage sponsors</p>
        </Link>

        <Link
          href={`${basePath}/tiers`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Award className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Tiers</p>
          <p className="text-xs text-muted-foreground">Sponsorship levels</p>
        </Link>

        <Link
          href={`${basePath}/stalls`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Grid3X3 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Stalls</p>
          <p className="text-xs text-muted-foreground">Exhibition booths</p>
        </Link>

        <Link
          href={`${basePath}/floor-plan`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Grid3X3 className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Floor Plan</p>
          <p className="text-xs text-muted-foreground">Visual layout</p>
        </Link>
      </div>
    </div>
  )
}
