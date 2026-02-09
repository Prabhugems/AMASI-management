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
  Send,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  FileImage,
  Award,
  Mail,
  GraduationCap,
} from "lucide-react"
import { HelpTooltip } from "@/components/ui/help-tooltip"

export default function CertificatesOverviewPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch registrations
  const { data: registrations, isLoading: regLoading } = useQuery({
    queryKey: ["certificate-registrations", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, status, custom_fields")
        .eq("event_id", eventId)

      return data || []
    },
  })

  // Fetch certificate templates via API route (bypasses RLS)
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ["certificate-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch templates")
      const allTemplates = await res.json()
      return allTemplates.filter((t: any) => t.is_active) as { id: string; name: string }[]
    },
  })

  // Stats
  const stats = useMemo(() => {
    if (!registrations) return null

    const total = registrations.length
    const generated = registrations.filter((r: any) =>
      r.custom_fields?.certificate_generated
    ).length
    const sent = registrations.filter((r: any) =>
      r.custom_fields?.certificate_sent
    ).length
    const confirmed = registrations.filter((r: any) => r.status === "confirmed").length

    return {
      total,
      generated,
      sent,
      pending: total - generated,
      confirmed,
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

  const basePath = `/events/${eventId}/certificates`

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Certificates Overview</h1>
        <p className="text-muted-foreground">Design, generate, and send event certificates</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Total Attendees</span>
            <HelpTooltip content="All registered attendees who can receive certificates. Certificates are usually issued only to checked-in or confirmed attendees." />
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.total || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Generated</span>
            <HelpTooltip content="Certificates that have been created and are ready to send. Generate certificates from the 'Generate' tab." />
          </div>
          <p className="text-3xl font-bold mt-2 text-green-600">{stats?.generated || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-blue-500">
            <Mail className="h-4 w-4" />
            <span className="text-sm">Sent</span>
            <HelpTooltip content="Certificates emailed to attendees. They receive a link to download their certificate." />
          </div>
          <p className="text-3xl font-bold mt-2 text-blue-500">{stats?.sent || 0}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm">Templates</span>
            <HelpTooltip content="Certificate design templates. Create different templates for delegates, speakers, or award winners." />
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.templates || 0}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-semibold mb-4">Certificate Generation Progress</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Generated</span>
            <span className="font-medium">{stats?.generated || 0} / {stats?.total || 0}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-green-600 h-3 rounded-full transition-all"
              style={{ width: `${stats?.total ? (stats.generated / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="space-y-2 mt-4">
          <div className="flex justify-between text-sm">
            <span>Sent via Email</span>
            <span className="font-medium">{stats?.sent || 0} / {stats?.generated || 0}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all"
              style={{ width: `${stats?.generated ? (stats.sent / stats.generated) * 100 : 0}%` }}
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
                  <p className="font-medium">Design Certificate</p>
                  <p className="text-xs text-muted-foreground">Create or edit certificate design</p>
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
                  <p className="font-medium">Generate Certificates</p>
                  <p className="text-xs text-muted-foreground">Bulk generate for attendees</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>

            <Link
              href={`${basePath}/send`}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Send Certificates</p>
                  <p className="text-xs text-muted-foreground">Email to attendees</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Certificate Templates</h3>
            <Link href={`${basePath}/templates`}>
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>

          {!templates?.length ? (
            <div className="text-center py-8 bg-muted/30 rounded-lg border border-dashed">
              <Award className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
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
                    <Award className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">{template.name}</span>
                  </div>
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
            Certificates Pending
          </h3>
          <p className="text-sm text-amber-600 mb-3">
            {stats?.pending} attendees don't have their certificates generated yet.
          </p>
          <Link href={`${basePath}/generate`}>
            <Button size="sm" variant="outline">Generate Certificates</Button>
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
          <p className="text-xs text-muted-foreground">Create certificates</p>
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
          href={`${basePath}/verify`}
          className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow text-center"
        >
          <CheckCircle className="h-6 w-6 mx-auto text-primary mb-2" />
          <p className="font-medium">Verify</p>
          <p className="text-xs text-muted-foreground">Validate certificates</p>
        </Link>
      </div>
    </div>
  )
}
