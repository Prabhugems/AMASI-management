"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Award,
  Loader2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

type Template = {
  id: string
  name: string
  size: string
  is_active?: boolean
  created_at: string
  updated_at: string
}

export default function CertificateTemplatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")

  // Fetch templates via API route (bypasses RLS)
  const { data: templates, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: ["certificate-templates-list", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to fetch templates")
      }
      return (await res.json()) as Template[]
    },
    retry: 2,
    staleTime: 0,
    refetchOnMount: true,
  })

  // Delete template via API route
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/certificate-templates?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete template")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates-list", eventId] })
      toast.success("Template deleted")
    },
    onError: () => {
      toast.error("Failed to delete template")
    },
  })

  // Toggle active via API route
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch("/api/certificate-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active, event_id: eventId }),
      })
      if (!res.ok) throw new Error("Failed to update template")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates-list", eventId] })
      toast.success("Template updated")
    },
  })

  // Duplicate template via API route
  const duplicateMutation = useMutation({
    mutationFn: async (template: Template) => {
      // Fetch full template data via API
      const res = await fetch(`/api/certificate-templates?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch templates")
      const allTemplates = await res.json()
      const original = allTemplates.find((t: any) => t.id === template.id)
      if (!original) throw new Error("Template not found")

      const { id, created_at, updated_at, ...rest } = original
      const createRes = await fetch("/api/certificate-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, name: `${template.name} (Copy)` }),
      })
      if (!createRes.ok) throw new Error("Failed to duplicate template")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates-list", eventId] })
      toast.success("Template duplicated")
    },
  })

  const filteredTemplates = templates?.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (isLoading) {
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
          <h1 className="text-2xl font-bold">Certificate Templates</h1>
          <p className="text-muted-foreground">Manage your saved certificate designs</p>
        </div>
        <Link href={`/events/${eventId}/certificates/designer`}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Error State */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Failed to load templates</p>
            <p className="text-sm text-red-600">{fetchError.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Templates Table */}
      {!fetchError && filteredTemplates.length === 0 && (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            {search ? "Try a different search term" : "Create your first certificate template"}
          </p>
          {!search && (
            <Link href={`/events/${eventId}/certificates/designer`}>
              <Button>Create Template</Button>
            </Link>
          )}
        </div>
      )}
      {filteredTemplates.length > 0 && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">{template.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {template.size || "A4 Landscape"}
                  </TableCell>
                  <TableCell>
                    {template.is_active !== false ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-sm">
                        <XCircle className="h-4 w-4" />
                        Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(template.updated_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/events/${eventId}/certificates/designer?template=${template.id}`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleActiveMutation.mutate({
                            id: template.id,
                            is_active: template.is_active === false ? true : false,
                          })}
                        >
                          {template.is_active !== false ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this template?")) {
                              deleteMutation.mutate(template.id)
                            }
                          }}
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
    </div>
  )
}
