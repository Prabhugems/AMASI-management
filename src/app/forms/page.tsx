"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit2,
  Copy,
  Trash2,
  Globe,
  FileText,
  Users,
  Filter,
  LayoutTemplate,
  RefreshCw,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Form, FormType } from "@/lib/types"

const formTypeLabels: Record<FormType, string> = {
  standalone: "Standalone",
  event_registration: "Registration",
  feedback: "Feedback",
  survey: "Survey",
  application: "Application",
  contact: "Contact",
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/10 text-success",
  archived: "bg-warning/10 text-warning",
}

export default function FormsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFormData, setNewFormData] = useState({
    name: "",
    description: "",
    form_type: "standalone" as FormType,
  })

  // Fetch forms
  const { data: forms, isLoading, refetch } = useQuery({
    queryKey: ["forms", search, typeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (typeFilter !== "all") params.append("form_type", typeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter)

      const response = await fetch(`/api/forms?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch forms")
      return response.json() as Promise<Form[]>
    },
  })

  // Create form mutation
  const createForm = useMutation({
    mutationFn: async (data: typeof newFormData) => {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create form")
      }
      return response.json()
    },
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      setIsCreateOpen(false)
      setNewFormData({ name: "", description: "", form_type: "standalone" })
      toast.success("Form created successfully")
      router.push(`/forms/${form.id}/edit`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Delete form mutation
  const deleteForm = useMutation({
    mutationFn: async (formId: string) => {
      const response = await fetch(`/api/forms/${formId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete form")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      toast.success("Form deleted")
    },
    onError: () => {
      toast.error("Failed to delete form")
    },
  })

  const handleCreateForm = () => {
    if (!newFormData.name.trim()) {
      toast.error("Please enter a form name")
      return
    }
    createForm.mutate(newFormData)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Forms</h1>
          <p className="text-muted-foreground">
            Create and manage forms for registrations, surveys, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/forms/templates">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Templates
            </Link>
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Form
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(formTypeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Forms Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {forms.map((form) => (
            <div
              key={form.id}
              className="paper-card card-animated group overflow-hidden"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {form.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {form.description || "No description"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/forms/${form.id}/edit`}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      {form.status === "published" && (
                        <DropdownMenuItem asChild>
                          <a href={`/f/${form.slug}`} target="_blank" rel="noopener">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Live
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/forms/${form.id}/responses`}>
                          <Users className="w-4 h-4 mr-2" />
                          Responses
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        <Copy className="w-4 h-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteForm.mutate(form.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="text-xs font-normal">
                    {formTypeLabels[form.form_type]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-medium border-0 capitalize", statusColors[form.status])}
                  >
                    {form.status}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="w-4 h-4" />
                      <span>{form._count?.fields || 0} fields</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{form._count?.submissions || 0} responses</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Updated {format(new Date(form.updated_at), "dd MMM yyyy")}
                  </span>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/forms/${form.id}/edit`}>
                      Edit Form
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="paper-card p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first form to start collecting responses
          </p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Form
          </Button>
        </div>
      )}

      {/* Create Form Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Form Name</Label>
              <Input
                id="name"
                value={newFormData.name}
                onChange={(e) => setNewFormData({ ...newFormData, name: e.target.value })}
                placeholder="e.g., Event Registration Form"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={newFormData.description}
                onChange={(e) => setNewFormData({ ...newFormData, description: e.target.value })}
                placeholder="Brief description of the form"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="type">Form Type</Label>
              <Select
                value={newFormData.form_type}
                onValueChange={(value) => setNewFormData({ ...newFormData, form_type: value as FormType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateForm} disabled={createForm.isPending}>
              {createForm.isPending ? "Creating..." : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
