"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { format } from "date-fns"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit2,
  Copy,
  Trash2,
  ExternalLink,
  FileText,
  Users,
  RefreshCw,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const formTypeLabels: Record<string, string> = {
  event_registration: "Registration",
  feedback: "Feedback",
  survey: "Survey",
  application: "Application",
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-success/10 text-success",
  archived: "bg-warning/10 text-warning",
}

export default function EventFormsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newFormData, setNewFormData] = useState({
    name: "",
    description: "",
    form_type: "event_registration",
  })

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .eq("id", eventId)
        .single()
      return data as { id: string; name: string; short_name: string | null } | null
    },
  })

  // Fetch forms for this event
  const { data: forms, isLoading, refetch: _refetch } = useQuery({
    queryKey: ["event-forms", eventId, search],
    queryFn: async () => {
      let query = supabase
        .from("forms")
        .select(`
          *,
          form_fields(count),
          form_submissions(count)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error

      return data?.map((form: any) => ({
        ...form,
        _count: {
          fields: form.form_fields?.[0]?.count || 0,
          submissions: form.form_submissions?.[0]?.count || 0,
        },
      }))
    },
  })

  // Create form mutation
  const createForm = useMutation({
    mutationFn: async (data: typeof newFormData) => {
      const response = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          event_id: eventId,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create form")
      }
      return response.json()
    },
    onSuccess: (form) => {
      queryClient.invalidateQueries({ queryKey: ["event-forms", eventId] })
      setIsCreateOpen(false)
      setNewFormData({ name: "", description: "", form_type: "event_registration" })
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
      queryClient.invalidateQueries({ queryKey: ["event-forms", eventId] })
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Event Forms</h1>
          <p className="text-muted-foreground text-sm">
            Create and manage forms for {event?.short_name || event?.name || "this event"}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Form
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Forms Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form: any) => (
            <div
              key={form.id}
              className="paper-card p-5 group hover:shadow-md transition-all"
            >
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
                        Edit Form
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
                        <Eye className="w-4 h-4 mr-2" />
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
                  {formTypeLabels[form.form_type] || form.form_type}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs font-medium border-0 capitalize", statusColors[form.status])}
                >
                  {form.status}
                </Badge>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  <span>{form._count?.fields || 0} fields</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{form._count?.submissions || 0} responses</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Updated {format(new Date(form.updated_at), "dd MMM yyyy")}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/forms/${form.id}/edit`}>
                    Edit
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="paper-card p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-6">
            Create your first form for this event
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
            <DialogTitle>Create Event Form</DialogTitle>
            <DialogDescription className="sr-only">Create a new form for this event</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Form Name</Label>
              <Input
                id="name"
                value={newFormData.name}
                onChange={(e) => setNewFormData({ ...newFormData, name: e.target.value })}
                placeholder="e.g., Registration Form"
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
                onValueChange={(value) => setNewFormData({ ...newFormData, form_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event_registration">Registration</SelectItem>
                  <SelectItem value="feedback">Feedback</SelectItem>
                  <SelectItem value="survey">Survey</SelectItem>
                  <SelectItem value="application">Application</SelectItem>
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
