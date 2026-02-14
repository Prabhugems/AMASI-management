"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderTree,
  GripVertical,
  AlertCircle,
  FileDown,
  Sparkles,
} from "lucide-react"

// Category templates for different event types
const CATEGORY_TEMPLATES = {
  amasicon2026: {
    name: "AMASICON 2026 Awards",
    categories: [
      {
        name: "Best Paper Award",
        description: "Best original research paper presentation. AMASI Medal for winner.",
        submission_type: "paper",
        allowed_file_types: ["pdf"],
        required_file: true,
        is_award_category: true,
        award_name: "AMASI Medal",
        eligibility_rules: {},
        declarations: [
          { text: "This paper has not won any award previously at any AMASI conference", required: true },
          { text: "I am the primary author and will present this paper in person", required: true },
          { text: "No proxy presentation will be done", required: true },
          { text: "The abstract does not contain the name of my institution or co-authors", required: true },
          { text: "I understand that the decision of the judges is final", required: true },
        ],
      },
      {
        name: "Best Institutional Video",
        description: "Best institutional surgical/procedure video. AMASI Medal for winner.",
        submission_type: "video",
        allowed_file_types: ["mp4"],
        required_file: true,
        is_award_category: true,
        award_name: "AMASI Medal",
        eligibility_rules: {},
        declarations: [
          { text: "This video has not won any award previously at any AMASI conference", required: true },
          { text: "I am the primary author and will present this video in person", required: true },
          { text: "No proxy presentation will be done", required: true },
          { text: "The video is original and produced by my institution", required: true },
          { text: "I understand that the decision of the judges is final", required: true },
        ],
      },
      {
        name: "Best Faculty Video",
        description: "Best faculty surgical/procedure video. Dr Palanivelu Medal for winner.",
        submission_type: "video",
        allowed_file_types: ["mp4"],
        required_file: true,
        is_award_category: true,
        award_name: "Dr Palanivelu Medal",
        eligibility_rules: {},
        declarations: [
          { text: "This video has not won any award previously at any AMASI conference", required: true },
          { text: "I am the primary author and will present this video in person", required: true },
          { text: "No proxy presentation will be done", required: true },
          { text: "I understand that the decision of the judges is final", required: true },
        ],
      },
      {
        name: "Young Scholar Award",
        description: "For PG residents, fellows, and senior residents under 40 years. AMASI Medal for winner.",
        submission_type: "paper",
        allowed_file_types: ["pdf"],
        required_file: true,
        is_award_category: true,
        award_name: "AMASI Medal",
        eligibility_rules: { max_age: 40, require_dob: true, allowed_positions: ["PG Resident", "Fellow", "Senior Resident"] },
        declarations: [
          { text: "I am under 40 years of age as of the date of the conference", required: true },
          { text: "I am currently a PG Resident, Fellow, or Senior Resident", required: true },
          { text: "This paper has not won any award previously at any AMASI conference", required: true },
          { text: "I am the primary author and will present this paper in person", required: true },
          { text: "No proxy presentation will be done", required: true },
          { text: "The abstract does not contain the name of my institution or co-authors", required: true },
          { text: "I understand that the decision of the judges is final", required: true },
        ],
      },
      {
        name: "Best Poster Award",
        description: "Best poster/ePoster presentation. AMASI Medal for winner.",
        submission_type: "poster",
        allowed_file_types: ["pdf"],
        required_file: true,
        is_award_category: true,
        award_name: "AMASI Medal",
        eligibility_rules: {},
        declarations: [
          { text: "This poster has not won any award previously at any AMASI conference", required: true },
          { text: "I am the primary author and will present this poster in person", required: true },
          { text: "No proxy presentation will be done", required: true },
          { text: "The abstract does not contain the name of my institution or co-authors", required: true },
          { text: "I understand that the decision of the judges is final", required: true },
        ],
      },
      {
        name: "Free Paper / Video / Poster",
        description: "Free paper, video, or poster session. Not an award category. File upload optional.",
        submission_type: "paper",
        allowed_file_types: ["pdf", "mp4"],
        required_file: false,
        is_award_category: false,
        award_name: null,
        eligibility_rules: {},
        declarations: [
          { text: "I am the primary author and will present in person or have arranged a co-author to present", required: true },
        ],
      },
    ],
  },
  amasi: {
    name: "AMASI Medical Conference (Basic)",
    categories: [
      { name: "Free Paper", description: "Original research presentations (7 min + 3 min discussion)", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Video", description: "Surgical/procedure videos (max 7 min)", submission_type: "video", allowed_file_types: ["mp4"], required_file: true, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "ePoster", description: "Digital poster presentations", submission_type: "poster", allowed_file_types: ["pdf"], required_file: true, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Young Scholar", description: "For students and residents under 35", submission_type: "paper", allowed_file_types: ["pdf"], required_file: true, is_award_category: true, award_name: "Young Scholar Award", eligibility_rules: { max_age: 35, require_dob: true }, declarations: [] },
      { name: "Case Report", description: "Interesting clinical cases", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
    ],
  },
  academic: {
    name: "Academic Conference",
    categories: [
      { name: "Oral Presentation", description: "Standard research presentations", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Poster Presentation", description: "Poster session presentations", submission_type: "poster", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Workshop", description: "Interactive workshop proposals", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Symposium", description: "Multi-speaker symposium proposals", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
    ],
  },
  scientific: {
    name: "Scientific Meeting",
    categories: [
      { name: "Original Research", description: "Novel research findings", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Review", description: "Systematic or narrative reviews", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Case Series", description: "Collection of related cases", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
      { name: "Technical Innovation", description: "New techniques or methods", submission_type: "paper", allowed_file_types: ["pdf"], required_file: false, is_award_category: false, award_name: null, eligibility_rules: {}, declarations: [] },
    ],
  },
}

interface Declaration {
  text: string
  required: boolean
}

interface Category {
  id: string
  event_id: string
  name: string
  description: string | null
  max_submissions: number | null
  sort_order: number
  is_active: boolean
  created_at: string
  submission_type: string
  allowed_file_types: string[]
  required_file: boolean
  declarations: Declaration[]
  eligibility_rules: Record<string, any>
  award_name: string | null
  is_award_category: boolean
}

export default function CategoriesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [showDialog, setShowDialog] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    max_submissions: "",
    is_active: true,
    submission_type: "paper",
    allowed_file_types: "pdf",
    required_file: false,
    is_award_category: false,
    award_name: "",
  })
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["abstract-categories", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/abstract-categories?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch categories")
      return res.json() as Promise<Category[]>
    },
  })

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const res = await fetch("/api/abstract-categories", {
        method: data.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          event_id: eventId,
          max_submissions: data.max_submissions ? parseInt(data.max_submissions) : null,
          allowed_file_types: data.allowed_file_types.split(",").map((s: string) => s.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save category")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-categories", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-setup-status", eventId] })
      setShowDialog(false)
      setEditingCategory(null)
      resetForm()
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/abstract-categories?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete category")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["abstract-categories", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-setup-status", eventId] })
      setDeleteConfirm(null)
    },
  })

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      max_submissions: "",
      is_active: true,
      submission_type: "paper",
      allowed_file_types: "pdf",
      required_file: false,
      is_award_category: false,
      award_name: "",
    })
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || "",
      max_submissions: category.max_submissions?.toString() || "",
      is_active: category.is_active,
      submission_type: category.submission_type || "paper",
      allowed_file_types: (category.allowed_file_types || ["pdf"]).join(", "),
      required_file: category.required_file || false,
      is_award_category: category.is_award_category || false,
      award_name: category.award_name || "",
    })
    setShowDialog(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    saveMutation.mutate({
      ...formData,
      id: editingCategory?.id,
    })
  }

  const [templateError, setTemplateError] = useState("")

  const loadTemplate = async (templateKey: keyof typeof CATEGORY_TEMPLATES) => {
    const template = CATEGORY_TEMPLATES[templateKey]
    setLoadingTemplate(true)
    setTemplateError("")

    try {
      // Create all categories from the template sequentially to maintain sort order
      for (const cat of template.categories) {
          const res = await fetch("/api/abstract-categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: eventId,
              name: cat.name,
              description: cat.description,
              is_active: true,
              submission_type: (cat as any).submission_type || "paper",
              allowed_file_types: (cat as any).allowed_file_types || ["pdf"],
              required_file: (cat as any).required_file ?? false,
              declarations: (cat as any).declarations || [],
              eligibility_rules: (cat as any).eligibility_rules || {},
              award_name: (cat as any).award_name || null,
              is_award_category: (cat as any).is_award_category ?? false,
            }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || `Failed to create category: ${cat.name}`)
          }
      }

      queryClient.invalidateQueries({ queryKey: ["abstract-categories", eventId] })
      queryClient.invalidateQueries({ queryKey: ["event-setup-status", eventId] })
      setShowTemplateDialog(false)
    } catch (error: any) {
      console.error("Failed to load template:", error)
      setTemplateError(error.message || "Failed to load template. Some categories may have been created.")
      // Still refresh to show any categories that were created
      queryClient.invalidateQueries({ queryKey: ["abstract-categories", eventId] })
    } finally {
      setLoadingTemplate(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Abstract Categories</h1>
          <p className="text-muted-foreground mt-1">
            Define categories or tracks for abstract submissions
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowTemplateDialog(true)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Load Template
          </Button>
          <Button
            onClick={() => {
              resetForm()
              setEditingCategory(null)
              setShowDialog(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Categories</strong> help organize abstract submissions by topic or track.
          Common examples: Free Paper, Video, Poster, Young Investigator, Case Report.
          You can set a maximum number of submissions per category if needed.
        </p>
      </div>

      {/* Categories Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
          <FolderTree className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Categories Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create categories to organize abstract submissions
          </p>
          <Button
            onClick={() => {
              resetForm()
              setShowDialog(true)
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create First Category
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">Type</TableHead>
                <TableHead className="text-center">Award</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {category.description || "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 capitalize">
                      {category.submission_type || "paper"}
                    </span>
                    {category.required_file && (
                      <span className="ml-1 text-xs text-muted-foreground">(req)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {category.is_award_category ? (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        {category.award_name || "Award"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        category.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {category.is_active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(category)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm(category)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Create Category"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Category Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Free Paper, Video, Poster"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this category..."
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Submission Type</label>
                <select
                  value={formData.submission_type}
                  onChange={(e) => {
                    const type = e.target.value
                    setFormData({
                      ...formData,
                      submission_type: type,
                      allowed_file_types: type === "video" ? "mp4" : "pdf",
                    })
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="paper">Paper (PDF)</option>
                  <option value="video">Video (MP4)</option>
                  <option value="poster">Poster (PDF)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Allowed File Types</label>
                <Input
                  value={formData.allowed_file_types}
                  onChange={(e) => setFormData({ ...formData, allowed_file_types: e.target.value })}
                  placeholder="pdf, mp4"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Max Submissions</label>
                <Input
                  type="number"
                  value={formData.max_submissions}
                  onChange={(e) => setFormData({ ...formData, max_submissions: e.target.value })}
                  placeholder="Unlimited"
                  className="mt-1"
                  min={1}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Award Name</label>
                <Input
                  value={formData.award_name}
                  onChange={(e) => setFormData({ ...formData, award_name: e.target.value })}
                  placeholder="e.g. AMASI Medal"
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">File Upload Required</p>
                <p className="text-sm text-muted-foreground">
                  Submitters must upload a file
                </p>
              </div>
              <Switch
                checked={formData.required_file}
                onCheckedChange={(checked) => setFormData({ ...formData, required_file: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Award Category</p>
                <p className="text-sm text-muted-foreground">
                  This is a competitive award category
                </p>
              </div>
              <Switch
                checked={formData.is_award_category}
                onCheckedChange={(checked) => setFormData({ ...formData, is_award_category: checked })}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Active</p>
                <p className="text-sm text-muted-foreground">
                  Inactive categories won't appear in submission forms
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingCategory ? "Save Changes" : "Create Category"}
              </Button>
            </DialogFooter>
            {saveMutation.isError && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {saveMutation.error.message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
          </p>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {deleteMutation.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Load Category Template
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Quickly add standard categories from a template. You can edit or delete them after.
          </p>
          {templateError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {templateError}
            </div>
          )}
          <div className="grid gap-4 py-4">
            {Object.entries(CATEGORY_TEMPLATES).map(([key, template]) => (
              <div
                key={key}
                className="p-4 border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                onClick={() => !loadingTemplate && loadTemplate(key as keyof typeof CATEGORY_TEMPLATES)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{template.name}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingTemplate}
                    onClick={(e) => {
                      e.stopPropagation()
                      loadTemplate(key as keyof typeof CATEGORY_TEMPLATES)
                    }}
                  >
                    {loadingTemplate ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <FileDown className="h-4 w-4 mr-1" />
                        Load
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {template.categories.map((cat) => (
                    <span
                      key={cat.name}
                      className="px-2 py-1 bg-muted text-xs rounded-full"
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
