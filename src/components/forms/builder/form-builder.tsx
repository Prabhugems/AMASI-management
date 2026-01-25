"use client"

import { useState, useCallback, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Form, FormField, FieldType } from "@/lib/types"
import { FieldPalette, fieldTypes } from "./field-palette"
import { Canvas } from "./canvas"
import { FieldEditor } from "./field-editor"
import { FieldPreview } from "./field-preview"
import { FormSettings } from "./form-settings"
import { FormDesign } from "./form-design"
import { ConditionalLogicEditor } from "./conditional-logic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Save,
  Eye,
  Globe,
  ArrowLeft,
  Loader2,
  Layers,
  Palette,
  Settings2,
  Zap,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
  PanelLeftClose,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  QrCode,
  Twitter,
  Facebook,
  Linkedin,
  Link2,
  CheckCircle2,
  Edit3,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface FormBuilderProps {
  form: Form
  initialFields: FormField[]
  onSave: (form: Partial<Form>, fields: FormField[]) => Promise<void>
  backUrl?: string
}

type BuilderTab = "build" | "design" | "settings" | "logic" | "share"

export function FormBuilder({
  form: initialForm,
  initialFields,
  onSave,
  backUrl = "/forms",
}: FormBuilderProps) {
  const router = useRouter()
  const [form, setForm] = useState<Form>(initialForm)
  const [fields, setFields] = useState<FormField[]>(initialFields)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<BuilderTab>("build")
  const [copiedSlug, setCopiedSlug] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320) // Default 320px (w-80)
  const [rightPanelWidth, setRightPanelWidth] = useState(384) // Default 384px (w-96)
  const [isResizingLeft, setIsResizingLeft] = useState(false)
  const [isResizingRight, setIsResizingRight] = useState(false)

  // Handle sidebar resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingLeft) {
      const newWidth = Math.min(Math.max(e.clientX, 240), 500) // Min 240px, max 500px
      setSidebarWidth(newWidth)
    }
    if (isResizingRight) {
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 300), 600) // Min 300px, max 600px
      setRightPanelWidth(newWidth)
    }
  }, [isResizingLeft, isResizingRight])

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false)
    setIsResizingRight(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Add/remove event listeners for resize
  useEffect(() => {
    if (isResizingLeft || isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizingLeft, isResizingRight, handleMouseMove, handleMouseUp])

  const selectedField = fields.find((f) => f.id === selectedFieldId)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    // Dropping from palette to canvas
    if (String(active.id).startsWith("palette-")) {
      const fieldType = active.data.current?.fieldType as FieldType
      if (fieldType) {
        addField(fieldType)
      }
      return
    }

    // Reordering existing fields
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f.id === active.id)
      const newIndex = fields.findIndex((f) => f.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        setFields(arrayMove(fields, oldIndex, newIndex))
        setIsDirty(true)
      }
    }
  }

  const addField = useCallback((fieldType: FieldType) => {
    const fieldInfo = fieldTypes.find((f) => f.type === fieldType)
    const newField: FormField = {
      id: crypto.randomUUID(),
      form_id: form.id,
      field_type: fieldType,
      label: fieldInfo?.label || "New Field",
      is_required: false,
      sort_order: fields.length,
      width: "full",
      options: ["select", "multiselect", "checkboxes", "radio"].includes(fieldType)
        ? [
            { value: "option_1", label: "Option 1" },
            { value: "option_2", label: "Option 2" },
          ]
        : undefined,
      settings: fieldType === "rating"
        ? { max_rating: 5 }
        : fieldType === "scale"
        ? { scale_min: 1, scale_max: 10 }
        : fieldType === "heading"
        ? { heading_size: "h2" }
        : undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setFields([...fields, newField])
    setSelectedFieldId(newField.id)
    setIsDirty(true)
  }, [fields, form.id])

  const updateField = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)))
    setIsDirty(true)
  }, [fields])

  const deleteField = useCallback((fieldId: string) => {
    setFields(fields.filter((f) => f.id !== fieldId))
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null)
    }
    setIsDirty(true)
  }, [fields, selectedFieldId])

  const duplicateField = useCallback((fieldId: string) => {
    const fieldToDupe = fields.find((f) => f.id === fieldId)
    if (!fieldToDupe) return

    const newField: FormField = {
      ...fieldToDupe,
      id: crypto.randomUUID(),
      label: `${fieldToDupe.label} (Copy)`,
      sort_order: fields.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setFields([...fields, newField])
    setSelectedFieldId(newField.id)
    setIsDirty(true)
  }, [fields])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave(form, fields)
      setIsDirty(false)
    } catch (error) {
      console.error("Failed to save form:", error)
      toast.error("Failed to save form")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (fields.length === 0) {
      toast.error("Add at least one field before publishing")
      return
    }

    setIsSaving(true)
    try {
      await onSave({ ...form, status: "published" }, fields)
      setForm({ ...form, status: "published" })
      setIsDirty(false)
      toast.success("Form published successfully")
    } catch (error) {
      console.error("Failed to publish form:", error)
      toast.error("Failed to publish form")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUnpublish = async () => {
    setIsSaving(true)
    try {
      await onSave({ ...form, status: "draft" }, fields)
      setForm({ ...form, status: "draft" })
      setIsDirty(false)
      toast.success("Form unpublished")
    } catch (error) {
      toast.error("Failed to unpublish form")
    } finally {
      setIsSaving(false)
    }
  }

  const copyFormLink = () => {
    const url = `${window.location.origin}/f/${form.slug}`
    navigator.clipboard.writeText(url)
    setCopiedSlug(true)
    toast.success("Form link copied!")
    setTimeout(() => setCopiedSlug(false), 2000)
  }

  const updateFormSettings = (updates: Partial<Form>) => {
    setForm({ ...form, ...updates })
    setIsDirty(true)
  }

  // Render dragging overlay
  const renderDragOverlay = () => {
    if (!activeId) return null

    if (String(activeId).startsWith("palette-")) {
      const fieldType = activeId.replace("palette-", "") as FieldType
      const fieldInfo = fieldTypes.find((f) => f.type === fieldType)
      return (
        <div className="p-4 rounded-lg bg-background border shadow-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{fieldInfo?.label}</span>
          </div>
        </div>
      )
    }

    const field = fields.find((f) => f.id === activeId)
    if (field) {
      return (
        <div className="p-4 rounded-xl bg-background border shadow-xl opacity-90">
          <FieldPreview field={field} />
        </div>
      )
    }

    return null
  }

  const tabs = [
    { id: "build" as const, label: "Build", icon: Layers },
    { id: "design" as const, label: "Design", icon: Palette },
    { id: "settings" as const, label: "Settings", icon: Settings2 },
    { id: "logic" as const, label: "Logic", icon: Zap },
    { id: "share" as const, label: "Share", icon: Share2 },
  ]

  const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form.slug}` : `/f/${form.slug}`

  const shareToTwitter = () => {
    const text = `Check out this form: ${form.name}`
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(text)}`, '_blank')
  }

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(formUrl)}`, '_blank')
  }

  const shareToLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(formUrl)}`, '_blank')
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-screen flex flex-col bg-gradient-to-br from-gray-100 via-gray-50 to-indigo-50/30">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white/90 backdrop-blur-lg sticky top-0 z-10 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Left side - Back and Title */}
              <div className="flex items-center gap-4">
                <Link
                  href={backUrl}
                  className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-600 border border-gray-200"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-3">
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value })
                      setIsDirty(true)
                    }}
                    className="text-xl font-extrabold border-0 bg-transparent px-2 h-auto py-1 focus-visible:ring-1 w-auto min-w-[250px] text-gray-900"
                    placeholder="Form Name"
                  />
                  {isDirty && (
                    <span className="text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      Unsaved
                    </span>
                  )}
                  {form.status === "published" && (
                    <span className="text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 rounded-full font-bold shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
              </div>

              {/* Center - Tabs */}
              <div className="hidden md:flex items-center bg-gray-100 rounded-2xl p-1.5 shadow-inner">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-200",
                      activeTab === tab.id
                        ? "bg-white text-indigo-600 shadow-md"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-2">
                {form.status === "published" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyFormLink}
                    className="gap-2"
                  >
                    {copiedSlug ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    Copy Link
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/f/${form.slug}`, "_blank")}
                  disabled={form.status !== "published"}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !isDirty}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>

                {form.status === "published" ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-2">
                        <Globe className="w-4 h-4" />
                        Published
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(`/f/${form.slug}`, "_blank")}>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Live Form
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyFormLink}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleUnpublish} className="text-destructive">
                        Unpublish Form
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={isSaving || fields.length === 0}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden border-b bg-background px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap",
                  activeTab === tab.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Build Tab Content */}
          {activeTab === "build" && (
            <>
              {/* Left Panel - Field Palette (Resizable & Collapsible) */}
              <div
                className={cn(
                  "border-r border-gray-200 bg-white overflow-hidden shadow-lg transition-all ease-in-out relative flex",
                  sidebarCollapsed ? "w-0" : "",
                  !isResizingLeft && "duration-300"
                )}
                style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
              >
                <div
                  className={cn(
                    "h-full overflow-y-auto transition-all duration-300 flex-1",
                    sidebarCollapsed ? "opacity-0 -translate-x-full" : "opacity-100 translate-x-0"
                  )}
                  style={{ width: sidebarWidth }}
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Layers className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-extrabold text-gray-900">Add Fields</h2>
                        <p className="text-sm text-gray-500">Click or drag</p>
                      </div>
                      <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                        title="Collapse sidebar"
                      >
                        <PanelLeftClose className="w-5 h-5" />
                      </button>
                    </div>
                    <FieldPalette onAddField={addField} />
                  </div>
                </div>
                {/* Resize Handle */}
                {!sidebarCollapsed && (
                  <div
                    className="w-1.5 hover:w-2 bg-transparent hover:bg-indigo-400 cursor-col-resize transition-all group flex items-center justify-center"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizingLeft(true)
                    }}
                  >
                    <div className="w-1 h-16 bg-gray-300 group-hover:bg-white rounded-full transition-colors" />
                  </div>
                )}
              </div>

              {/* Sidebar Toggle Button (when collapsed) */}
              {sidebarCollapsed && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white pl-3 pr-4 py-3 rounded-r-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:pl-4 group"
                  title="Show field palette"
                >
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  <span className="text-sm font-bold">Fields</span>
                </button>
              )}

              {/* Center - Canvas */}
              <div className="flex-1 overflow-y-auto p-10 relative">
                <div className="max-w-4xl mx-auto">
                  <Canvas
                    fields={fields}
                    selectedFieldId={selectedFieldId}
                    onSelectField={setSelectedFieldId}
                    onDeleteField={deleteField}
                    onDuplicateField={duplicateField}
                    formName={form.name}
                    formDescription={form.description}
                    primaryColor={form.primary_color}
                    backgroundColor={form.background_color}
                    logoUrl={form.logo_url}
                    headerImageUrl={form.header_image_url}
                  />
                </div>
              </div>

              {/* Right Panel - Field Editor (Resizable & Collapsible) */}
              {selectedField && (
                <>
                  {/* Right Panel Toggle Button (when collapsed) */}
                  {rightPanelCollapsed && (
                    <button
                      onClick={() => setRightPanelCollapsed(false)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-500 text-white pr-3 pl-4 py-3 rounded-l-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:pr-4 group"
                      title="Show field settings"
                    >
                      <span className="text-sm font-bold">Settings</span>
                      <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                  )}

                  <div
                    className={cn(
                      "border-l border-gray-200 bg-white overflow-hidden shadow-2xl transition-all ease-in-out flex",
                      rightPanelCollapsed ? "w-0" : "",
                      !isResizingRight && "duration-300"
                    )}
                    style={{ width: rightPanelCollapsed ? 0 : rightPanelWidth }}
                  >
                    {/* Resize Handle */}
                    {!rightPanelCollapsed && (
                      <div
                        className="w-1.5 hover:w-2 bg-transparent hover:bg-purple-400 cursor-col-resize transition-all group flex items-center justify-center"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setIsResizingRight(true)
                        }}
                      >
                        <div className="w-1 h-16 bg-gray-300 group-hover:bg-white rounded-full transition-colors" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "h-full overflow-y-auto transition-all duration-300 flex-1",
                        rightPanelCollapsed ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
                      )}
                    >
                      <FieldEditor
                        field={selectedField}
                        allFields={fields}
                        onUpdate={(updates) => updateField(selectedField.id, updates)}
                        onDelete={() => deleteField(selectedField.id)}
                        onClose={() => setSelectedFieldId(null)}
                        onCollapse={() => setRightPanelCollapsed(true)}
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Design Tab Content */}
          {activeTab === "design" && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6">
                <FormDesign form={form} onUpdate={updateFormSettings} />
              </div>
            </div>
          )}

          {/* Settings Tab Content */}
          {activeTab === "settings" && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6">
                <FormSettings form={form} onUpdate={updateFormSettings} />
              </div>
            </div>
          )}

          {/* Logic Tab Content */}
          {activeTab === "logic" && (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6">
                <ConditionalLogicEditor
                  fields={fields}
                  onUpdateField={updateField}
                />
              </div>
            </div>
          )}

          {/* Share Tab Content */}
          {activeTab === "share" && (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-2xl mx-auto p-8">
                {/* Share Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                    <Share2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-gray-900">Share</h1>
                      {form.status === "published" ? (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-4 h-4" />
                          Ready to share
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full">
                          Draft - Publish to share
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 mt-1">Publish your form to share it with others</p>
                  </div>
                </div>

                {/* Link Section */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Link2 className="w-5 h-5 text-gray-500" />
                    <span className="font-semibold text-gray-700">Form Link</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <span className="text-gray-700 truncate flex-1 font-medium">
                        {formUrl}
                      </span>
                      <button
                        onClick={() => window.open(formUrl, '_blank')}
                        className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        const newSlug = window.prompt('Enter new form slug:', form.slug)
                        if (newSlug && newSlug !== form.slug) {
                          updateFormSettings({ slug: newSlug })
                          toast.success('Slug updated! Remember to save.')
                        }
                      }}
                      className="gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Customize
                    </Button>

                    <Button
                      onClick={copyFormLink}
                      className="gap-2 bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      {copiedSlug ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      Copy
                    </Button>
                  </div>

                  {/* Social Share Icons */}
                  <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
                    <button
                      onClick={() => {
                        // Generate QR Code - for now just show a message
                        toast.info('QR Code feature coming soon!')
                      }}
                      className="p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                      title="Generate QR Code"
                    >
                      <QrCode className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={shareToTwitter}
                      className="p-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      title="Share on Twitter"
                    >
                      <Twitter className="w-5 h-5 text-gray-600 hover:text-blue-500" />
                    </button>
                    <button
                      onClick={shareToFacebook}
                      className="p-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      title="Share on Facebook"
                    >
                      <Facebook className="w-5 h-5 text-gray-600 hover:text-blue-600" />
                    </button>
                    <button
                      onClick={shareToLinkedIn}
                      className="p-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                      title="Share on LinkedIn"
                    >
                      <Linkedin className="w-5 h-5 text-gray-600 hover:text-blue-700" />
                    </button>
                  </div>
                </div>

                {/* Embed Section */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-lg">{'</>'}</span>
                    <span className="font-semibold text-gray-700">Embed Code</span>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">Copy this code to embed the form on your website</p>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-green-400 overflow-x-auto">
                    {`<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`}
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`)
                      toast.success('Embed code copied!')
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Embed Code
                  </Button>
                </div>

                {/* Status Warning */}
                {form.status !== "published" && (
                  <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <p className="text-sm text-orange-800">
                      <strong>Note:</strong> Your form is currently in draft mode. Publish it to make the link active and shareable.
                    </p>
                    <Button
                      onClick={handlePublish}
                      disabled={isSaving || fields.length === 0}
                      className="mt-3 bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      Publish Now
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
    </DndContext>
  )
}
