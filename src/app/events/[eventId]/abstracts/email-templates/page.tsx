"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Mail,
  Plus,
  Edit,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Copy,
  Code,
} from "lucide-react"
import { toast } from "sonner"
import { COMPANY_CONFIG } from "@/lib/config"

interface EmailTemplate {
  id: string
  name: string
  slug: string
  category: string
  description: string
  subject: string
  body_html: string
  body_text: string
  variables_available: string[]
  is_active: boolean
  is_default: boolean
  event_id: string | null
  created_at: string
}

const TEMPLATE_TYPES = [
  {
    type: "abstract_accepted",
    name: "Abstract Accepted",
    description: "Sent when an abstract is accepted",
    icon: CheckCircle,
    color: "text-green-600",
  },
  {
    type: "abstract_rejected",
    name: "Abstract Rejected",
    description: "Sent when an abstract is not accepted",
    icon: XCircle,
    color: "text-red-600",
  },
  {
    type: "abstract_revision",
    name: "Revision Requested",
    description: "Sent when revisions are requested",
    icon: AlertTriangle,
    color: "text-orange-600",
  },
  {
    type: "abstract_schedule",
    name: "Schedule Notification",
    description: "Sent when presentation is scheduled",
    icon: Mail,
    color: "text-blue-600",
  },
]

const AVAILABLE_VARIABLES = [
  { name: "author_name", description: "Presenting author's name" },
  { name: "author_email", description: "Presenting author's email" },
  { name: "abstract_number", description: "Abstract ID/number" },
  { name: "abstract_title", description: "Abstract title" },
  { name: "abstract_status", description: "Current status (Accepted, Rejected, etc.)" },
  { name: "accepted_as", description: "Presentation type (Oral, Poster, etc.)" },
  { name: "category_name", description: "Abstract category" },
  { name: "decision_notes", description: "Notes from reviewers/committee" },
  { name: "presentation_date", description: "Scheduled presentation date" },
  { name: "presentation_time", description: "Scheduled presentation time" },
  { name: "presentation_location", description: "Hall/room for presentation" },
  { name: "event_name", description: "Event name" },
  { name: "event_date", description: "Event date" },
  { name: "portal_url", description: "Link to author portal" },
  { name: "organizer_name", description: "Organization name" },
  { name: "year", description: "Current year" },
]

