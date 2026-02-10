"use client"

import { FormField } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Star, Upload, Mail, Phone, Hash, Calendar, Clock, FileText, PenLine, Type } from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldPreviewProps {
  field: FormField
  disabled?: boolean
}

// Field type icon mapping
const _fieldIcons: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  number: <Hash className="w-4 h-4" />,
  date: <Calendar className="w-4 h-4" />,
  time: <Clock className="w-4 h-4" />,
  datetime: <Calendar className="w-4 h-4" />,
  file: <FileText className="w-4 h-4" />,
  signature: <PenLine className="w-4 h-4" />,
}

export function FieldPreview({ field, disabled = true }: FieldPreviewProps) {
  const renderField = () => {
    switch (field.field_type) {
      case "text":
        return (
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2">
              <Type className="w-6 h-6 text-indigo-400" />
            </div>
            <Input
              type="text"
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              disabled={disabled}
              className="pointer-events-none h-14 pl-14 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder:text-gray-400 text-lg font-medium shadow-md hover:shadow-lg transition-shadow"
            />
          </div>
        )

      case "email":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <Input
              type="email"
              placeholder={field.placeholder || "your@email.com"}
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-indigo-50/50 border-2 border-indigo-200 rounded-2xl text-gray-800 placeholder:text-gray-400 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "phone":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <Input
              type="tel"
              placeholder={field.placeholder || "+91 XXXXX XXXXX"}
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-emerald-50/50 border-2 border-emerald-200 rounded-2xl text-gray-800 placeholder:text-gray-400 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "number":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <Input
              type="number"
              placeholder={field.placeholder || "0"}
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-violet-50/50 border-2 border-violet-200 rounded-2xl text-gray-800 placeholder:text-gray-400 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "textarea":
        return (
          <Textarea
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            disabled={disabled}
            rows={4}
            className="pointer-events-none resize-none bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-2xl text-gray-800 placeholder:text-gray-400 text-lg font-medium shadow-md min-h-[140px] p-5"
          />
        )

      case "select":
        return (
          <Select disabled={disabled}>
            <SelectTrigger className="pointer-events-none h-14 bg-gradient-to-r from-white to-orange-50/50 border-2 border-orange-200 rounded-2xl text-gray-800 text-lg font-medium shadow-md">
              <SelectValue placeholder={field.placeholder || "Select an option..."} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case "multiselect":
        return (
          <div className="space-y-3 p-6 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/50 to-cyan-50/50 shadow-md">
            {field.options?.length ? field.options.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-teal-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {idx + 1}
                </div>
                <Checkbox
                  id={opt.value}
                  disabled={disabled}
                  className="w-6 h-6 border-2 border-teal-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 rounded-lg"
                />
                <Label htmlFor={opt.value} className="text-lg font-semibold text-gray-800 cursor-pointer flex-1">
                  {opt.label}
                </Label>
              </div>
            )) : (
              <p className="text-lg text-gray-400 text-center py-4 font-medium">No options defined yet</p>
            )}
          </div>
        )

      case "checkbox":
        return (
          <div className="flex items-center gap-5 p-5 rounded-2xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 shadow-md">
            <Checkbox
              id={field.id}
              disabled={disabled}
              className="w-7 h-7 border-2 border-green-400 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 rounded-lg"
            />
            <Label htmlFor={field.id} className="text-lg font-semibold text-gray-800 cursor-pointer">
              {field.placeholder || field.label}
            </Label>
          </div>
        )

      case "checkboxes":
        return (
          <div className="space-y-3 p-6 rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-md">
            {field.options?.length ? field.options.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {idx + 1}
                </div>
                <Checkbox
                  id={opt.value}
                  disabled={disabled}
                  className="w-6 h-6 border-2 border-blue-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded-lg"
                />
                <Label htmlFor={opt.value} className="text-lg font-semibold text-gray-800 cursor-pointer flex-1">
                  {opt.label}
                </Label>
              </div>
            )) : (
              <p className="text-lg text-gray-400 text-center py-4 font-medium">No options defined yet</p>
            )}
          </div>
        )

      case "radio":
        return (
          <RadioGroup disabled={disabled} className="space-y-3 p-6 rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-pink-50/50 shadow-md">
            {field.options?.length ? field.options.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {idx + 1}
                </div>
                <RadioGroupItem
                  value={opt.value}
                  id={opt.value}
                  className="w-6 h-6 border-2 border-purple-300 text-purple-600"
                />
                <Label htmlFor={opt.value} className="text-lg font-semibold text-gray-800 cursor-pointer flex-1">
                  {opt.label}
                </Label>
              </div>
            )) : (
              <p className="text-lg text-gray-400 text-center py-4 font-medium">No options defined yet</p>
            )}
          </RadioGroup>
        )

      case "date":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <Input
              type="date"
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-orange-50/50 border-2 border-orange-200 rounded-2xl text-gray-800 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "time":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-md">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <Input
              type="time"
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-purple-50/50 border-2 border-purple-200 rounded-2xl text-gray-800 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "datetime":
        return (
          <div className="relative">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-md">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <Input
              type="datetime-local"
              disabled={disabled}
              className="pointer-events-none h-14 pl-20 bg-gradient-to-r from-white to-pink-50/50 border-2 border-pink-200 rounded-2xl text-gray-800 text-lg font-medium shadow-md"
            />
          </div>
        )

      case "file":
        return (
          <div className="border-3 border-dashed border-indigo-300 rounded-2xl p-10 text-center bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 transition-all cursor-pointer">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <p className="text-lg font-semibold text-gray-800 mb-1">
              Click to upload or drag & drop
            </p>
            <p className="text-sm text-gray-500">
              {field.settings?.allowed_file_types
                ? field.settings.allowed_file_types.join(", ").toUpperCase()
                : "PDF, PNG, JPG up to 10MB"}
            </p>
          </div>
        )

      case "signature":
        return (
          <div className="border-3 border-dashed border-gray-300 rounded-2xl p-12 text-center bg-gradient-to-br from-gray-50 to-slate-50">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
              <PenLine className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-lg font-semibold text-gray-700 mb-1">
              Draw your signature
            </p>
            <p className="text-sm text-gray-400">Click and drag to sign</p>
          </div>
        )

      case "rating":
        const maxRating = field.settings?.max_rating || 5
        return (
          <div className="flex gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
            {[...Array(maxRating)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-10 h-10 transition-all cursor-pointer drop-shadow-sm",
                  i < 0 ? "fill-amber-400 text-amber-400" : "text-amber-300 hover:text-amber-400 hover:scale-110"
                )}
              />
            ))}
          </div>
        )

      case "scale":
        const min = field.settings?.scale_min ?? 1
        const max = field.settings?.scale_max ?? 10
        return (
          <div className="space-y-4 p-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
            <div className="flex justify-between text-sm font-bold text-gray-600">
              <span className="px-3 py-1 bg-white rounded-full shadow-sm">{field.settings?.scale_min_label || `${min} - Low`}</span>
              <span className="px-3 py-1 bg-white rounded-full shadow-sm">{field.settings?.scale_max_label || `${max} - High`}</span>
            </div>
            <div className="flex gap-2">
              {[...Array(max - min + 1)].map((_, i) => (
                <button
                  key={i}
                  disabled={disabled}
                  className="flex-1 py-3 text-base font-bold rounded-xl border-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:scale-105 transition-all pointer-events-none shadow-sm"
                >
                  {min + i}
                </button>
              ))}
            </div>
          </div>
        )

      case "heading":
        const HeadingTag = (field.settings?.heading_size || "h2") as keyof JSX.IntrinsicElements
        const headingClasses = {
          h1: "text-3xl font-extrabold text-gray-900 tracking-tight",
          h2: "text-2xl font-bold text-gray-800",
          h3: "text-xl font-semibold text-gray-700",
        }
        const headingStyle: React.CSSProperties = {
          fontWeight: field.settings?.label_bold ? 800 : undefined,
          fontStyle: field.settings?.label_italic ? "italic" : "normal",
          textDecoration: field.settings?.label_underline ? "underline" : "none",
          color: field.settings?.label_color || undefined,
          textAlign: field.settings?.label_alignment || "left",
        }
        return (
          <HeadingTag className={cn(headingClasses[field.settings?.heading_size || "h2"], "py-2")} style={headingStyle}>
            {field.label}
          </HeadingTag>
        )

      case "paragraph":
        return (
          <p className="text-gray-600 leading-relaxed text-base py-1">{field.label}</p>
        )

      case "divider":
        const dividerColor = field.settings?.divider_color || "#e5e7eb"
        const dividerStyle = field.settings?.divider_style || "solid"
        const dividerThickness = field.settings?.divider_thickness || "thin"
        const thicknessMap: Record<string, string> = { thin: "1px", medium: "2px", thick: "4px" }

        return (
          <div className="py-6">
            <div
              className="w-full rounded-full"
              style={{
                height: thicknessMap[dividerThickness],
                backgroundColor: dividerStyle === "solid" ? dividerColor : "transparent",
                borderStyle: dividerStyle === "solid" ? "none" : dividerStyle,
                borderWidth: dividerStyle !== "solid" ? thicknessMap[dividerThickness] : 0,
                borderColor: dividerColor
              }}
            />
          </div>
        )

      default:
        return (
          <Input
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            disabled={disabled}
            className="pointer-events-none h-12 bg-white border-2 border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 text-base font-medium shadow-sm"
          />
        )
    }
  }

  // Don't show label for layout elements
  if (["heading", "paragraph", "divider"].includes(field.field_type)) {
    return <div>{renderField()}</div>
  }

  // Label styling from settings
  const labelStyle: React.CSSProperties = {
    fontWeight: field.settings?.label_bold ? 800 : 700,
    fontStyle: field.settings?.label_italic ? "italic" : "normal",
    textDecoration: field.settings?.label_underline ? "underline" : "none",
    color: field.settings?.label_color || "#111827",
    textAlign: field.settings?.label_alignment || "left",
    display: "block",
    width: "100%"
  }

  return (
    <div className={cn("space-y-4", field.width === "half" && "max-w-[50%]", field.width === "third" && "max-w-[33%]")}>
      <Label
        className="text-lg font-extrabold text-gray-900 flex items-center gap-3 tracking-tight"
        style={{ textAlign: field.settings?.label_alignment || "left" }}
      >
        <span style={labelStyle} className="flex-1">
          {field.label}
        </span>
        {field.is_required && (
          <span className="px-3 py-1 text-xs font-black bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-full shadow-sm uppercase tracking-wide flex-shrink-0">Required</span>
        )}
      </Label>
      {renderField()}
      {field.help_text && (
        <p className="text-base text-gray-500 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
          <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-bold">i</span>
          {field.help_text}
        </p>
      )}
    </div>
  )
}
