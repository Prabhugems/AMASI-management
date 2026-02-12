"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import DOMPurify from "dompurify"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Send,
  Loader2,
  Code,
  FileText,
  Copy,
  Star,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { HelpTooltip } from "@/components/ui/help-tooltip"

type EmailTemplate = {
  id: string
  event_id: string | null
  name: string
  slug: string
  category: string
  description: string | null
  subject: string
  body_html: string
  body_text: string | null
  variables_available: string[]
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
}

const TEMPLATE_CATEGORIES = [
  { value: "registration", label: "Registration", icon: "📝" },
  { value: "payment", label: "Payment", icon: "💳" },
  { value: "badge", label: "Badge", icon: "🎫" },
  { value: "certificate", label: "Certificate", icon: "📜" },
  { value: "invitation", label: "Invitation", icon: "🎤" },
  { value: "reminder", label: "Reminder", icon: "⏰" },
  { value: "confirmation", label: "Confirmation", icon: "✅" },
  { value: "notification", label: "Notification", icon: "🔔" },
  { value: "custom", label: "Custom", icon: "✉️" },
]

const AVAILABLE_VARIABLES = [
  { category: "Attendee", variables: ["attendee_name", "attendee_email", "registration_number", "ticket_type", "amount", "payment_id"] },
  { category: "Event", variables: ["event_name", "event_date", "venue_name", "venue_address"] },
  { category: "Speaker", variables: ["speaker_name", "speaker_role", "session_name", "session_date", "session_time", "hall_name", "response_url"] },
  { category: "Documents", variables: ["badge_url", "certificate_url"] },
  { category: "Organizer", variables: ["organizer_name", "organizer_email", "year"] },
]