export default function AbstractEmailTemplatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const [form, setForm] = useState({
    name: "",
    category: "abstract_accepted",
    description: "",
    subject: "",
    body_html: "",
    is_default: true,
  })

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates", eventId, "abstract"],
    queryFn: async () => {
      const res = await fetch(`/api/email-templates?event_id=${eventId}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json() as EmailTemplate[]
      // Filter to abstract-related templates
      return data.filter((t) =>
        t.category?.startsWith("abstract_") ||
        ["abstract_accepted", "abstract_rejected", "abstract_revision", "abstract_schedule"].includes(t.category)
      )
    },
  })

  // Create/Update template
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingTemplate
        ? `/api/email-templates/${editingTemplate.id}`
        : "/api/email-templates"
      const method = editingTemplate ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          event_id: eventId,
          variables_available: AVAILABLE_VARIABLES.map((v) => v.name),
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", eventId] })
      setShowEditor(false)
      setEditingTemplate(null)
      resetForm()
      toast.success(editingTemplate ? "Template updated" : "Template created")
    },
    onError: () => {
      toast.error("Failed to save template")
    },
  })

  const resetForm = () => {
    setForm({
      name: "",
      category: "abstract_accepted",
      description: "",
      subject: "",
      body_html: "",
      is_default: true,
    })
  }

  const openEditor = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template)
      setForm({
        name: template.name,
        category: template.category,
        description: template.description || "",
        subject: template.subject,
        body_html: template.body_html,
        is_default: template.is_default,
      })
    } else {
      setEditingTemplate(null)
      resetForm()
    }
    setShowEditor(true)
  }

  const insertVariable = (varName: string) => {
    const variable = `{{${varName}}}`
    setForm((prev) => ({
      ...prev,
      body_html: prev.body_html + variable,
    }))
  }

  const previewTemplate = () => {
    // Replace variables with sample data
    let preview = form.body_html
    const sampleData: Record<string, string> = {
      author_name: "Dr. John Smith",
      author_email: "john.smith@example.com",
      abstract_number: "ABS-2024-001",
      abstract_title: "A Study on Machine Learning Applications in Healthcare",
      abstract_status: "Accepted",
      accepted_as: "Oral Presentation",
      category_name: "Artificial Intelligence",
      decision_notes: "Excellent research methodology and clear presentation of results.",
      presentation_date: "March 15, 2024",
      presentation_time: "10:30 AM",
      presentation_location: "Hall A, Room 101",
      event_name: `${COMPANY_CONFIG.name} Annual Conference 2024`,
      event_date: "March 15-17, 2024",
      portal_url: "https://example.com/my",
      organizer_name: COMPANY_CONFIG.name,
      year: "2024",
    }

    for (const [key, value] of Object.entries(sampleData)) {
      preview = preview.replace(new RegExp(`{{${key}}}`, "g"), value)
    }

    setPreviewHtml(preview)
    setShowPreview(true)
  }

  const copyVariable = (varName: string) => {
    navigator.clipboard.writeText(`{{${varName}}}`)
    toast.success(`Copied {{${varName}}}`)
  }

  // Group templates by type
  const templatesByType = TEMPLATE_TYPES.map((type) => ({
    ...type,
    templates: templates.filter((t) => t.category === type.type),
  }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground">
            Customize notification emails sent to abstract authors
          </p>
        </div>
        <Button onClick={() => openEditor()} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Template Types */}
      <div className="grid gap-4">
        {templatesByType.map((type) => {
          const Icon = type.icon
          const hasTemplate = type.templates.length > 0
          const defaultTemplate = type.templates.find((t) => t.is_default)

          return (
            <Card key={type.type}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${type.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <CardDescription>{type.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasTemplate ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {type.templates.length} template(s)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Using default
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, category: type.type }))
                        openEditor()
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {type.templates.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {type.templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Subject: {template.subject}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {template.is_default && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditor(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Email Template"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="editor" className="mt-4">
            <TabsList>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="variables">Variables</TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Template Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Acceptance Email v1"
                  />
                </div>
                <div>
                  <Label>Template Type</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map((type) => (
                        <SelectItem key={type.type} value={type.type}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Description (optional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this template"
                />
              </div>

              <div>
                <Label>Email Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., Your Abstract has been Accepted - {{event_name}}"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You can use variables like {"{{author_name}}"} in the subject
                </p>
              </div>

              <div>
                <Label>Email Body (HTML)</Label>
                <Textarea
                  value={form.body_html}
                  onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                  placeholder="<p>Dear {{author_name}},</p>..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={previewTemplate}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEditor(false)
                      setEditingTemplate(null)
                      resetForm()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate(form)}
                    disabled={!form.name || !form.subject || !form.body_html || saveMutation.isPending}
                  >
                    {saveMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    {editingTemplate ? "Update" : "Create"} Template
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="variables" className="mt-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click on a variable to copy it. Use these in your subject and body with double
                  curly braces: {"{{variable_name}}"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => copyVariable(v.name)}
                    >
                      <div>
                        <code className="text-sm font-mono text-primary">
                          {`{{${v.name}}}`}
                        </code>
                        <p className="text-xs text-muted-foreground">{v.description}</p>
                      </div>
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="bg-muted p-3 border-b">
              <p className="text-sm">
                <strong>Subject:</strong> {form.subject.replace(/{{(\w+)}}/g, (_, key) => {
                  const samples: Record<string, string> = {
                    event_name: `${COMPANY_CONFIG.name} Annual Conference 2024`,
                    author_name: "Dr. John Smith",
                    abstract_number: "ABS-2024-001",
                  }
                  return samples[key] || `{{${key}}}`
                })}
              </p>
            </div>
            <div
              className="p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
