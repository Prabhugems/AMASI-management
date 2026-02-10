"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import {
  Type,
  Mail,
  Phone,
  Hash,
  ChevronDown,
  CheckSquare,
  Circle,
  AlignLeft,
  Calendar,
  Clock,
  Upload,
  PenTool,
  Star,
  Sliders,
  Heading,
  Text,
  Minus,
  List,
  GripVertical,
} from "lucide-react"
import { FieldType } from "@/lib/types"

interface FieldPaletteItemData {
  type: FieldType
  label: string
  icon: React.ReactNode
  category: "basic" | "choice" | "advanced" | "layout"
  color: string
}

const fieldTypes: FieldPaletteItemData[] = [
  // Basic Fields
  { type: "text", label: "Text Input", icon: <Type className="w-5 h-5" />, category: "basic", color: "from-indigo-500 to-blue-500" },
  { type: "email", label: "Email Address", icon: <Mail className="w-5 h-5" />, category: "basic", color: "from-blue-500 to-cyan-500" },
  { type: "phone", label: "Phone Number", icon: <Phone className="w-5 h-5" />, category: "basic", color: "from-emerald-500 to-teal-500" },
  { type: "number", label: "Number", icon: <Hash className="w-5 h-5" />, category: "basic", color: "from-violet-500 to-purple-500" },
  { type: "textarea", label: "Long Text", icon: <AlignLeft className="w-5 h-5" />, category: "basic", color: "from-pink-500 to-rose-500" },

  // Choice Fields
  { type: "select", label: "Dropdown", icon: <ChevronDown className="w-5 h-5" />, category: "choice", color: "from-orange-500 to-amber-500" },
  { type: "multiselect", label: "Multi-Select", icon: <List className="w-5 h-5" />, category: "choice", color: "from-yellow-500 to-orange-500" },
  { type: "checkbox", label: "Checkbox", icon: <CheckSquare className="w-5 h-5" />, category: "choice", color: "from-green-500 to-emerald-500" },
  { type: "checkboxes", label: "Checkbox Group", icon: <CheckSquare className="w-5 h-5" />, category: "choice", color: "from-teal-500 to-cyan-500" },
  { type: "radio", label: "Radio Buttons", icon: <Circle className="w-5 h-5" />, category: "choice", color: "from-blue-500 to-indigo-500" },

  // Advanced Fields
  { type: "date", label: "Date Picker", icon: <Calendar className="w-5 h-5" />, category: "advanced", color: "from-orange-500 to-red-500" },
  { type: "time", label: "Time Picker", icon: <Clock className="w-5 h-5" />, category: "advanced", color: "from-purple-500 to-pink-500" },
  { type: "datetime", label: "Date & Time", icon: <Calendar className="w-5 h-5" />, category: "advanced", color: "from-rose-500 to-pink-500" },
  { type: "file", label: "File Upload", icon: <Upload className="w-5 h-5" />, category: "advanced", color: "from-indigo-500 to-purple-500" },
  { type: "signature", label: "Signature", icon: <PenTool className="w-5 h-5" />, category: "advanced", color: "from-gray-600 to-gray-800" },
  { type: "rating", label: "Star Rating", icon: <Star className="w-5 h-5" />, category: "advanced", color: "from-amber-400 to-yellow-500" },
  { type: "scale", label: "Linear Scale", icon: <Sliders className="w-5 h-5" />, category: "advanced", color: "from-cyan-500 to-blue-500" },

  // Layout Elements
  { type: "heading", label: "Heading", icon: <Heading className="w-5 h-5" />, category: "layout", color: "from-gray-700 to-gray-900" },
  { type: "paragraph", label: "Paragraph", icon: <Text className="w-5 h-5" />, category: "layout", color: "from-gray-500 to-gray-700" },
  { type: "divider", label: "Divider Line", icon: <Minus className="w-5 h-5" />, category: "layout", color: "from-gray-400 to-gray-600" },
]

function DraggableFieldItem({ field, onAdd }: { field: FieldPaletteItemData; onAdd?: (type: FieldType) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${field.type}`,
    data: {
      type: "palette-item",
      fieldType: field.type,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
  }

  const handleClick = (_e: React.MouseEvent) => {
    // Only trigger if not dragging and onAdd is provided
    if (onAdd && !isDragging) {
      onAdd(field.type)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`
        group flex items-center gap-3 p-3.5 rounded-xl cursor-pointer
        bg-white hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50
        border-2 border-gray-100 hover:border-indigo-300
        shadow-sm hover:shadow-lg hover:shadow-indigo-200/50
        transition-all duration-200 hover:scale-[1.02]
        ${isDragging ? "opacity-70 ring-4 ring-indigo-400 scale-105 rotate-2 shadow-2xl" : ""}
      `}
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${field.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all`}>
        {field.icon}
      </div>
      <div className="flex-1">
        <span className="text-sm font-bold text-gray-800 block">{field.label}</span>
        <span className="text-xs text-gray-400 group-hover:text-indigo-500 transition-colors">Click to add</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500 px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
          + Add
        </span>
        <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
      </div>
    </div>
  )
}

interface FieldPaletteProps {
  className?: string
  onAddField?: (type: FieldType) => void
}

export function FieldPalette({ className, onAddField }: FieldPaletteProps) {
  const basicFields = fieldTypes.filter((f) => f.category === "basic")
  const choiceFields = fieldTypes.filter((f) => f.category === "choice")
  const advancedFields = fieldTypes.filter((f) => f.category === "advanced")
  const layoutFields = fieldTypes.filter((f) => f.category === "layout")

  const CategoryHeader = ({ title, color, count }: { title: string; color: string; count: number }) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${color}`} />
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
        {count}
      </span>
    </div>
  )

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Basic Fields */}
      <div>
        <CategoryHeader title="Basic Fields" color="from-indigo-500 to-blue-500" count={basicFields.length} />
        <div className="space-y-2.5">
          {basicFields.map((field) => (
            <DraggableFieldItem key={field.type} field={field} onAdd={onAddField} />
          ))}
        </div>
      </div>

      {/* Choice Fields */}
      <div>
        <CategoryHeader title="Choice Fields" color="from-orange-500 to-amber-500" count={choiceFields.length} />
        <div className="space-y-2.5">
          {choiceFields.map((field) => (
            <DraggableFieldItem key={field.type} field={field} onAdd={onAddField} />
          ))}
        </div>
      </div>

      {/* Advanced Fields */}
      <div>
        <CategoryHeader title="Advanced" color="from-purple-500 to-pink-500" count={advancedFields.length} />
        <div className="space-y-2.5">
          {advancedFields.map((field) => (
            <DraggableFieldItem key={field.type} field={field} onAdd={onAddField} />
          ))}
        </div>
      </div>

      {/* Layout Elements */}
      <div>
        <CategoryHeader title="Layout" color="from-gray-600 to-gray-800" count={layoutFields.length} />
        <div className="space-y-2.5">
          {layoutFields.map((field) => (
            <DraggableFieldItem key={field.type} field={field} onAdd={onAddField} />
          ))}
        </div>
      </div>
    </div>
  )
}

export { fieldTypes }
export type { FieldPaletteItemData }
