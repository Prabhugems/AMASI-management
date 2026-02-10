"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Calendar,
  FileText,
  ArrowLeft,
  Search,
  Star,
  StarOff,
  Sparkles,
  Lock,
  LockOpen,
  Type,
  X,
  AlertTriangle,
} from "lucide-react"

// Pre-built template previews for the templates page - must match designer/page.tsx
// Grouped by size: 4x6 templates first, then 4x3 templates
const PRE_BUILT_TEMPLATES = [
  // 4x6 Templates (384 × 576)
  { name: "Professional", description: "Clean corporate design (4×6)", color: "#1e40af", elements: 12, size: "4x6" },
  { name: "Modern", description: "Bold gradient header (4×6)", color: "#7c3aed", elements: 14, size: "4x6" },
  { name: "Minimal", description: "Simple and elegant (4×6)", color: "#111827", elements: 12, size: "4x6" },
  { name: "Event Badge", description: "With event details (4×6)", color: "#059669", elements: 13, size: "4x6" },
  { name: "Medical Conference", description: "Healthcare & medical (4×6)", color: "#0d9488", elements: 14, size: "4x6" },
  { name: "Tech Summit", description: "Dark theme for tech (4×6)", color: "#18181b", elements: 12, size: "4x6" },
  { name: "Academic", description: "Classic scholarly (4×6)", color: "#92400e", elements: 13, size: "4x6" },
  { name: "Creative", description: "Colorful artistic (4×6)", color: "#d946ef", elements: 12, size: "4x6" },
  { name: "Executive", description: "Premium luxury (4×6)", color: "#ca8a04", elements: 13, size: "4x6" },
  { name: "Side Banner", description: "Vertical accent (4×6)", color: "#2563eb", elements: 12, size: "4x6" },
  { name: "Dual Tone", description: "Two-color split (4×6)", color: "#0ea5e9", elements: 13, size: "4x6" },
  { name: "Corner Accent", description: "Elegant corner (4×6)", color: "#dc2626", elements: 12, size: "4x6" },
  { name: "Gradient Wave", description: "Flowing wave (4×6)", color: "#4f46e5", elements: 12, size: "4x6" },
  { name: "Nameplate", description: "Large name focus (4×6)", color: "#0f172a", elements: 13, size: "4x6" },
  { name: "Vibrant", description: "Bold and colorful (4×6)", color: "#f97316", elements: 14, size: "4x6" },
  // 4x3 Templates (384 × 288)
  { name: "Professional (4×3)", description: "Clean corporate design", color: "#1e40af", elements: 11, size: "4x3" },
  { name: "Modern (4×3)", description: "Bold gradient header", color: "#7c3aed", elements: 12, size: "4x3" },
  { name: "Minimal (4×3)", description: "Simple and elegant", color: "#111827", elements: 10, size: "4x3" },
  { name: "Event Badge (4×3)", description: "With event details", color: "#059669", elements: 11, size: "4x3" },
  { name: "Medical Conference (4×3)", description: "Healthcare & medical", color: "#0d9488", elements: 12, size: "4x3" },
  { name: "Tech Summit (4×3)", description: "Dark theme for tech", color: "#18181b", elements: 12, size: "4x3" },
  { name: "Academic (4×3)", description: "Classic scholarly", color: "#92400e", elements: 11, size: "4x3" },
  { name: "Creative (4×3)", description: "Colorful artistic", color: "#d946ef", elements: 11, size: "4x3" },
  { name: "Executive (4×3)", description: "Premium luxury", color: "#ca8a04", elements: 12, size: "4x3" },
  { name: "Side Banner (4×3)", description: "Vertical accent", color: "#2563eb", elements: 11, size: "4x3" },
  { name: "Dual Tone (4×3)", description: "Two-color split", color: "#0ea5e9", elements: 11, size: "4x3" },
  { name: "Corner Accent (4×3)", description: "Elegant corner", color: "#dc2626", elements: 12, size: "4x3" },
  { name: "Gradient Wave (4×3)", description: "Flowing wave", color: "#4f46e5", elements: 12, size: "4x3" },
  { name: "Nameplate (4×3)", description: "Large name focus", color: "#0f172a", elements: 12, size: "4x3" },
  { name: "Vibrant (4×3)", description: "Bold and colorful", color: "#f97316", elements: 12, size: "4x3" },
]
import { toast } from "sonner"

