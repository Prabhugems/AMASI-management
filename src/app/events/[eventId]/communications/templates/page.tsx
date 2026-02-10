"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Sparkles,
  Zap,
  Clock,
  UserPlus,
  CreditCard,
  Award,
  CheckCircle,
  Eye,
  X,
  Save,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Template = {
  id: string
  event_id: string | null
  name: string
  description: string | null
  channel: string
  email_subject: string | null
  email_body: string | null
  message_body: string | null
  variables: string[]
  is_system: boolean
  is_active: boolean
  auto_send: boolean
  trigger_type: string | null
  trigger_value: number
  created_at: string
}

const triggerTypes = [
  { value: "manual", label: "Manual Only", icon: FileText, description: "Send manually from Compose" },
  { value: "on_registration", label: "On Registration", icon: UserPlus, description: "When someone registers" },
  { value: "on_payment", label: "On Payment", icon: CreditCard, description: "When payment is confirmed" },
  { value: "days_before_event", label: "Days Before Event", icon: Clock, description: "Scheduled reminder" },
  { value: "on_checkin", label: "On Check-in", icon: CheckCircle, description: "When attendee checks in" },
  { value: "on_certificate_ready", label: "Certificate Ready", icon: Award, description: "When certificate is generated" },
]

const emptyTemplate: Omit<Template, "id" | "created_at"> = {
  event_id: null,
  name: "",
  description: "",
  channel: "email",
  email_subject: "",
  email_body: "",
  message_body: "",
  variables: [],
  is_system: false,
  is_active: true,
  auto_send: false,
  trigger_type: "manual",
  trigger_value: 0,
}