export default function EmailTemplatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewSubject, setPreviewSubject] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [filterType, setFilterType] = useState<string>("all")

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "custom",
    description: "",
    subject: "",
    body_html: "",
    variables_available: [] as string[],
    is_active: true,
    is_default: false,
  })

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/email-templates?event_id=${eventId}`)
      return res.json() as Promise<EmailTemplate[]>
    },
  })

  // Create template
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, event_id: eventId }),
      })
      if (!res.ok) throw new Error("Failed to create template")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", eventId] })
      toast.success("Template created successfully")
      setIsEditorOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create template")
    },
  })

  // Update template
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update template")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", eventId] })
      toast.success("Template updated successfully")
      setIsEditorOpen(false)
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update template")
    },
  })

  // Delete template
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/email-templates/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete template")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", eventId] })
      toast.success("Template deleted")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete template")
    },
  })

  // Send test email
  const testMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const res = await fetch(`/api/email-templates/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send test email")
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success(`Test email sent to ${testEmail}`)
      setIsTestOpen(false)
      setTestEmail("")
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send test email")
    },
  })

  const resetForm = () => {
    setFormData({
      name: "",
      category: "custom",
      description: "",
      subject: "",
      body_html: "",
      variables_available: [],
      is_active: true,
      is_default: false,
    })
    setSelectedTemplate(null)
  }

  const openEditor = (template?: EmailTemplate) => {
    if (template) {
      setSelectedTemplate(template)
      setFormData({
        name: template.name,
        category: template.category,
        description: template.description || "",
        subject: template.subject,
        body_html: template.body_html,
        variables_available: template.variables_available || [],
        is_active: template.is_active,
        is_default: template.is_default,
      })
    } else {
      resetForm()
    }
    setIsEditorOpen(true)
  }

  const openPreview = async (template: EmailTemplate) => {
    try {
      const res = await fetch(`/api/email-templates/${template.id}/test`)
      const data = await res.json()
      setPreviewSubject(data.subject)
      setPreviewHtml(data.body_html)
      setIsPreviewOpen(true)
    } catch (_error) {
      toast.error("Failed to load preview")
    }
  }

  const openTestSend = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setIsTestOpen(true)
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("body_html") as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = formData.body_html
      const before = text.substring(0, start)
      const after = text.substring(end)
      const newText = `${before}{{${variable}}}${after}`
      setFormData({ ...formData, body_html: newText })

      // Reset cursor position
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4
        textarea.focus()
      }, 0)
    }
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.subject || !formData.body_html) {
      toast.error("Please fill in all required fields")
      return
    }

    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const filteredTemplates = templates?.filter(
    (t) => filterType === "all" || t.category === filterType
  )

  const getCategoryConfig = (category: string) => {
    return TEMPLATE_CATEGORIES.find((t) => t.value === category) || { label: category, icon: "📧" }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Templates
          </h1>
          <p className="text-muted-foreground">
            Customize email templates for different communications
          </p>
        </div>
        <Button onClick={() => openEditor()}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">How Email Templates Work</p>
            <p className="text-sm text-blue-700 mt-1">
              Templates use variables like <code className="bg-blue-100 px-1 rounded">{"{{attendee_name}}"}</code> that get replaced with actual data when sending emails.
              You can customize the subject, content, and styling of each email type.
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Templates</SelectItem>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredTemplates?.length || 0} templates
        </span>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTemplates?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border border-dashed">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No templates found</h3>
          <p className="text-muted-foreground mb-4">
            Create your first email template to get started
          </p>
          <Button onClick={() => openEditor()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates?.map((template) => {
            const categoryConfig = getCategoryConfig(template.category)
            const isGlobal = !template.event_id

            return (
              <div
                key={template.id}
                className={cn(
                  "bg-card rounded-lg border p-4 hover:shadow-md transition-shadow",
                  !template.is_active && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{categoryConfig.icon}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{template.name}</h3>
                        {template.is_default && (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {isGlobal && (
                          <Badge variant="outline">System</Badge>
                        )}
                        {!template.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {categoryConfig.label} {template.description && `• ${template.description}`}
                      </p>
                      <p className="text-sm mt-2 font-mono bg-muted px-2 py-1 rounded">
                        Subject: {template.subject}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPreview(template)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openTestSend(template)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    {!isGlobal && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditor(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Delete this template?")) {
                              deleteMutation.mutate(template.id)
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {isGlobal && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Clone the global template for this event
                          setFormData({
                            name: `${template.name} (Custom)`,
                            category: template.category,
                            description: template.description || "",
                            subject: template.subject,
                            body_html: template.body_html,
                            variables_available: template.variables_available || [],
                            is_active: true,
                            is_default: false,
                          })
                          setSelectedTemplate(null)
                          setIsEditorOpen(true)
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Customize
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Custom Registration Email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when this template is used"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line *</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Your registration for {{event_name}} is confirmed!"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{{variable}}"} to insert dynamic content
              </p>
            </div>

            {/* Variables Panel */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Code className="h-4 w-4" />
                <span className="font-medium text-sm">Available Variables</span>
                <HelpTooltip content="Click a variable to insert it at cursor position in the email body" />
              </div>
              <div className="space-y-3">
                {AVAILABLE_VARIABLES.map((group) => (
                  <div key={group.category}>
                    <p className="text-xs text-muted-foreground mb-1">{group.category}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.variables.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="text-xs bg-background border rounded px-2 py-1 hover:bg-primary hover:text-primary-foreground transition-colors font-mono"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body_html">Email Body (HTML) *</Label>
              <Textarea
                id="body_html"
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="Enter your email content with HTML formatting..."
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label htmlFor="is_default">Set as default for this type</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {selectedTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Email Preview
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium">{previewSubject}</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Email Body</span>
              </div>
              <div
                className="p-4 bg-white max-h-[500px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml, {
                  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'img', 'hr'],
                  ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'target', 'width', 'height', 'align', 'valign', 'border', 'cellpadding', 'cellspacing'],
                  ALLOW_DATA_ATTR: false,
                }) }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              * Preview shows sample data. Actual emails will use real attendee/event information.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Send Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Send a test email to verify how the template looks. Sample data will be used for variables.
            </p>

            <div className="space-y-2">
              <Label htmlFor="test_email">Email Address</Label>
              <Input
                id="test_email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedTemplate && testEmail) {
                  testMutation.mutate({ id: selectedTemplate.id, email: testEmail })
                }
              }}
              disabled={!testEmail || testMutation.isPending}
            >
              {testMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
