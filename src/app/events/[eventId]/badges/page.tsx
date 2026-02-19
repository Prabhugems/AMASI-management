"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Users,
  Palette,
  FolderOpen,
  Download,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileImage,
  Lock,
  BookOpen,
} from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

export default function BadgesOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch all registrations (delegates)
  const { data: registrations, isLoading: regLoading } = useQuery({
    queryKey: ["badge-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, status, badge_generated_at, checked_in")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Fetch badge templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("badge_templates")
        .select("id, name, is_locked, locked_at, badges_generated_count")
        .eq("event_id", eventId)

      return data || []
    },
    staleTime: 0,
    refetchOnMount: "always",
  })

  // Stats — one badge per registration (no double-counting with faculty_assignments)
  const stats = useMemo(() => {
    if (!registrations) return null

    const total = registrations.length

    const printed = registrations.filter((r: any) => r.badge_generated_at).length
    const checkedIn = registrations.filter((r: any) => r.checked_in).length

    return {
      total,
      printed,
      pending: Math.max(0, total - printed),
      checkedIn,
      templates: templates?.length || 0,
    }
  }, [registrations, templates])

  if (regLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const basePath = `/events/${eventId}/badges`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Badges Overview</h1>
        <p className="text-muted-foreground">Design, generate, and print event badges</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Attendees</span>
            <HelpTooltip content="Total confirmed registrations (delegates + speakers) who need badges" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2">{stats?.total || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Badges Printed</span>
            <HelpTooltip content="Badges that have been generated. These can be downloaded or printed." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-green-600">{stats?.printed || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Pending Print</span>
            <HelpTooltip content="Attendees who don't have a badge yet. Generate badges for them before the event." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2 text-amber-500">{stats?.pending || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm">Templates</span>
            <HelpTooltip content="Badge design templates. Create different templates for delegates, speakers, or VIPs." />
          </div>
          <p className="text-2xl sm:text-3xl font-bold mt-2">{stats?.templates || 0}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Badge Printing Progress</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Printed</span>
            <span className="font-medium">{stats?.printed || 0} / {stats?.total || 0}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all"
              style={{ width: `${stats?.total ? (stats.printed / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Get Started */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              href={`${basePath}/designer`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">Design Badge</p>
                  <p className="text-xs text-muted-foreground">Create or edit badge design</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/generate`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">Generate Badges</p>
                  <p className="text-xs text-muted-foreground">Bulk generate for attendees</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/setup`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-medium">Setup Guide</p>
                  <p className="text-xs text-muted-foreground">Step-by-step checklist</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Badge Templates</h3>
            <Link href={`${basePath}/templates`}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>

          {!templates?.length ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
              <FileImage className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No templates yet</p>
              <Link href={`${basePath}/designer`}>
                <Button size="sm">Create First Template</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.slice(0, 3).map((template: any) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <FileImage className="h-5 w-5 text-purple-500" />
                    <div>
                      <span className="font-medium">{template.name}</span>
                      {template.badges_generated_count > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {template.badges_generated_count} badges generated
                        </p>
                      )}
                    </div>
                  </div>
                  {template.is_locked && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Lock className="h-4 w-4" />
                      <span className="text-xs">Locked</span>
                    </div>
                  )}
                </div>
              ))}
              {templates.length > 3 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  +{templates.length - 3} more templates
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(stats?.pending || 0) > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Badges Pending
          </h3>
          <p className="text-sm text-amber-600 mb-3">
            {stats?.pending} attendees don't have their badges printed yet.
          </p>
          <Link href={`${basePath}/generate`}>
            <Button size="sm" variant="outline">Generate Badges</Button>
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href={`${basePath}/designer`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Palette className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Designer</p>
          <p className="text-xs text-muted-foreground">Create badges</p>
        </Link>

        <Link
          href={`${basePath}/templates`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <FolderOpen className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Templates</p>
          <p className="text-xs text-muted-foreground">Saved designs</p>
        </Link>

        <Link
          href={`${basePath}/generate`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <Download className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Generate</p>
          <p className="text-xs text-muted-foreground">Bulk create</p>
        </Link>

        <Link
          href={`${basePath}/setup`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <BookOpen className="h-6 w-6 mx-auto text-amber-500 mb-2" />
          <p className="font-medium">Setup</p>
          <p className="text-xs text-muted-foreground">Guide & checklist</p>
        </Link>
      </div>
    </div>
  )
}