export default function TemplatesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<Omit<Template, "id" | "created_at">>(emptyTemplate)
  const [seeding, setSeeding] = useState(false)
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit")
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("message_templates")
        .select("*")
        .or(`event_id.eq.${eventId},event_id.is.null`)
        .order("is_system", { ascending: false })
        .order("name")

      return (data || []) as Template[]
    },
  })

  // Update form when template selected
  useEffect(() => {
    if (selectedTemplate) {
      setFormData({
        name: selectedTemplate.name,
        description: selectedTemplate.description || "",
        channel: selectedTemplate.channel,
        email_subject: selectedTemplate.email_subject || "",
        email_body: selectedTemplate.email_body || "",
        message_body: selectedTemplate.message_body || "",
        variables: selectedTemplate.variables || [],
        is_system: selectedTemplate.is_system,
        is_active: selectedTemplate.is_active,
        auto_send: selectedTemplate.auto_send || false,
        trigger_type: selectedTemplate.trigger_type || "manual",
        trigger_value: selectedTemplate.trigger_value || 0,
        event_id: selectedTemplate.event_id,
      })
      setIsCreating(false)
      setHasChanges(false)
    }
  }, [selectedTemplate])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Omit<Template, "id" | "created_at"> & { id?: string }) => {
      if (data.id) {
        const { error } = await (supabase as any)
          .from("message_templates")
          .update({
            name: data.name,
            description: data.description,
            channel: data.channel,
            email_subject: data.email_subject,
            email_body: data.email_body,
            message_body: data.message_body,
            variables: data.variables,
            is_active: data.is_active,
            auto_send: data.auto_send,
            trigger_type: data.trigger_type,
            trigger_value: data.trigger_value,
          })
          .eq("id", data.id)
        if (error) throw error
      } else {
        const { data: newTemplate, error } = await (supabase as any)
          .from("message_templates")
          .insert({
            event_id: eventId,
            name: data.name,
            description: data.description,
            channel: data.channel,
            email_subject: data.email_subject,
            email_body: data.email_body,
            message_body: data.message_body,
            variables: data.variables,
            is_active: data.is_active,
            auto_send: data.auto_send,
            trigger_type: data.trigger_type,
            trigger_value: data.trigger_value,
          })
          .select()
          .single()
        if (error) throw error
        return newTemplate
      }
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["templates", eventId] })
      toast.success(isCreating ? "Template created" : "Template saved")
      setHasChanges(false)
      if (isCreating && newTemplate) {
        setSelectedTemplate(newTemplate)
        setIsCreating(false)
      }
    },
    onError: () => {
      toast.error("Failed to save template")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("message_templates")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", eventId] })
      toast.success("Template deleted")
      setSelectedTemplate(null)
      setIsCreating(false)
    },
    onError: () => {
      toast.error("Failed to delete template")
    },
  })

  const handleCreateNew = () => {
    setSelectedTemplate(null)
    setFormData(emptyTemplate)
    setIsCreating(true)
    setHasChanges(false)
  }

  const handleSelectTemplate = (template: Template) => {
    if (hasChanges) {
      if (!confirm("You have unsaved changes. Discard them?")) return
    }
    setSelectedTemplate(template)
    setIsCreating(false)
  }

  const handleFormChange = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required")
      return
    }
    saveMutation.mutate({
      ...formData,
      id: selectedTemplate?.id,
    })
  }

  const handleDuplicate = (template: Template) => {
    setSelectedTemplate(null)
    setFormData({
      ...template,
      name: `${template.name} (Copy)`,
      is_system: false,
      event_id: eventId,
    })
    setIsCreating(true)
    setHasChanges(true)
  }

  const handleDelete = () => {
    if (!selectedTemplate) return
    if (selectedTemplate.is_system) {
      toast.error("Cannot delete system templates")
      return
    }
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(selectedTemplate.id)
    }
  }

  const seedTemplates = async () => {
    setSeeding(true)
    try {
      const response = await fetch(`/api/communications/templates/seed?event_id=${eventId}`, {
        method: "POST",
      })
      const result = await response.json()
      if (result.success) {
        toast.success(result.message)
        queryClient.invalidateQueries({ queryKey: ["templates", eventId] })
      } else {
        if (result.error?.includes("schema cache") || result.details?.code === "PGRST205") {
          toast.error("Database tables not ready. Please run the migration.", { duration: 10000 })
        } else {
          toast.error(result.error || "Failed to load templates")
        }
      }
    } catch {
      toast.error("Failed to load templates")
    } finally {
      setSeeding(false)
    }
  }

  const getChannelIcon = (channel: string, size = "h-4 w-4") => {
    switch (channel) {
      case "email": return <Mail className={cn(size, "text-blue-500")} />
      case "whatsapp": return <MessageSquare className={cn(size, "text-green-500")} />
      case "sms": return <Phone className={cn(size, "text-purple-500")} />
      default: return <FileText className={cn(size, "text-muted-foreground")} />
    }
  }

  const filteredTemplates = templates?.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())
    const matchesChannel = channelFilter === "all" || t.channel === channelFilter || t.channel === "all"
    return matchesSearch && matchesChannel
  })

  const availableVariables = [
    { name: "name", description: "Recipient's name" },
    { name: "event_name", description: "Event name" },
    { name: "event_date", description: "Event date" },
    { name: "venue", description: "Event venue" },
    { name: "registration_id", description: "Registration ID" },
    { name: "ticket_type", description: "Ticket type" },
    { name: "amount", description: "Payment amount" },
  ]

  // Preview with sample data
  const getPreviewContent = (text: string | null) => {
    if (!text) return ""
    return text
      .replace(/\{\{name\}\}/gi, "Dr. John Smith")
      .replace(/\{\{event_name\}\}/gi, "121 FMAS")
      .replace(/\{\{event_date\}\}/gi, "January 30, 2026")
      .replace(/\{\{venue\}\}/gi, "Chennai Convention Center")
      .replace(/\{\{registration_id\}\}/gi, "REG-2026-001")
      .replace(/\{\{ticket_type\}\}/gi, "Delegate Pass")
      .replace(/\{\{amount\}\}/gi, "5,000")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const showEditor = selectedTemplate || isCreating

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-xl font-bold">Message Templates</h1>
          <p className="text-sm text-muted-foreground">Create and manage reusable message templates</p>
        </div>
        <div className="flex items-center gap-2">
          {(!templates || templates.filter(t => t.event_id === eventId).length === 0) && (
            <Button variant="outline" size="sm" onClick={seedTemplates} disabled={seeding}>
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Load Templates
            </Button>
          )}
          <Button size="sm" onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Main Content - Side by Side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Template List */}
        <div className="w-80 border-r flex flex-col bg-muted/30">
          {/* Search & Filter */}
          <div className="p-3 space-y-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Template List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredTemplates?.map((template) => {
                const isSelected = selectedTemplate?.id === template.id
                const trigger = triggerTypes.find(t => t.value === template.trigger_type) || triggerTypes[0]
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "h-8 w-8 rounded flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary-foreground/20" : "bg-secondary"
                      )}>
                        {getChannelIcon(template.channel)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className={cn("font-medium text-sm truncate", isSelected && "text-primary-foreground")}>
                            {template.name}
                          </p>
                          {template.auto_send && (
                            <Zap className={cn("h-3 w-3 flex-shrink-0", isSelected ? "text-primary-foreground" : "text-amber-500")} />
                          )}
                        </div>
                        <p className={cn(
                          "text-xs truncate",
                          isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {trigger.label}
                          {template.trigger_type === "days_before_event" && ` (${template.trigger_value}d)`}
                        </p>
                      </div>
                      {template.is_system && (
                        <Badge variant={isSelected ? "outline" : "secondary"} className="text-[9px] flex-shrink-0">
                          System
                        </Badge>
                      )}
                    </div>
                  </button>
                )
              })}
              {filteredTemplates?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No templates found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showEditor ? (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  {getChannelIcon(formData.channel, "h-5 w-5")}
                  <span className="font-medium">
                    {isCreating ? "New Template" : formData.name}
                  </span>
                  {hasChanges && (
                    <Badge variant="outline" className="text-[10px]">Unsaved</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!isCreating && selectedTemplate && !selectedTemplate.is_system && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => handleDuplicate(selectedTemplate)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedTemplate(null); setIsCreating(false) }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 overflow-hidden flex">
                {/* Form Side */}
                <ScrollArea className="flex-1 border-r">
                  <div className="p-4 space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Template Name *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => handleFormChange({ name: e.target.value })}
                          placeholder="e.g., Registration Confirmation"
                          disabled={selectedTemplate?.is_system}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Channel</Label>
                        <Select
                          value={formData.channel}
                          onValueChange={(value) => handleFormChange({ channel: value })}
                          disabled={selectedTemplate?.is_system}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="all">All Channels</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={formData.description || ""}
                        onChange={(e) => handleFormChange({ description: e.target.value })}
                        placeholder="Brief description"
                        disabled={selectedTemplate?.is_system}
                        className="h-9"
                      />
                    </div>

                    {/* Auto-Send Config */}
                    <div className="p-3 rounded-lg border bg-secondary/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="text-sm font-medium">Auto-Send</span>
                        </div>
                        <Switch
                          checked={formData.auto_send}
                          onCheckedChange={(checked) => handleFormChange({ auto_send: checked })}
                          disabled={formData.trigger_type === "manual" || selectedTemplate?.is_system}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Trigger</Label>
                          <Select
                            value={formData.trigger_type || "manual"}
                            onValueChange={(value) => handleFormChange({
                              trigger_type: value,
                              auto_send: value === "manual" ? false : formData.auto_send
                            })}
                            disabled={selectedTemplate?.is_system}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {triggerTypes.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {formData.trigger_type === "days_before_event" && (
                          <div className="space-y-1.5">
                            <Label className="text-xs">Days Before</Label>
                            <Select
                              value={String(formData.trigger_value || 1)}
                              onValueChange={(value) => handleFormChange({ trigger_value: parseInt(value) })}
                              disabled={selectedTemplate?.is_system}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 7, 14, 30].map(d => (
                                  <SelectItem key={d} value={String(d)}>{d} day{d > 1 ? "s" : ""}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Email Fields */}
                    {(formData.channel === "email" || formData.channel === "all") && (
                      <>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Email Subject</Label>
                          <Input
                            value={formData.email_subject || ""}
                            onChange={(e) => handleFormChange({ email_subject: e.target.value })}
                            placeholder="Subject line"
                            disabled={selectedTemplate?.is_system}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Email Body</Label>
                          <Textarea
                            value={formData.email_body || ""}
                            onChange={(e) => handleFormChange({ email_body: e.target.value })}
                            placeholder="Email content..."
                            rows={8}
                            disabled={selectedTemplate?.is_system}
                            className="text-sm"
                          />
                        </div>
                      </>
                    )}

                    {/* WhatsApp/SMS Fields */}
                    {(formData.channel === "whatsapp" || formData.channel === "sms" || formData.channel === "all") && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          {formData.channel === "all" ? "WhatsApp/SMS Message" : `${formData.channel === "whatsapp" ? "WhatsApp" : "SMS"} Message`}
                        </Label>
                        <Textarea
                          value={formData.message_body || ""}
                          onChange={(e) => handleFormChange({ message_body: e.target.value })}
                          placeholder="Message content..."
                          rows={5}
                          disabled={selectedTemplate?.is_system}
                          className="text-sm"
                        />
                        {formData.channel === "sms" && (
                          <p className="text-xs text-muted-foreground">
                            {(formData.message_body || "").length} / 160 characters
                          </p>
                        )}
                      </div>
                    )}

                    {/* Variables */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Variables (click to insert)</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableVariables.map((v) => (
                          <button
                            key={v.name}
                            type="button"
                            onClick={() => {
                              if (selectedTemplate?.is_system) return
                              const variable = `{{${v.name}}}`
                              if (formData.channel === "email" || formData.channel === "all") {
                                handleFormChange({ email_body: (formData.email_body || "") + variable })
                              } else {
                                handleFormChange({ message_body: (formData.message_body || "") + variable })
                              }
                            }}
                            disabled={selectedTemplate?.is_system}
                            className="px-2 py-1 text-xs rounded bg-background border hover:bg-muted transition-colors disabled:opacity-50"
                            title={v.description}
                          >
                            {`{{${v.name}}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* Preview Side */}
                <div className="w-96 flex flex-col bg-muted/20">
                  <div className="p-2 border-b">
                    <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as any)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="edit" className="text-xs h-7">
                          <Eye className="h-3 w-3 mr-1" />
                          Preview
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {(formData.channel === "email" || formData.channel === "all") && (
                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                          <div className="bg-muted/50 px-4 py-2 border-b">
                            <p className="text-xs text-muted-foreground">Subject:</p>
                            <p className="font-medium text-sm">{getPreviewContent(formData.email_subject) || "No subject"}</p>
                          </div>
                          <div className="p-4">
                            <div className="text-sm whitespace-pre-wrap text-foreground">
                              {getPreviewContent(formData.email_body) || "No content"}
                            </div>
                          </div>
                        </div>
                      )}
                      {(formData.channel === "whatsapp" || formData.channel === "sms") && (
                        <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[280px] shadow-sm">
                          <div className="text-sm whitespace-pre-wrap">
                            {getPreviewContent(formData.message_body) || "No message"}
                          </div>
                          <p className="text-[10px] text-right text-muted-foreground mt-1">10:30 AM</p>
                        </div>
                      )}
                      {formData.channel === "all" && formData.message_body && (
                        <div className="mt-4">
                          <p className="text-xs text-muted-foreground mb-2">WhatsApp/SMS Preview:</p>
                          <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[280px] shadow-sm">
                            <div className="text-sm whitespace-pre-wrap">
                              {getPreviewContent(formData.message_body)}
                            </div>
                            <p className="text-[10px] text-right text-muted-foreground mt-1">10:30 AM</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Editor Footer */}
              <div className="flex items-center justify-end gap-2 p-3 border-t bg-muted/30">
                <Button variant="outline" size="sm" onClick={() => { setSelectedTemplate(null); setIsCreating(false) }}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || selectedTemplate?.is_system}>
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isCreating ? "Create" : "Save"} Template
                </Button>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Select a template to edit</p>
                <p className="text-sm">or create a new one</p>
                <Button className="mt-4" onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
