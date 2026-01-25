"use client"

import { useState, useEffect } from "react"
import { FormField, FieldOption, FieldType } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Trash2,
  Plus,
  GripVertical,
  X,
  Settings,
  Zap,
  Layout,
  PanelRightClose,
  Tag,
  Type,
  HelpCircle,
  List,
  Star,
  Sliders,
  FileText,
  Heading,
  Hash,
  Ruler,
  CheckCircle2,
  AlertCircle,
  Users,
  GitBranch,
  Eye,
  EyeOff,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldEditorProps {
  field: FormField
  allFields: FormField[]
  onUpdate: (updates: Partial<FormField>) => void
  onDelete: () => void
  onClose: () => void
  onCollapse?: () => void
}

export function FieldEditor({
  field,
  allFields,
  onUpdate,
  onDelete,
  onClose,
  onCollapse,
}: FieldEditorProps) {
  const [localOptions, setLocalOptions] = useState<FieldOption[]>(field.options || [])
  const [activeTab, setActiveTab] = useState("general")

  useEffect(() => {
    setLocalOptions(field.options || [])
  }, [field.id, field.options])

  const showOptions = ["select", "multiselect", "checkboxes", "radio"].includes(field.field_type)
  const showMinMax = ["text", "textarea", "number"].includes(field.field_type)
  const showRatingSettings = field.field_type === "rating"
  const showScaleSettings = field.field_type === "scale"
  const showFileSettings = field.field_type === "file"
  const showHeadingSettings = field.field_type === "heading"
  const showDividerSettings = field.field_type === "divider"
  const showDateSettings = ["date", "datetime"].includes(field.field_type)
  const showNumberSettings = field.field_type === "number"
  const showPhoneSettings = field.field_type === "phone"
  const showSelectSettings = ["select", "multiselect"].includes(field.field_type)
  const isLayoutField = ["heading", "paragraph", "divider"].includes(field.field_type)

  const handleAddOption = () => {
    const newOptions = [
      ...localOptions,
      { value: `option_${Date.now()}`, label: `Option ${localOptions.length + 1}` },
    ]
    setLocalOptions(newOptions)
    onUpdate({ options: newOptions })
  }

  const handleUpdateOption = (index: number, updates: Partial<FieldOption>) => {
    const newOptions = localOptions.map((opt, i) =>
      i === index ? { ...opt, ...updates } : opt
    )
    setLocalOptions(newOptions)
    onUpdate({ options: newOptions })
  }

  const handleDeleteOption = (index: number) => {
    const newOptions = localOptions.filter((_, i) => i !== index)
    setLocalOptions(newOptions)
    onUpdate({ options: newOptions })
  }

  const fieldTypeLabels: Record<string, string> = {
    text: "Text Input",
    email: "Email",
    phone: "Phone",
    number: "Number",
    textarea: "Long Text",
    select: "Dropdown",
    multiselect: "Multi-Select",
    checkbox: "Checkbox",
    checkboxes: "Checkbox Group",
    radio: "Radio Buttons",
    date: "Date",
    time: "Time",
    datetime: "Date & Time",
    file: "File Upload",
    signature: "Signature",
    rating: "Rating",
    scale: "Linear Scale",
    heading: "Heading",
    paragraph: "Paragraph",
    divider: "Divider",
  }

  const fieldTypeColors: Record<string, string> = {
    text: "from-indigo-500 to-blue-500",
    email: "from-blue-500 to-cyan-500",
    phone: "from-emerald-500 to-teal-500",
    number: "from-violet-500 to-purple-500",
    textarea: "from-pink-500 to-rose-500",
    select: "from-orange-500 to-amber-500",
    multiselect: "from-yellow-500 to-orange-500",
    checkbox: "from-green-500 to-emerald-500",
    checkboxes: "from-teal-500 to-cyan-500",
    radio: "from-blue-500 to-indigo-500",
    date: "from-orange-500 to-red-500",
    time: "from-purple-500 to-pink-500",
    datetime: "from-rose-500 to-pink-500",
    file: "from-indigo-500 to-purple-500",
    signature: "from-gray-600 to-gray-800",
    rating: "from-amber-400 to-yellow-500",
    scale: "from-cyan-500 to-blue-500",
    heading: "from-gray-700 to-gray-900",
    paragraph: "from-gray-500 to-gray-700",
    divider: "from-gray-400 to-gray-600",
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-violet-100 via-purple-100 to-fuchsia-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-xl",
              fieldTypeColors[field.field_type] || "from-indigo-500 to-purple-600"
            )}>
              <Settings className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">Field Settings</h3>
              <p className={cn(
                "text-sm font-bold mt-1 bg-gradient-to-r bg-clip-text text-transparent",
                fieldTypeColors[field.field_type] || "from-indigo-500 to-purple-600"
              )}>
                {fieldTypeLabels[field.field_type] || field.field_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="p-2.5 rounded-xl bg-white/80 hover:bg-white shadow-sm hover:shadow-md transition-all text-gray-500 hover:text-gray-700"
                title="Collapse panel"
              >
                <PanelRightClose className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-white/80 hover:bg-white shadow-sm hover:shadow-md transition-all text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6 pt-6 bg-white">
          <div className="flex gap-2 p-1.5 bg-gradient-to-r from-gray-100 to-gray-200/80 rounded-2xl">
            <button
              onClick={() => setActiveTab("general")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "general"
                  ? "bg-white shadow-lg text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Settings className="w-4 h-4" />
              General
            </button>
            {!isLayoutField && (
              <button
                onClick={() => setActiveTab("validation")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                  activeTab === "validation"
                    ? "bg-white shadow-lg text-violet-600"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Zap className="w-4 h-4" />
                Validation
              </button>
            )}
            <button
              onClick={() => setActiveTab("layout")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "layout"
                  ? "bg-white shadow-lg text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Layout className="w-4 h-4" />
              Layout
            </button>
            <button
              onClick={() => setActiveTab("logic")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "logic"
                  ? "bg-white shadow-lg text-violet-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <GitBranch className="w-4 h-4" />
              Logic
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Field Label */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-white" />
                  </div>
                  <Label className="text-sm font-bold text-gray-800">Field Label</Label>
                </div>

                {/* Rich Text Toolbar */}
                <div className="flex items-center gap-1 p-2 bg-gray-800 rounded-xl">
                  {/* Text Style */}
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_bold: !field.settings?.label_bold } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      field.settings?.label_bold ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_italic: !field.settings?.label_italic } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      field.settings?.label_italic ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Italic"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_underline: !field.settings?.label_underline } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      field.settings?.label_underline ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Underline"
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  <div className="w-px h-6 bg-gray-600 mx-1" />

                  {/* Text Color */}
                  <div className="relative">
                    <input
                      type="color"
                      value={field.settings?.label_color || "#1f2937"}
                      onChange={(e) => onUpdate({ settings: { ...field.settings, label_color: e.target.value } })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8"
                      title="Text Color"
                    />
                    <div className="p-2 rounded-lg text-gray-300 hover:bg-gray-700 flex items-center gap-1">
                      <span className="font-bold text-sm" style={{ color: field.settings?.label_color || "#1f2937" }}>A</span>
                      <div className="w-4 h-1 rounded" style={{ backgroundColor: field.settings?.label_color || "#1f2937" }} />
                    </div>
                  </div>

                  <div className="w-px h-6 bg-gray-600 mx-1" />

                  {/* Alignment */}
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_alignment: "left" } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      (!field.settings?.label_alignment || field.settings?.label_alignment === "left") ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Align Left"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_alignment: "center" } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      field.settings?.label_alignment === "center" ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Align Center"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUpdate({ settings: { ...field.settings, label_alignment: "right" } })}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      field.settings?.label_alignment === "right" ? "bg-violet-500 text-white" : "text-gray-300 hover:bg-gray-700"
                    )}
                    title="Align Right"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Label Input with Preview */}
                <Input
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  placeholder="Enter field label"
                  className="h-14 bg-white border-2 border-violet-200 rounded-2xl focus:border-violet-500 focus:ring-4 focus:ring-violet-100 text-lg font-medium text-gray-800 placeholder:text-gray-400 shadow-sm"
                  style={{
                    fontWeight: field.settings?.label_bold ? "bold" : "normal",
                    fontStyle: field.settings?.label_italic ? "italic" : "normal",
                    textDecoration: field.settings?.label_underline ? "underline" : "none",
                    color: field.settings?.label_color || "#1f2937",
                    textAlign: field.settings?.label_alignment || "left"
                  }}
                />
              </div>

              {!isLayoutField && (
                <>
                  {/* Placeholder */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Type className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-sm font-bold text-gray-800">Placeholder Text</Label>
                    </div>
                    <Input
                      value={field.placeholder || ""}
                      onChange={(e) => onUpdate({ placeholder: e.target.value })}
                      placeholder="Enter placeholder text"
                      className="h-14 bg-white border-2 border-blue-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-lg font-medium text-gray-800 placeholder:text-gray-400 shadow-sm"
                    />
                  </div>

                  {/* Help Text */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <HelpCircle className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-sm font-bold text-gray-800">Help Text</Label>
                    </div>
                    <Textarea
                      value={field.help_text || ""}
                      onChange={(e) => onUpdate({ help_text: e.target.value })}
                      placeholder="Additional instructions for users"
                      rows={3}
                      className="bg-white border-2 border-emerald-200 rounded-2xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 text-base font-medium text-gray-800 placeholder:text-gray-400 shadow-sm resize-none"
                    />
                  </div>

                  {/* Member Lookup - Only for email fields */}
                  {field.field_type === "email" && (
                    <div className="space-y-4 p-5 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <Label className="text-base font-bold text-gray-800">Member Lookup</Label>
                            <p className="text-sm text-gray-500">Auto-fill from membership database</p>
                          </div>
                        </div>
                        <Switch
                          checked={field.settings?.member_lookup || false}
                          onCheckedChange={(checked) => onUpdate({ settings: { ...field.settings, member_lookup: checked } })}
                          className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-cyan-500 data-[state=checked]:to-blue-600"
                        />
                      </div>
                      {field.settings?.member_lookup && (
                        <div className="mt-3 p-3 bg-cyan-100 rounded-xl">
                          <p className="text-xs text-cyan-800 font-medium">
                            When email is verified, member details (name, phone, etc.) will be auto-filled from the membership database.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phone Settings - Default Country & Verification */}
                  {field.field_type === "phone" && (
                    <>
                      {/* Default Country */}
                      <div className="space-y-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">🌍</span>
                            </div>
                            <div>
                              <Label className="text-base font-bold text-gray-800">Default Country</Label>
                              <p className="text-sm text-gray-500">Pre-select country code</p>
                            </div>
                          </div>
                          <Switch
                            checked={field.settings?.show_country || false}
                            onCheckedChange={(checked) => onUpdate({ settings: { ...field.settings, show_country: checked } })}
                            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-teal-600"
                          />
                        </div>
                        {field.settings?.show_country && (
                          <div className="mt-3">
                            <Label className="text-sm font-bold text-gray-700 mb-2 block">Country</Label>
                            <Select
                              value={field.settings?.default_country || "IN"}
                              onValueChange={(value) => onUpdate({ settings: { ...field.settings, default_country: value } })}
                            >
                              <SelectTrigger className="h-12 bg-white border-2 border-emerald-200 rounded-xl">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="IN">🇮🇳 India (+91)</SelectItem>
                                <SelectItem value="US">🇺🇸 United States (+1)</SelectItem>
                                <SelectItem value="GB">🇬🇧 United Kingdom (+44)</SelectItem>
                                <SelectItem value="AE">🇦🇪 UAE (+971)</SelectItem>
                                <SelectItem value="SG">🇸🇬 Singapore (+65)</SelectItem>
                                <SelectItem value="AU">🇦🇺 Australia (+61)</SelectItem>
                                <SelectItem value="CA">🇨🇦 Canada (+1)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Phone Verification */}
                      <div className="space-y-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <Label className="text-base font-bold text-gray-800">Phone Verification</Label>
                              <p className="text-sm text-gray-500">Send OTP to verify phone</p>
                            </div>
                          </div>
                          <Switch
                            checked={field.settings?.phone_verification || false}
                            onCheckedChange={(checked) => onUpdate({ settings: { ...field.settings, phone_verification: checked } })}
                            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-purple-600"
                          />
                        </div>
                        {field.settings?.phone_verification && (
                          <div className="mt-3 p-3 bg-violet-100 rounded-xl">
                            <p className="text-xs text-violet-800 font-medium">
                              Users will receive an OTP via SMS to verify their phone number before submission.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Options for choice fields */}
              {showOptions && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                        <List className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-sm font-bold text-gray-800">Options</Label>
                    </div>
                    <Button
                      onClick={handleAddOption}
                      className="h-10 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-3 p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border-2 border-orange-200">
                    {localOptions.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-white p-4 rounded-xl border-2 border-orange-100 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 text-white font-bold text-sm shadow-md">
                          {index + 1}
                        </div>
                        <Input
                          value={option.label}
                          onChange={(e) =>
                            handleUpdateOption(index, {
                              label: e.target.value,
                              value: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                            })
                          }
                          placeholder="Option label"
                          className="flex-1 h-12 bg-white border-2 border-orange-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-base font-medium text-gray-800"
                        />
                        <button
                          onClick={() => handleDeleteOption(index)}
                          disabled={localOptions.length <= 1}
                          className={cn(
                            "p-3 rounded-xl transition-all",
                            localOptions.length <= 1
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-red-500 hover:bg-red-50 hover:text-red-600"
                          )}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rating settings */}
              {showRatingSettings && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center">
                      <Star className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">Max Stars</Label>
                  </div>
                  <div className="grid grid-cols-6 gap-2 p-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200">
                    {[3, 4, 5, 6, 7, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => onUpdate({ settings: { ...field.settings, max_rating: n } })}
                        className={cn(
                          "py-3 rounded-xl font-bold text-lg transition-all",
                          field.settings?.max_rating === n || (!field.settings?.max_rating && n === 5)
                            ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg"
                            : "bg-white border-2 border-amber-200 text-gray-600 hover:border-amber-400"
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scale settings */}
              {showScaleSettings && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl border-2 border-cyan-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <Sliders className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">Scale Settings</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-600">Min Value</Label>
                      <Input
                        type="number"
                        value={field.settings?.scale_min ?? 1}
                        onChange={(e) => onUpdate({ settings: { ...field.settings, scale_min: Number(e.target.value) } })}
                        className="h-12 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 text-gray-800 font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-600">Max Value</Label>
                      <Input
                        type="number"
                        value={field.settings?.scale_max ?? 10}
                        onChange={(e) => onUpdate({ settings: { ...field.settings, scale_max: Number(e.target.value) } })}
                        className="h-12 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 text-gray-800 font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-600">Min Label</Label>
                    <Input
                      value={field.settings?.scale_min_label || ""}
                      onChange={(e) => onUpdate({ settings: { ...field.settings, scale_min_label: e.target.value } })}
                      placeholder="e.g., Not satisfied"
                      className="h-12 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 text-gray-800 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-600">Max Label</Label>
                    <Input
                      value={field.settings?.scale_max_label || ""}
                      onChange={(e) => onUpdate({ settings: { ...field.settings, scale_max_label: e.target.value } })}
                      placeholder="e.g., Very satisfied"
                      className="h-12 bg-white border-2 border-cyan-200 rounded-xl focus:border-cyan-500 text-gray-800 font-medium"
                    />
                  </div>
                </div>
              )}

              {/* File settings */}
              {showFileSettings && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-indigo-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">File Settings</Label>
                  </div>

                  {/* Allow Multiple Files */}
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border-2 border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <Label className="text-sm font-bold text-gray-800">Allow Multiple Files</Label>
                        <p className="text-xs text-gray-500">Let users upload more than one file</p>
                      </div>
                    </div>
                    <Switch
                      checked={field.settings?.allow_multiple || false}
                      onCheckedChange={(checked) => onUpdate({ settings: { ...field.settings, allow_multiple: checked } })}
                      className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
                    />
                  </div>

                  {/* Max Files (only show if multiple is enabled) */}
                  {field.settings?.allow_multiple && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-600">Max Number of Files</Label>
                      <Input
                        type="number"
                        value={field.settings?.max_files ?? 5}
                        onChange={(e) => onUpdate({ settings: { ...field.settings, max_files: Number(e.target.value) } })}
                        min={1}
                        max={20}
                        className="h-12 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 text-gray-800 font-medium"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-600">Max File Size (MB)</Label>
                    <Input
                      type="number"
                      value={field.settings?.max_file_size ?? 10}
                      onChange={(e) => onUpdate({ settings: { ...field.settings, max_file_size: Number(e.target.value) } })}
                      className="h-12 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 text-gray-800 font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-gray-600">Allowed File Types</Label>
                    <Input
                      value={field.settings?.allowed_file_types?.join(", ") || ""}
                      onChange={(e) => onUpdate({
                        settings: {
                          ...field.settings,
                          allowed_file_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        },
                      })}
                      placeholder="pdf, doc, jpg, png"
                      className="h-12 bg-white border-2 border-indigo-200 rounded-xl focus:border-indigo-500 text-gray-800 font-medium"
                    />
                    <p className="text-xs text-gray-500">Leave empty to allow all file types</p>
                  </div>
                </div>
              )}

              {/* Heading settings */}
              {showHeadingSettings && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <Heading className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">Heading Size</Label>
                  </div>
                  <div className="grid grid-cols-3 gap-3 p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-gray-200">
                    {[
                      { value: "h1", label: "Large", size: "text-2xl" },
                      { value: "h2", label: "Medium", size: "text-xl" },
                      { value: "h3", label: "Small", size: "text-lg" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onUpdate({ settings: { ...field.settings, heading_size: opt.value as any } })}
                        className={cn(
                          "py-4 rounded-xl font-bold transition-all",
                          field.settings?.heading_size === opt.value || (!field.settings?.heading_size && opt.value === "h2")
                            ? "bg-gradient-to-br from-gray-700 to-gray-900 text-white shadow-lg"
                            : "bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-400"
                        )}
                      >
                        <span className={opt.size}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider settings */}
              {showDividerSettings && (
                <div className="space-y-5 p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-gray-200">
                  {/* Divider Color */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                        <Minus className="w-4 h-4 text-white" />
                      </div>
                      <Label className="text-sm font-bold text-gray-800">Divider Color</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "#e5e7eb", name: "Gray" },
                        { value: "#8B5CF6", name: "Purple" },
                        { value: "#3B82F6", name: "Blue" },
                        { value: "#10B981", name: "Green" },
                        { value: "#F59E0B", name: "Amber" },
                        { value: "#EF4444", name: "Red" },
                        { value: "#EC4899", name: "Pink" },
                        { value: "#1f2937", name: "Dark" },
                      ].map((color) => (
                        <button
                          key={color.value}
                          onClick={() => onUpdate({ settings: { ...field.settings, divider_color: color.value } })}
                          className={cn(
                            "w-10 h-10 rounded-xl transition-all shadow-md hover:scale-110",
                            (field.settings?.divider_color === color.value || (!field.settings?.divider_color && color.value === "#e5e7eb"))
                              && "ring-2 ring-offset-2 ring-gray-800 scale-110"
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <Input
                      type="color"
                      value={field.settings?.divider_color || "#e5e7eb"}
                      onChange={(e) => onUpdate({ settings: { ...field.settings, divider_color: e.target.value } })}
                      className="h-10 w-full rounded-xl cursor-pointer"
                    />
                  </div>

                  {/* Divider Style */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-800">Style</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "solid", label: "Solid" },
                        { value: "dashed", label: "Dashed" },
                        { value: "dotted", label: "Dotted" },
                      ].map((style) => (
                        <button
                          key={style.value}
                          onClick={() => onUpdate({ settings: { ...field.settings, divider_style: style.value as any } })}
                          className={cn(
                            "py-3 rounded-xl font-semibold transition-all text-sm",
                            (field.settings?.divider_style === style.value || (!field.settings?.divider_style && style.value === "solid"))
                              ? "bg-gray-800 text-white shadow-lg"
                              : "bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-400"
                          )}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Divider Thickness */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-gray-800">Thickness</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "thin", label: "Thin", height: "1px" },
                        { value: "medium", label: "Medium", height: "2px" },
                        { value: "thick", label: "Thick", height: "4px" },
                      ].map((thickness) => (
                        <button
                          key={thickness.value}
                          onClick={() => onUpdate({ settings: { ...field.settings, divider_thickness: thickness.value as any } })}
                          className={cn(
                            "py-3 rounded-xl font-semibold transition-all text-sm flex flex-col items-center gap-2",
                            (field.settings?.divider_thickness === thickness.value || (!field.settings?.divider_thickness && thickness.value === "thin"))
                              ? "bg-gray-800 text-white shadow-lg"
                              : "bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-400"
                          )}
                        >
                          <div
                            className="w-12 rounded-full"
                            style={{
                              height: thickness.height,
                              backgroundColor: field.settings?.divider_thickness === thickness.value || (!field.settings?.divider_thickness && thickness.value === "thin")
                                ? "white"
                                : "#6b7280"
                            }}
                          />
                          {thickness.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation Tab */}
          {activeTab === "validation" && !isLayoutField && (
            <div className="space-y-6">
              {/* Required toggle */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-base font-bold text-gray-800">Required Field</Label>
                    <p className="text-sm text-gray-500">User must fill this field</p>
                  </div>
                </div>
                <Switch
                  checked={field.is_required}
                  onCheckedChange={(checked) => onUpdate({ is_required: checked })}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-purple-600"
                />
              </div>

              {/* Min/Max for text and number fields */}
              {showMinMax && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                      <Ruler className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">
                      {field.field_type === "number" ? "Value Limits" : "Length Limits"}
                    </Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-600">
                        {field.field_type === "number" ? "Min Value" : "Min Length"}
                      </Label>
                      <Input
                        type="number"
                        value={field.field_type === "number" ? (field.min_value ?? "") : (field.min_length ?? "")}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined
                          onUpdate(field.field_type === "number" ? { min_value: val } : { min_length: val })
                        }}
                        placeholder="No min"
                        className="h-12 bg-white border-2 border-blue-200 rounded-xl focus:border-blue-500 text-gray-800 font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-600">
                        {field.field_type === "number" ? "Max Value" : "Max Length"}
                      </Label>
                      <Input
                        type="number"
                        value={field.field_type === "number" ? (field.max_value ?? "") : (field.max_length ?? "")}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : undefined
                          onUpdate(field.field_type === "number" ? { max_value: val } : { max_length: val })
                        }}
                        placeholder="No max"
                        className="h-12 bg-white border-2 border-blue-200 rounded-xl focus:border-blue-500 text-gray-800 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pattern/Regex */}
              {["text", "email", "phone"].includes(field.field_type) && (
                <div className="space-y-3 p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Hash className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">Validation Pattern (Regex)</Label>
                  </div>
                  <Input
                    value={field.pattern || ""}
                    onChange={(e) => onUpdate({ pattern: e.target.value })}
                    placeholder="e.g., ^[A-Za-z]+$"
                    className="h-12 bg-white border-2 border-amber-200 rounded-xl focus:border-amber-500 text-gray-800 font-medium font-mono"
                  />
                  <p className="text-xs text-amber-700 bg-amber-100 px-3 py-2 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Advanced: Use a regular expression pattern
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Layout Tab */}
          {activeTab === "layout" && (
            <div className="space-y-6">
              {/* Field Width */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                    <Layout className="w-4 h-4 text-white" />
                  </div>
                  <Label className="text-sm font-bold text-gray-800">Field Width</Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "full", label: "Full", width: "100%" },
                    { value: "half", label: "Half", width: "50%" },
                    { value: "third", label: "Third", width: "33%" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdate({ width: opt.value as any })}
                      className={cn(
                        "p-4 rounded-2xl font-bold transition-all text-center",
                        field.width === opt.value
                          ? "bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg"
                          : "bg-white border-2 border-gray-200 text-gray-600 hover:border-pink-300"
                      )}
                    >
                      <span className="text-base">{opt.label}</span>
                      <span className="block text-xs mt-1 opacity-80">{opt.width}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Width Preview */}
              <div className="space-y-3 p-5 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-gray-200">
                <Label className="text-sm font-bold text-gray-800">Width Preview</Label>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full bg-gradient-to-r from-pink-500 to-rose-600 rounded-full transition-all duration-300",
                      field.width === "full" && "w-full",
                      field.width === "half" && "w-1/2",
                      field.width === "third" && "w-1/3"
                    )}
                  />
                </div>
              </div>

              {/* Label Alignment */}
              <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                    <Type className="w-4 h-4 text-white" />
                  </div>
                  <Label className="text-sm font-bold text-gray-800">Label Position</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "top" as const, label: "Top" },
                    { value: "left" as const, label: "Left (Inline)" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdate({ settings: { ...field.settings, label_position: opt.value } })}
                      className={cn(
                        "p-3 rounded-xl font-bold transition-all text-center text-sm",
                        (field.settings?.label_position || "top") === opt.value
                          ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg"
                          : "bg-white border-2 border-indigo-200 text-gray-600 hover:border-indigo-400"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-4 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Ruler className="w-4 h-4 text-white" />
                  </div>
                  <Label className="text-sm font-bold text-gray-800">Spacing</Label>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: "compact" as const, label: "Compact" },
                    { value: "normal" as const, label: "Normal" },
                    { value: "relaxed" as const, label: "Relaxed" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdate({ settings: { ...field.settings, spacing: opt.value } })}
                      className={cn(
                        "p-3 rounded-xl font-bold transition-all text-center text-sm",
                        (field.settings?.spacing || "normal") === opt.value
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg"
                          : "bg-white border-2 border-emerald-200 text-gray-600 hover:border-emerald-400"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hide Label Toggle */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-base font-bold text-gray-800">Hide Label</Label>
                    <p className="text-sm text-gray-500">Show only the input field</p>
                  </div>
                </div>
                <Switch
                  checked={field.settings?.hide_label || false}
                  onCheckedChange={(checked) => onUpdate({ settings: { ...field.settings, hide_label: checked } })}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-600"
                />
              </div>

              {/* Description Position */}
              {!isLayoutField && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4 text-white" />
                    </div>
                    <Label className="text-sm font-bold text-gray-800">Help Text Position</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { value: "below" as const, label: "Below Field" },
                      { value: "tooltip" as const, label: "Tooltip" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onUpdate({ settings: { ...field.settings, help_position: opt.value } })}
                        className={cn(
                          "p-3 rounded-xl font-bold transition-all text-center text-sm",
                          (field.settings?.help_position || "below") === opt.value
                            ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"
                            : "bg-white border-2 border-violet-200 text-gray-600 hover:border-violet-400"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logic Tab - Conditional Logic */}
          {activeTab === "logic" && (
            <div className="space-y-6">
              {/* Enable Conditional Logic */}
              <div className="flex items-center justify-between p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <Label className="text-base font-bold text-gray-800">Conditional Logic</Label>
                    <p className="text-sm text-gray-500">Show/hide based on other fields</p>
                  </div>
                </div>
                <Switch
                  checked={!!field.conditional_logic}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onUpdate({
                        conditional_logic: {
                          action: "show",
                          logic: "all",
                          rules: [{ field_id: "", operator: "equals", value: "" }]
                        }
                      })
                    } else {
                      onUpdate({ conditional_logic: undefined })
                    }
                  }}
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-600"
                />
              </div>

              {field.conditional_logic && (
                <>
                  {/* Action Selector */}
                  <div className="space-y-3 p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                        {field.conditional_logic.action === "show" ? (
                          <Eye className="w-4 h-4 text-white" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <Label className="text-sm font-bold text-gray-800">Action</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "show", label: "Show", icon: Eye },
                        { value: "hide", label: "Hide", icon: EyeOff },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onUpdate({
                            conditional_logic: { ...field.conditional_logic!, action: opt.value as "show" | "hide" }
                          })}
                          className={cn(
                            "p-4 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2",
                            field.conditional_logic?.action === opt.value
                              ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg"
                              : "bg-white border-2 border-indigo-200 text-gray-600 hover:border-indigo-400"
                          )}
                        >
                          <opt.icon className="w-4 h-4" />
                          {opt.label} this field
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Logic Type */}
                  <div className="space-y-3 p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200">
                    <Label className="text-sm font-bold text-gray-800">When</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "all", label: "ALL rules match" },
                        { value: "any", label: "ANY rule matches" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => onUpdate({
                            conditional_logic: { ...field.conditional_logic!, logic: opt.value as "all" | "any" }
                          })}
                          className={cn(
                            "p-3 rounded-xl font-bold transition-all text-center text-sm",
                            field.conditional_logic?.logic === opt.value
                              ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg"
                              : "bg-white border-2 border-emerald-200 text-gray-600 hover:border-emerald-400"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Rules */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <Label className="text-sm font-bold text-gray-800">Rules</Label>
                      </div>
                      <Button
                        onClick={() => {
                          const newRules = [...(field.conditional_logic?.rules || []), { field_id: "", operator: "equals" as const, value: "" }]
                          onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                        }}
                        className="h-9 px-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-md"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Rule
                      </Button>
                    </div>

                    {field.conditional_logic?.rules?.map((rule, ruleIndex) => (
                      <div key={ruleIndex} className="p-4 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-gray-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500 uppercase">Rule {ruleIndex + 1}</span>
                          {(field.conditional_logic?.rules?.length || 0) > 1 && (
                            <button
                              onClick={() => {
                                const newRules = field.conditional_logic?.rules?.filter((_, i) => i !== ruleIndex) || []
                                onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                              }}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Field Selector */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-600">If this field</Label>
                          <Select
                            value={rule.field_id}
                            onValueChange={(value) => {
                              const newRules = [...(field.conditional_logic?.rules || [])]
                              newRules[ruleIndex] = { ...newRules[ruleIndex], field_id: value }
                              onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                            }}
                          >
                            <SelectTrigger className="h-12 bg-white border-2 border-gray-200 rounded-xl">
                              <SelectValue placeholder="Select a field..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allFields
                                .filter(f => f.id !== field.id && !["heading", "paragraph", "divider"].includes(f.field_type))
                                .map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Operator */}
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-600">Condition</Label>
                          <Select
                            value={rule.operator}
                            onValueChange={(value) => {
                              const newRules = [...(field.conditional_logic?.rules || [])]
                              newRules[ruleIndex] = { ...newRules[ruleIndex], operator: value as any }
                              onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                            }}
                          >
                            <SelectTrigger className="h-12 bg-white border-2 border-gray-200 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Does not equal</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="not_contains">Does not contain</SelectItem>
                              <SelectItem value="is_empty">Is empty</SelectItem>
                              <SelectItem value="is_not_empty">Is not empty</SelectItem>
                              <SelectItem value="greater_than">Greater than</SelectItem>
                              <SelectItem value="less_than">Less than</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Value - only show if operator needs a value */}
                        {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-gray-600">Value</Label>
                            {(() => {
                              const targetField = allFields.find(f => f.id === rule.field_id)
                              if (targetField?.options && targetField.options.length > 0) {
                                return (
                                  <Select
                                    value={rule.value as string}
                                    onValueChange={(value) => {
                                      const newRules = [...(field.conditional_logic?.rules || [])]
                                      newRules[ruleIndex] = { ...newRules[ruleIndex], value }
                                      onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                                    }}
                                  >
                                    <SelectTrigger className="h-12 bg-white border-2 border-gray-200 rounded-xl">
                                      <SelectValue placeholder="Select value..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {targetField.options.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )
                              }
                              return (
                                <Input
                                  value={rule.value as string || ""}
                                  onChange={(e) => {
                                    const newRules = [...(field.conditional_logic?.rules || [])]
                                    newRules[ruleIndex] = { ...newRules[ruleIndex], value: e.target.value }
                                    onUpdate({ conditional_logic: { ...field.conditional_logic!, rules: newRules } })
                                  }}
                                  placeholder="Enter value..."
                                  className="h-12 bg-white border-2 border-gray-200 rounded-xl"
                                />
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl border-2 border-blue-200">
                    <p className="text-sm font-bold text-blue-800 flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Preview:
                    </p>
                    <p className="text-sm text-blue-700 mt-2">
                      {field.conditional_logic?.action === "show" ? "Show" : "Hide"} &quot;{field.label}&quot; when{" "}
                      {field.conditional_logic?.logic === "all" ? "ALL" : "ANY"} of these conditions are met:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {field.conditional_logic?.rules?.map((rule, i) => {
                        const targetField = allFields.find(f => f.id === rule.field_id)
                        return (
                          <li key={i} className="text-xs text-blue-600 bg-white/50 px-3 py-1.5 rounded-lg">
                            &quot;{targetField?.label || "Select field"}&quot; {rule.operator.replace("_", " ")} &quot;{rule.value || "..."}&quot;
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Tabs>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gradient-to-r from-red-50 to-rose-50">
        <Button
          onClick={onDelete}
          className="w-full h-14 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all"
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Delete Field
        </Button>
      </div>
    </div>
  )
}
