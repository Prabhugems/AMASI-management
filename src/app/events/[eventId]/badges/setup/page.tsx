"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Palette,
  FileText,
  Ticket,
  Printer,
  Sparkles,
  Info,
  ChevronRight,
  Settings,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SetupStep {
  id: string
  title: string
  description: string
  status: "complete" | "incomplete" | "warning"
  action?: { label: string; href: string }
  details?: string
}

export default function BadgeSetupPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()

  // Fetch badge templates
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ["badge-templates-setup", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      if (!res.ok) return []
      return res.json()
    },
  })

  // Fetch ticket types
  const { data: ticketTypes, isLoading: ticketsLoading } = useQuery({
    queryKey: ["ticket-types-setup", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)
      return data || []
    },
  })

  // Fetch registrations count
  const { data: registrationsCount } = useQuery({
    queryKey: ["registrations-count-setup", eventId],
    queryFn: async () => {
      const { count } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId)
        .eq("status", "confirmed")
      return count || 0
    },
  })

  // Calculate setup status
  const [steps, setSteps] = useState<SetupStep[]>([])

  useEffect(() => {
    if (templatesLoading || ticketsLoading) return

    const templatesList = templates || []
    const ticketsList = ticketTypes || []

    // Check which ticket types have templates assigned
    const ticketTypesWithTemplates = new Set<string>()
    const templatesWithElements: string[] = []
    const templatesWithoutElements: string[] = []

    templatesList.forEach((t: any) => {
      // Check if template has elements
      const hasElements = t.template_data?.elements?.length > 0
      if (hasElements) {
        templatesWithElements.push(t.name)
      } else {
        templatesWithoutElements.push(t.name)
      }

      // Track which ticket types are covered
      if (t.ticket_type_ids?.length > 0) {
        t.ticket_type_ids.forEach((id: string) => ticketTypesWithTemplates.add(id))
      }
      if (t.is_default) {
        // Default template covers all uncovered ticket types
        ticketsList.forEach((tt: any) => {
          if (!ticketTypesWithTemplates.has(tt.id)) {
            ticketTypesWithTemplates.add(tt.id)
          }
        })
      }
    })

    const uncoveredTicketTypes = ticketsList.filter((tt: any) => !ticketTypesWithTemplates.has(tt.id))

    const newSteps: SetupStep[] = [
      // Step 1: Create templates
      {
        id: "create-templates",
        title: "Create Badge Templates",
        description: templatesList.length > 0
          ? `You have ${templatesList.length} template(s) created`
          : "Create at least one badge template",
        status: templatesList.length > 0 ? "complete" : "incomplete",
        action: { label: "Create Template", href: `/events/${eventId}/badges/designer` },
        details: templatesList.length > 0
          ? `Templates: ${templatesList.map((t: any) => t.name).join(", ")}`
          : "No templates created yet",
      },
      // Step 2: Design templates (add elements)
      {
        id: "design-templates",
        title: "Design Your Templates",
        description: templatesWithoutElements.length > 0
          ? `${templatesWithoutElements.length} template(s) have no design elements`
          : templatesList.length > 0
            ? "All templates have design elements"
            : "Design your badge templates with name, QR code, etc.",
        status: templatesList.length === 0
          ? "incomplete"
          : templatesWithoutElements.length > 0
            ? "warning"
            : "complete",
        action: { label: "Open Designer", href: `/events/${eventId}/badges/designer` },
        details: templatesWithoutElements.length > 0
          ? `Templates needing design: ${templatesWithoutElements.join(", ")}`
          : templatesWithElements.length > 0
            ? `Designed templates: ${templatesWithElements.join(", ")}`
            : undefined,
      },
      // Step 3: Assign to ticket types
      {
        id: "assign-tickets",
        title: "Assign Templates to Ticket Types",
        description: uncoveredTicketTypes.length > 0
          ? `${uncoveredTicketTypes.length} ticket type(s) don't have a badge template`
          : ticketsList.length > 0
            ? "All ticket types have templates assigned"
            : "No ticket types found",
        status: ticketsList.length === 0
          ? "incomplete"
          : uncoveredTicketTypes.length > 0
            ? "warning"
            : "complete",
        action: { label: "Manage Templates", href: `/events/${eventId}/badges/templates` },
        details: uncoveredTicketTypes.length > 0
          ? `Ticket types without template: ${uncoveredTicketTypes.map((t: any) => t.name).join(", ")}`
          : undefined,
      },
      // Step 4: Have registrations
      {
        id: "have-registrations",
        title: "Confirmed Registrations",
        description: (registrationsCount || 0) > 0
          ? `${registrationsCount} confirmed registration(s) ready for badge generation`
          : "You need confirmed registrations to generate badges",
        status: (registrationsCount || 0) > 0 ? "complete" : "incomplete",
        action: { label: "View Attendees", href: `/events/${eventId}/registrations` },
      },
    ]

    setSteps(newSteps)
  }, [templates, ticketTypes, registrationsCount, templatesLoading, ticketsLoading, eventId])

  const allComplete = steps.every(s => s.status === "complete")
  const hasWarnings = steps.some(s => s.status === "warning")
  const isLoading = templatesLoading || ticketsLoading

  const getStatusIcon = (status: SetupStep["status"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-6 w-6 text-green-500" />
      case "warning":
        return <AlertCircle className="h-6 w-6 text-yellow-500" />
      case "incomplete":
        return <XCircle className="h-6 w-6 text-red-500" />
    }
  }

  const getStatusBadge = (status: SetupStep["status"]) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-100 text-green-700">Complete</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-700">Needs Attention</Badge>
      case "incomplete":
        return <Badge className="bg-red-100 text-red-700">Incomplete</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Badge Setup Guide</h1>
          <p className="text-muted-foreground mt-1">
            Complete these steps before generating badges
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchTemplates()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      {/* Overall Status Card */}
      <div className={cn(
        "p-6 rounded-xl border-2",
        allComplete ? "bg-green-50 border-green-200" :
        hasWarnings ? "bg-yellow-50 border-yellow-200" :
        "bg-red-50 border-red-200"
      )}>
        <div className="flex items-center gap-4">
          {allComplete ? (
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-green-600" />
            </div>
          ) : hasWarnings ? (
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <Settings className="h-6 w-6 text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h2 className={cn(
              "text-lg font-semibold",
              allComplete ? "text-green-800" :
              hasWarnings ? "text-yellow-800" :
              "text-red-800"
            )}>
              {allComplete ? "Ready to Generate Badges!" :
               hasWarnings ? "Almost Ready - Some Items Need Attention" :
               "Setup Required"}
            </h2>
            <p className={cn(
              "text-sm",
              allComplete ? "text-green-600" :
              hasWarnings ? "text-yellow-600" :
              "text-red-600"
            )}>
              {allComplete
                ? "All setup steps are complete. You can now generate badges for your attendees."
                : hasWarnings
                  ? "You can generate badges, but some templates may use default layouts."
                  : "Complete the steps below to enable badge generation."}
            </p>
          </div>
          {(allComplete || hasWarnings) && (
            <Button
              onClick={() => router.push(`/events/${eventId}/badges/generate`)}
              className={allComplete ? "bg-green-600 hover:bg-green-700" : ""}
            >
              Generate Badges
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Setup Steps */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Setup Checklist
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading setup status...
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "p-4 rounded-lg border bg-card",
                  step.status === "complete" && "border-green-200",
                  step.status === "warning" && "border-yellow-200",
                  step.status === "incomplete" && "border-red-200"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(step.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">
                        Step {index + 1}
                      </span>
                      {getStatusBadge(step.status)}
                    </div>
                    <h4 className="font-semibold">{step.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                    {step.details && (
                      <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                        {step.details}
                      </p>
                    )}
                  </div>
                  {step.action && (
                    <Link href={step.action.href}>
                      <Button variant="outline" size="sm">
                        {step.action.label}
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Info className="h-5 w-5" />
          Badge Design Tips
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">Design Elements</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use <code className="bg-muted px-1 rounded">{"{{name}}"}</code> for attendee name</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use <code className="bg-muted px-1 rounded">{"{{ticket_type}}"}</code> for ticket/role</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Add QR Code for check-in scanning</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Use <code className="bg-muted px-1 rounded">{"{{institution}}"}</code> for organization</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">Template Assignment</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Assign specific templates to ticket types (e.g., Speaker badge for speakers)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Set one template as &quot;Default&quot; for unassigned ticket types</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Different colors help identify roles quickly</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Printer className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold">Badge Sizes</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>4x3 inches</strong> - Standard landscape badge</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>3x4 inches</strong> - Portrait orientation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>3.5x2 inches</strong> - Business card size</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span><strong>A6</strong> - Larger event badge</span>
              </li>
            </ul>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <h4 className="font-semibold">Important Notes</h4>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500">•</span>
                <span>Templates are <strong>locked</strong> after first badge generation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500">•</span>
                <span>Test with Preview before bulk generation</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500">•</span>
                <span>Empty templates will use a default layout</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Features Guide */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Badge Features
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Settings className="h-5 w-5 text-blue-600" />
              </div>
              <h4 className="font-semibold">Preview Badge</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Click the eye icon next to any attendee to preview their badge before bulk generation.
              Test your template with real data.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <h4 className="font-semibold">Email Badges</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              After generating badges, email them to attendees so they can print at home.
              Use &quot;Email All With Badges&quot; for bulk sending.
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Palette className="h-5 w-5 text-purple-600" />
              </div>
              <h4 className="font-semibold">Quick Select</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Use quick select buttons to filter attendees - &quot;Without Badge&quot; for new generation,
              &quot;With Badge&quot; for emailing existing badges.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        <Link href={`/events/${eventId}/badges/designer`}>
          <Button variant="outline">
            <Palette className="h-4 w-4 mr-2" />
            Open Designer
          </Button>
        </Link>
        <Link href={`/events/${eventId}/badges/templates`}>
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Manage Templates
          </Button>
        </Link>
        <Link href={`/events/${eventId}/badges/generate`}>
          <Button variant="outline" disabled={!allComplete && !hasWarnings}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Badges
          </Button>
        </Link>
      </div>
    </div>
  )
}