interface BadgeTemplate {
  id: string
  name: string
  event_id: string
  template_data: {
    backgroundColor: string
    elements: any[]
  }
  size: string
  is_default: boolean
  is_locked?: boolean
  locked_at?: string
  badges_generated_count?: number
  created_at: string
  updated_at: string
}

export default function BadgeTemplatesPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const eventId = params.eventId as string

  const [searchQuery, setSearchQuery] = useState("")
  const [renameTemplate, setRenameTemplate] = useState<BadgeTemplate | null>(null)
  const [newName, setNewName] = useState("")
  const [unlockTemplate, setUnlockTemplate] = useState<BadgeTemplate | null>(null)

  // Fetch templates
  const { data: templates, isLoading, error } = useQuery({
    queryKey: ["badge-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/badge-templates?event_id=${eventId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch templates")
      }
      const data = await res.json()
      // API returns array directly
      return Array.isArray(data) ? data : (data.data || []) as BadgeTemplate[]
    },
    retry: 2,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/badge-templates?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success("Template deleted")
    },
    onError: () => {
      toast.error("Failed to delete template")
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (template: BadgeTemplate) => {
      const res = await fetch("/api/badge-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          event_id: eventId,
          template_data: template.template_data,
          size: template.size,
        }),
      })
      if (!res.ok) throw new Error("Failed to duplicate")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success("Template duplicated")
    },
    onError: () => {
      toast.error("Failed to duplicate template")
    },
  })

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/badge-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_default: true, event_id: eventId }),
      })
      if (!res.ok) throw new Error("Failed to set default")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success("Default template updated")
    },
  })

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/badge-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      })
      if (!res.ok) throw new Error("Failed to rename")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success("Template renamed")
      setRenameTemplate(null)
      setNewName("")
    },
    onError: () => {
      toast.error("Failed to rename template")
    },
  })

  const handleRename = (template: BadgeTemplate) => {
    setRenameTemplate(template)
    setNewName(template.name)
  }

  const submitRename = () => {
    if (renameTemplate && newName.trim()) {
      renameMutation.mutate({ id: renameTemplate.id, name: newName.trim() })
    }
  }

  // Unlock mutation
  const unlockMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/badge-templates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, force_unlock: true }),
      })
      if (!res.ok) throw new Error("Failed to unlock")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badge-templates", eventId] })
      toast.success("Template unlocked! You can now edit it.")
      setUnlockTemplate(null)
    },
    onError: () => {
      toast.error("Failed to unlock template")
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  const filteredTemplates = templates?.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getSizeLabel = (size: string) => {
    const sizes: Record<string, string> = {
      "4x3": '4" × 3"',
      "3x4": '3" × 4"',
      "4x6": '4" × 6"',
      "3.5x2": '3.5" × 2"',
      A6: "A6",
    }
    return sizes[size] || size
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}`}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">Badge Templates</h1>
                <p className="text-sm text-muted-foreground">
                  {templates?.length || 0} templates
                </p>
              </div>
            </div>
            <Link
              href={`/events/${eventId}/badges/designer`}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Template
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-card rounded-xl border border-destructive/50">
            <FolderOpen className="w-16 h-16 mx-auto text-destructive/50" />
            <h3 className="mt-4 text-lg font-semibold text-destructive">Failed to load templates</h3>
            <p className="mt-2 text-muted-foreground">Please try refreshing the page</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            >
              Refresh
            </button>
          </div>
        ) : !filteredTemplates?.length ? (
          <div className="text-center py-20 bg-card rounded-xl border border-border">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No templates found</h3>
            <p className="mt-2 text-muted-foreground">
              {searchQuery
                ? "Try a different search term"
                : "Create your first badge template to get started"}
            </p>
            {!searchQuery && (
              <Link
                href={`/events/${eventId}/badges/designer`}
                className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </Link>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors group"
              >
                {/* Preview */}
                <div
                  className="h-40 relative"
                  style={{ backgroundColor: template.template_data?.backgroundColor || "#f3f4f6" }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    {template.is_default && (
                      <div className="px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Default
                      </div>
                    )}
                    {template.is_locked && (
                      <div className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                    <FileText className="w-16 h-16" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold truncate">{template.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getSizeLabel(template.size)} • {template.template_data?.elements?.length || 0} elements
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(template.updated_at || template.created_at).toLocaleDateString()}
                    </div>
                    {(template.badges_generated_count || 0) > 0 && (
                      <span className="text-green-600 font-medium">
                        {template.badges_generated_count} badges
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                    <Link
                      href={`/events/${eventId}/badges/designer?template=${template.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </Link>
                    <button
                      onClick={() => handleRename(template)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Rename"
                    >
                      <Type className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => duplicateMutation.mutate(template)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={() => setDefaultMutation.mutate(template.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                        title="Set as default"
                      >
                        <StarOff className="w-4 h-4 text-muted-foreground" />
                      </button>
                    )}
                    {template.is_locked && (
                      <button
                        onClick={() => setUnlockTemplate(template)}
                        className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
                        title="Unlock template for editing"
                      >
                        <LockOpen className="w-4 h-4 text-amber-600" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title={template.is_locked ? "Cannot delete locked template" : "Delete"}
                      disabled={template.is_locked}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pre-built Templates Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Start from a Template</h2>
              <p className="text-sm text-muted-foreground">Choose a pre-built design to customize</p>
            </div>
          </div>

          {/* 4x6 Templates */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">4" × 6" Templates</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-8">
            {PRE_BUILT_TEMPLATES.filter(t => t.size === "4x6").map((template) => (
              <Link
                key={template.name}
                href={`/events/${eventId}/badges/designer?prebuilt=${encodeURIComponent(template.name)}`}
                className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div
                  className="h-24 rounded-lg mb-3 flex items-center justify-center relative"
                  style={{ backgroundColor: template.color }}
                >
                  <FileText className="w-8 h-8 text-white/80" />
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/30 text-white text-[10px] rounded">4×6</span>
                </div>
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {template.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {template.elements} elements
                </p>
              </Link>
            ))}
          </div>

          {/* 4x3 Templates */}
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">4" × 3" Templates</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {PRE_BUILT_TEMPLATES.filter(t => t.size === "4x3").map((template) => (
              <Link
                key={template.name}
                href={`/events/${eventId}/badges/designer?prebuilt=${encodeURIComponent(template.name)}`}
                className="group p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all"
              >
                <div
                  className="h-16 rounded-lg mb-3 flex items-center justify-center relative"
                  style={{ backgroundColor: template.color }}
                >
                  <FileText className="w-6 h-6 text-white/80" />
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/30 text-white text-[10px] rounded">4×3</span>
                </div>
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {template.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {template.elements} elements
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Rename Dialog */}
      {renameTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Rename Template</h3>
              <button
                onClick={() => {
                  setRenameTemplate(null)
                  setNewName("")
                }}
                className="p-1 hover:bg-muted rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Template name"
              className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename()
                if (e.key === "Escape") {
                  setRenameTemplate(null)
                  setNewName("")
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setRenameTemplate(null)
                  setNewName("")
                }}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRename}
                disabled={!newName.trim() || renameMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {renameMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Confirmation Dialog */}
      {unlockTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold">Unlock Template?</h3>
            </div>
            <p className="text-muted-foreground mb-2">
              <strong>{unlockTemplate.name}</strong> has generated{" "}
              <strong>{unlockTemplate.badges_generated_count || 0} badges</strong>.
            </p>
            <p className="text-muted-foreground mb-4">
              Unlocking allows you to edit the design, but already printed badges won't be updated automatically.
              You may need to reprint affected badges.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setUnlockTemplate(null)}
                className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => unlockMutation.mutate(unlockTemplate.id)}
                disabled={unlockMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {unlockMutation.isPending ? "Unlocking..." : "Unlock & Edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
