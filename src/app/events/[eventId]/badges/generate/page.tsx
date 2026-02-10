"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  Download,
  ArrowLeft,
  Search,
  CheckCircle,
  FileText,
  Loader2,
  Users,
  FileImage,
  ChevronDown,
  Mail,
  Eye,
  Send,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_institution: string | null
  attendee_designation: string | null
  status: string
  ticket_type: { id: string; name: string } | null
  badge_generated_at: string | null
}

interface BadgeTemplate {
  id: string
  name: string
  size: string
  is_default: boolean
  ticket_type_ids: string[] | null
}

export default function GenerateBadgesPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [selectedTicketTypes, setSelectedTicketTypes] = useState<string[]>([])
  const [ticketDropdownOpen, setTicketDropdownOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>("confirmed")
  const [badgeFilter, setBadgeFilter] = useState<string>("all") // all, without_badge, with_badge
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([])
  const [exportFormat, setExportFormat] = useState<"pdf" | "png">("pdf")
  const [badgesPerPage, setBadgesPerPage] = useState<number>(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isEmailing, setIsEmailing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewRegistration, setPreviewRegistration] = useState<Registration | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    errors: { type: string; field: string; message: string; details?: string }[]
    warnings: { type: string; field: string; message: string; details?: string }[]
    stats: {
      totalRegistrations: number
      registrationsWithIssues: number
      missingNames: number
      missingInstitutions: number
      missingPhones: number
      missingEmails: number
      missingAddons: number
    }
  } | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [, setShowValidation] = useState(false)

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      const data = await res.json()
      const list = (data.data || data || []) as BadgeTemplate[]
      // Auto-select default template
      const defaultTemplate = list.find((t) => t.is_default)
      if (defaultTemplate && !selectedTemplate) {
        setSelectedTemplate(defaultTemplate.id)
      }
      return list
    },
  })

  // Fetch ticket types
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?event_id=${eventId}`)
      const data = await res.json()
      return data.data || []
    },
  })

  // Fetch registrations
  const { data: registrations, isLoading, refetch: refetchRegistrations } = useQuery({
    queryKey: ["registrations", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/registrations?event_id=${eventId}&limit=1000`)
      const data = await res.json()
      return (data.data || []) as Registration[]
    },
  })

  // Get all unique ticket types from registrations (includes types not in ticket_types table)
  const allTicketTypes = Array.from(
    new Set([
      ...(ticketTypes?.map((t: any) => t.name) || []),
      ...(registrations?.map((r) => r.ticket_type?.name).filter(Boolean) || []),
    ])
  ).sort()

  // Filter registrations
  const filteredRegistrations = registrations?.filter((r) => {
    const matchesSearch =
      r.attendee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.registration_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.attendee_email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = selectedStatus === "all" || r.status === selectedStatus
    const matchesTicketType =
      selectedTicketTypes.length === 0 || selectedTicketTypes.includes(r.ticket_type?.name || "")
    const matchesBadgeFilter =
      badgeFilter === "all" ||
      (badgeFilter === "without_badge" && !r.badge_generated_at) ||
      (badgeFilter === "with_badge" && r.badge_generated_at)
    return matchesSearch && matchesStatus && matchesTicketType && matchesBadgeFilter
  })

  // Count for quick select
  const withoutBadgeCount = registrations?.filter(
    (r) => r.status === "confirmed" && !r.badge_generated_at
  ).length || 0

  const toggleTicketType = (ticketName: string) => {
    setSelectedTicketTypes((prev) =>
      prev.includes(ticketName)
        ? prev.filter((t) => t !== ticketName)
        : [...prev, ticketName]
    )
  }

  const toggleSelectAll = () => {
    if (selectedRegistrations.length === filteredRegistrations?.length) {
      setSelectedRegistrations([])
    } else {
      setSelectedRegistrations(filteredRegistrations?.map((r) => r.id) || [])
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedRegistrations((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Validate badges before generating
  const validateBadges = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a badge template")
      return null
    }

    setIsValidating(true)
    setShowValidation(true)
    try {
      const res = await fetch("/api/badges/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: selectedTemplate,
          registration_ids: selectedRegistrations.length > 0 ? selectedRegistrations : undefined,
        }),
      })

      if (!res.ok) {
        throw new Error("Validation failed")
      }

      const result = await res.json()
      setValidationResult(result)
      return result
    } catch {
      toast.error("Failed to validate badges")
      return null
    } finally {
      setIsValidating(false)
    }
  }

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a badge template")
      return
    }
    if (selectedRegistrations.length === 0) {
      toast.error("Please select at least one attendee")
      return
    }

    // Validate first
    const validation = await validateBadges()
    if (validation && !validation.valid) {
      toast.error("Please fix validation errors before generating")
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: selectedTemplate,
          registration_ids: selectedRegistrations,
          export_format: exportFormat,
          badges_per_page: exportFormat === "pdf" ? badgesPerPage : 1,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to generate badges")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `badges.${exportFormat === "pdf" ? "pdf" : "zip"}`
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success(`Generated ${selectedRegistrations.length} badges!`)

      // Refetch registrations to update badge status
      await refetchRegistrations()

      // Clear selection after successful generation
      setSelectedRegistrations([])
    } catch (error: any) {
      toast.error(error.message || "Failed to generate badges")
    } finally {
      setIsGenerating(false)
    }
  }

  // Email badges to selected attendees
  const handleEmailBadges = async () => {
    if (selectedRegistrations.length === 0) {
      toast.error("Please select at least one attendee")
      return
    }

    // Only email to those with badges generated
    const regsWithBadges = registrations?.filter(
      (r) => selectedRegistrations.includes(r.id) && r.badge_generated_at
    ) || []

    if (regsWithBadges.length === 0) {
      toast.error("Selected attendees don't have badges generated yet. Generate badges first.")
      return
    }

    setIsEmailing(true)
    let successCount = 0
    let failCount = 0

    try {
      for (const reg of regsWithBadges) {
        try {
          const res = await fetch("/api/badges/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registration_id: reg.id,
              event_id: eventId,
            }),
          })

          if (res.ok) {
            successCount++
          } else {
            failCount++
          }
        } catch {
          failCount++
        }
      }

      if (successCount > 0) {
        toast.success(`Sent ${successCount} badge email(s)!`)
      }
      if (failCount > 0) {
        toast.error(`Failed to send ${failCount} email(s)`)
      }

      setSelectedRegistrations([])
    } catch (error: any) {
      toast.error(error.message || "Failed to send emails")
    } finally {
      setIsEmailing(false)
    }
  }

  // Preview badge for a single registration
  const handlePreview = async (reg: Registration) => {
    if (!selectedTemplate) {
      toast.error("Please select a template first")
      return
    }

    setPreviewRegistration(reg)
    setShowPreview(true)
    setIsLoadingPreview(true)
    setPreviewUrl(null)

    try {
      const res = await fetch("/api/badges/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          template_id: selectedTemplate,
          single_registration_id: reg.id,
          export_format: "pdf",
        }),
      })

      if (!res.ok) throw new Error("Failed to generate preview")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      setPreviewUrl(url)
    } catch {
      toast.error("Failed to load preview")
      setShowPreview(false)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const closePreview = () => {
    setShowPreview(false)
    setPreviewRegistration(null)
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}/badges`}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Generate Badges</h1>
                <p className="text-sm text-muted-foreground">
                  Bulk generate badges for attendees
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleEmailBadges}
                disabled={isEmailing || selectedRegistrations.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Email badges to selected attendees"
              >
                {isEmailing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Email
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedRegistrations.length === 0 || !selectedTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Generate {selectedRegistrations.length > 0 && `(${selectedRegistrations.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold mb-4">Generation Settings</h3>

              {/* Template Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Badge Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const templateId = e.target.value
                    setSelectedTemplate(templateId)
                    // Auto-filter by ticket types assigned to this template
                    const template = templates?.find((t) => t.id === templateId)
                    if (template?.ticket_type_ids && template.ticket_type_ids.length > 0) {
                      // Get ticket type names for the assigned IDs
                      const assignedNames = ticketTypes
                        ?.filter((t: any) => template.ticket_type_ids?.includes(t.id))
                        .map((t: any) => t.name) || []
                      setSelectedTicketTypes(assignedNames)
                    } else {
                      // Default template - show all
                      setSelectedTicketTypes([])
                    }
                    // Clear selection and validation when template changes
                    setSelectedRegistrations([])
                    setValidationResult(null)
                  }}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a template...</option>
                  {templates?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_default && "(Default)"} {t.ticket_type_ids?.length ? `(${t.ticket_type_ids.length} types)` : "(All types)"}
                    </option>
                  ))}
                </select>
                {!templates?.length && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No templates yet.{" "}
                    <Link href={`/events/${eventId}/badges`} className="text-primary hover:underline">
                      Create one
                    </Link>
                  </p>
                )}
                {selectedTemplate && (() => {
                  const template = templates?.find((t) => t.id === selectedTemplate)
                  if (template?.ticket_type_ids && template.ticket_type_ids.length > 0) {
                    const assignedNames = ticketTypes
                      ?.filter((t: any) => template.ticket_type_ids?.includes(t.id))
                      .map((t: any) => t.name) || []
                    return (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                        <strong>Assigned to:</strong> {assignedNames.join(", ")}
                      </div>
                    )
                  }
                  return (
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                      <strong>Default template</strong> - applies to all ticket types
                    </div>
                  )
                })()}
              </div>

              {/* Export Format */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Export Format</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExportFormat("pdf")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      exportFormat === "pdf"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:border-primary/50"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    PDF
                  </button>
                  <button
                    onClick={() => setExportFormat("png")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      exportFormat === "png"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border hover:border-primary/50"
                    }`}
                  >
                    <FileImage className="w-4 h-4" />
                    PNG (ZIP)
                  </button>
                </div>
              </div>

              {/* Badges per page (PDF only) */}
              {exportFormat === "pdf" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Badges per Page</label>
                  <select
                    value={badgesPerPage}
                    onChange={(e) => setBadgesPerPage(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="1">1 badge per page</option>
                    <option value="2">2 badges per page</option>
                    <option value="4">4 badges per page</option>
                    <option value="6">6 badges per page</option>
                  </select>
                </div>
              )}

              {/* Summary */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Selected</span>
                  <span className="font-medium">{selectedRegistrations.length} attendees</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Format</span>
                  <span className="font-medium uppercase">{exportFormat}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold mb-4">Quick Select</h3>
              <div className="space-y-2">
                {withoutBadgeCount > 0 && (
                  <button
                    onClick={() =>
                      setSelectedRegistrations(
                        registrations?.filter((r) => r.status === "confirmed" && !r.badge_generated_at).map((r) => r.id) || []
                      )
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 rounded-lg text-sm font-medium"
                  >
                    <FileImage className="w-4 h-4" />
                    Without Badge ({withoutBadgeCount})
                  </button>
                )}
                {(registrations?.filter((r) => r.status === "confirmed" && r.badge_generated_at).length || 0) > 0 && (
                  <button
                    onClick={() =>
                      setSelectedRegistrations(
                        registrations?.filter((r) => r.status === "confirmed" && r.badge_generated_at).map((r) => r.id) || []
                      )
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 rounded-lg text-sm font-medium"
                  >
                    <Mail className="w-4 h-4" />
                    With Badge ({registrations?.filter((r) => r.status === "confirmed" && r.badge_generated_at).length || 0})
                  </button>
                )}
                <button
                  onClick={() =>
                    setSelectedRegistrations(
                      registrations?.filter((r) => r.status === "confirmed").map((r) => r.id) || []
                    )
                  }
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  All Confirmed ({registrations?.filter((r) => r.status === "confirmed").length || 0})
                </button>
                <button
                  onClick={() => setSelectedRegistrations([])}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    const withBadges = registrations?.filter((r) => r.status === "confirmed" && r.badge_generated_at) || []
                    if (withBadges.length === 0) {
                      toast.error("No badges generated yet")
                      return
                    }
                    setSelectedRegistrations(withBadges.map((r) => r.id))
                    // Small delay then trigger email
                    setTimeout(() => handleEmailBadges(), 100)
                  }}
                  disabled={isEmailing || (registrations?.filter((r) => r.badge_generated_at).length || 0) === 0}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  Email All With Badges
                </button>
              </div>
            </div>

            {/* Validation Panel */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Pre-Generation Check</h3>
                <button
                  onClick={validateBadges}
                  disabled={isValidating || !selectedTemplate}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3 h-3" />
                  )}
                  Validate
                </button>
              </div>

              {!validationResult && !isValidating && (
                <p className="text-xs text-muted-foreground">
                  Click validate to check for issues before generating badges.
                </p>
              )}

              {isValidating && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </div>
              )}

              {validationResult && !isValidating && (
                <div className="space-y-3">
                  {/* Status */}
                  <div className={`flex items-center gap-2 p-2 rounded-lg ${
                    validationResult.valid
                      ? "bg-emerald-500/10 text-emerald-700"
                      : "bg-red-500/10 text-red-700"
                  }`}>
                    {validationResult.valid ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {validationResult.valid
                        ? "Ready to generate"
                        : `${validationResult.errors.length} issue(s) found`}
                    </span>
                  </div>

                  {/* Errors */}
                  {validationResult.errors.length > 0 && (
                    <div className="space-y-2">
                      {validationResult.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg text-xs">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-red-700">{err.message}</p>
                            {err.details && (
                              <p className="text-red-600 mt-0.5">{err.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {validationResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      {validationResult.warnings.map((warn, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg text-xs">
                          {warn.type === "info" ? (
                            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-amber-700">{warn.message}</p>
                            {warn.details && (
                              <p className="text-amber-600 mt-0.5">{warn.details}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  {validationResult.stats.totalRegistrations > 0 && (
                    <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                      <p>{validationResult.stats.totalRegistrations} registrations checked</p>
                      {validationResult.stats.registrationsWithIssues > 0 && (
                        <p className="text-amber-600">
                          {validationResult.stats.registrationsWithIssues} with missing data
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attendees List */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl border border-border">
              {/* Filters */}
              <div className="p-4 border-b border-border">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search attendees..."
                      className="w-full pl-9 pr-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All Status</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={badgeFilter}
                    onChange={(e) => setBadgeFilter(e.target.value)}
                    className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="all">All Badges</option>
                    <option value="without_badge">Without Badge ({withoutBadgeCount})</option>
                    <option value="with_badge">With Badge</option>
                  </select>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setTicketDropdownOpen(!ticketDropdownOpen)}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
                    >
                      <span className="truncate">
                        {selectedTicketTypes.length === 0
                          ? "All Ticket Types"
                          : `${selectedTicketTypes.length} selected`}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${ticketDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {ticketDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setTicketDropdownOpen(false)}
                        />
                        <div className="absolute top-full mt-1 right-0 z-20 bg-popover border border-border rounded-lg shadow-lg min-w-[250px] py-1">
                          <label
                            className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                            onClick={() => setSelectedTicketTypes([])}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTicketTypes.length === 0}
                              onChange={() => setSelectedTicketTypes([])}
                              className="w-4 h-4 rounded text-primary focus:ring-primary"
                            />
                            <span className="text-sm">All Ticket Types</span>
                          </label>
                          <div className="border-t border-border my-1" />
                          {allTicketTypes.map((ticketName) => (
                            <label
                              key={ticketName}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTicketTypes.includes(ticketName)}
                                onChange={() => toggleTicketType(ticketName)}
                                className="w-4 h-4 rounded text-primary focus:ring-primary"
                              />
                              <span className="text-sm">{ticketName}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Select All Header */}
              <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={
                    (filteredRegistrations?.length ?? 0) > 0 &&
                    selectedRegistrations.length === (filteredRegistrations?.length ?? 0)
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">
                  {selectedRegistrations.length > 0
                    ? `${selectedRegistrations.length} selected`
                    : `Select all (${filteredRegistrations?.length || 0})`}
                </span>
              </div>

              {/* List */}
              <div className="max-h-[500px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredRegistrations?.length ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-3 text-muted-foreground">No attendees found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredRegistrations.map((reg) => (
                      <label
                        key={reg.id}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegistrations.includes(reg.id)}
                          onChange={() => toggleSelect(reg.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{reg.attendee_name}</span>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                reg.status === "confirmed"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : reg.status === "pending"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {reg.status}
                            </span>
                            {reg.badge_generated_at ? (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-600">
                                Badge Ready
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/10 text-gray-500">
                                No Badge
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span className="font-mono">{reg.registration_number}</span>
                            {reg.ticket_type?.name && (
                              <>
                                <span>•</span>
                                <span>{reg.ticket_type.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handlePreview(reg)
                          }}
                          disabled={!selectedTemplate}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                          title="Preview badge"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">Badge Preview</h3>
                {previewRegistration && (
                  <p className="text-sm text-muted-foreground">
                    {previewRegistration.attendee_name} • {previewRegistration.registration_number}
                  </p>
                )}
              </div>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto flex items-center justify-center min-h-[400px]">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating preview...</p>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[500px] border rounded-lg"
                  title="Badge Preview"
                />
              ) : (
                <p className="text-muted-foreground">Failed to load preview</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t">
              <button
                onClick={closePreview}
                className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Close
              </button>
              {previewUrl && (
                <a
                  href={previewUrl}
                  download={`badge-${previewRegistration?.registration_number || "preview"}.pdf`}
                  className="px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
