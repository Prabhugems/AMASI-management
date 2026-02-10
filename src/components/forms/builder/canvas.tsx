"use client"

import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FormField } from "@/lib/types"
import { FieldPreview } from "./field-preview"
import { cn } from "@/lib/utils"
import { GripVertical, Trash2, Copy, Plus, Sparkles, MousePointerClick } from "lucide-react"

interface SortableFieldProps {
  field: FormField
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDuplicate: () => void
  fieldIndex: number
}

function SortableField({
  field,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  fieldIndex,
}: SortableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: "field",
      field,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-2xl transition-all duration-300",
        isDragging && "opacity-60 z-50 scale-[1.02] rotate-1",
        isSelected
          ? "bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-2 border-indigo-400 shadow-xl shadow-indigo-200/50 ring-4 ring-indigo-100"
          : "bg-white border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-gray-200/50"
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Field number badge */}
      <div className={cn(
        "absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all",
        isSelected
          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-110"
          : "bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-600"
      )}>
        {fieldIndex + 1}
      </div>

      {/* Drag handle */}
      <div
        className={cn(
          "absolute -left-14 top-1/2 -translate-y-1/2 transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100"
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 cursor-grab active:cursor-grabbing shadow-lg hover:shadow-xl transition-all"
        >
          <GripVertical className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Action buttons */}
      <div
        className={cn(
          "absolute -right-14 top-1/2 -translate-y-1/2 flex flex-col gap-2 transition-all duration-200",
          "opacity-0 group-hover:opacity-100",
          isSelected && "opacity-100"
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all group/btn"
          title="Duplicate field"
        >
          <Copy className="w-5 h-5 text-blue-500 group-hover/btn:scale-110 transition-transform" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-3 rounded-xl bg-white border-2 border-gray-200 hover:border-red-400 hover:bg-red-50 shadow-lg hover:shadow-xl transition-all group/btn"
          title="Delete field"
        >
          <Trash2 className="w-5 h-5 text-red-500 group-hover/btn:scale-110 transition-transform" />
        </button>
      </div>

      {/* Selection glow effect */}
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
      )}

      {/* Field Preview */}
      <div className="p-6">
        <FieldPreview field={field} />
      </div>
    </div>
  )
}

interface CanvasProps {
  fields: FormField[]
  selectedFieldId: string | null
  onSelectField: (fieldId: string | null) => void
  onDeleteField: (fieldId: string) => void
  onDuplicateField: (fieldId: string) => void
  formName?: string
  formDescription?: string
  primaryColor?: string
  backgroundColor?: string
  logoUrl?: string
  headerImageUrl?: string
}

export function Canvas({
  fields,
  selectedFieldId,
  onSelectField,
  onDeleteField,
  onDuplicateField,
  formName,
  formDescription,
  primaryColor = "#6366F1",
  backgroundColor = "#F8FAFC",
  logoUrl,
  headerImageUrl,
}: CanvasProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas",
  })

  return (
    <div
      ref={setNodeRef}
      className="min-h-[700px] rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 border border-gray-200"
      style={{ backgroundColor }}
      onClick={() => onSelectField(null)}
    >
      {/* Header Image */}
      {headerImageUrl && (
        <div className="h-48 overflow-hidden relative">
          <img
            src={headerImageUrl}
            alt="Form header"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        </div>
      )}

      {/* Form Card */}
      <div className="mx-6 my-8 bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Form Header Preview */}
        <div className="p-8 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white rounded-t-2xl">
          {/* Logo */}
          {logoUrl && (
            <div className="flex justify-center mb-6">
              <img
                src={logoUrl}
                alt="Form logo"
                className="max-h-16 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
              />
            </div>
          )}
          <h1
            className="text-3xl font-extrabold text-center mb-3 tracking-tight"
            style={{ color: primaryColor }}
          >
            {formName || "Untitled Form"}
          </h1>
          {formDescription && (
            <p className="text-gray-500 text-center text-lg max-w-md mx-auto">{formDescription}</p>
          )}
        </div>

        {/* Fields */}
        <div className="p-8">
          {fields.length === 0 ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center py-20 text-center border-3 border-dashed rounded-2xl transition-all duration-300",
                isOver
                  ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 scale-[1.02]"
                  : "border-gray-300 bg-gray-50/50"
              )}
            >
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
              >
                {isOver ? (
                  <Sparkles className="w-12 h-12 text-white animate-pulse" />
                ) : (
                  <MousePointerClick className="w-12 h-12 text-white" />
                )}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">
                {isOver ? "Drop it here!" : "Start Building Your Form"}
              </h3>
              <p className="text-gray-500 max-w-sm text-lg">
                {isOver
                  ? "Release to add this field"
                  : "Drag fields from the left panel and drop them here"}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span>Pro tip: Click a field to edit its properties</span>
              </div>
            </div>
          ) : (
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-5">
                {fields.map((field, index) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    fieldIndex={index}
                    isSelected={selectedFieldId === field.id}
                    onSelect={() => onSelectField(field.id)}
                    onDelete={() => onDeleteField(field.id)}
                    onDuplicate={() => onDuplicateField(field.id)}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          {/* Drop indicator at bottom */}
          {fields.length > 0 && (
            <div
              className={cn(
                "mt-6 h-20 rounded-2xl border-3 border-dashed flex items-center justify-center transition-all duration-300",
                isOver
                  ? "border-indigo-400 bg-indigo-50 scale-[1.02]"
                  : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
              )}
            >
              <p className="text-base text-gray-500 flex items-center gap-3 font-medium">
                <Plus className="w-5 h-5" />
                {isOver ? "Drop here to add" : "Drop a field here to add more"}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button Preview */}
        {fields.length > 0 && (
          <div className="px-8 pb-8">
            <button
              className="w-full h-14 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 hover:shadow-lg shadow-md"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
              }}
              disabled
            >
              Submit Form
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pb-6">
        <p className="text-sm text-gray-400 font-medium">
          Powered by <span className="text-indigo-500 font-bold">AMASI Forms</span>
        </p>
      </div>
    </div>
  )
}
