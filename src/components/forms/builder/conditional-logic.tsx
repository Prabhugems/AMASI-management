"use client"

import { FormField, ConditionalLogic, ConditionalRule } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Zap,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface ConditionalLogicEditorProps {
  fields: FormField[]
  onUpdateField: (fieldId: string, updates: Partial<FormField>) => void
}

const operators = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
]

const actions = [
  { value: "show", label: "Show", icon: Eye },
  { value: "hide", label: "Hide", icon: EyeOff },
]

export function ConditionalLogicEditor({
  fields,
  onUpdateField,
}: ConditionalLogicEditorProps) {
  const [expandedField, setExpandedField] = useState<string | null>(null)

  // Filter out layout fields (heading, paragraph, divider)
  const editableFields = fields.filter(
    (f) => !["heading", "paragraph", "divider"].includes(f.field_type)
  )

  const getFieldLabel = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    return field?.label || "Unknown field"
  }

  const hasLogic = (field: FormField) => {
    return field.conditional_logic && field.conditional_logic.rules?.length > 0
  }

  const addRule = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return

    const existingLogic = field.conditional_logic || {
      action: "show",
      logic: "all",
      rules: [],
    }

    const newRule: ConditionalRule = {
      field_id: "",
      operator: "equals",
      value: "",
    }

    onUpdateField(fieldId, {
      conditional_logic: {
        ...existingLogic,
        rules: [...(existingLogic.rules || []), newRule],
      },
    })
  }

  const updateRule = (
    fieldId: string,
    ruleIndex: number,
    updates: Partial<ConditionalRule>
  ) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field?.conditional_logic) return

    const updatedRules = [...field.conditional_logic.rules]
    updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], ...updates }

    onUpdateField(fieldId, {
      conditional_logic: {
        ...field.conditional_logic,
        rules: updatedRules,
      },
    })
  }

  const removeRule = (fieldId: string, ruleIndex: number) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field?.conditional_logic) return

    const updatedRules = field.conditional_logic.rules.filter(
      (_, i) => i !== ruleIndex
    )

    if (updatedRules.length === 0) {
      onUpdateField(fieldId, { conditional_logic: undefined })
    } else {
      onUpdateField(fieldId, {
        conditional_logic: {
          ...field.conditional_logic,
          rules: updatedRules,
        },
      })
    }
  }

  const updateLogicSettings = (
    fieldId: string,
    updates: Partial<ConditionalLogic>
  ) => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field?.conditional_logic) return

    onUpdateField(fieldId, {
      conditional_logic: {
        ...field.conditional_logic,
        ...updates,
      },
    })
  }

  const removeAllLogic = (fieldId: string) => {
    onUpdateField(fieldId, { conditional_logic: undefined })
  }

  // Get options for a field (for select, radio, checkbox fields)
  const getFieldOptions = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId)
    return field?.options || []
  }

  // Get fields that can be used as conditions (fields before the current one)
  const getAvailableConditionFields = (currentFieldId: string) => {
    const currentIndex = fields.findIndex((f) => f.id === currentFieldId)
    return fields.slice(0, currentIndex).filter(
      (f) => !["heading", "paragraph", "divider"].includes(f.field_type)
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Conditional Logic
        </h2>
        <p className="text-muted-foreground mt-1">
          Show or hide fields based on user responses
        </p>
      </div>

      {editableFields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No fields to configure</h3>
            <p className="text-sm text-muted-foreground">
              Add some fields to your form first, then come back here to set up
              conditional logic.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {editableFields.map((field, index) => {
            const availableFields = getAvailableConditionFields(field.id)
            const isExpanded = expandedField === field.id
            const fieldHasLogic = hasLogic(field)

            return (
              <Card
                key={field.id}
                className={cn(
                  "transition-all",
                  fieldHasLogic && "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/10"
                )}
              >
                <CardHeader
                  className="cursor-pointer py-3"
                  onClick={() =>
                    setExpandedField(isExpanded ? null : field.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium",
                          fieldHasLogic
                            ? "bg-yellow-500 text-white"
                            : "bg-secondary text-muted-foreground"
                        )}
                      >
                        {fieldHasLogic ? (
                          <Zap className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{field.label}</CardTitle>
                        <CardDescription className="text-xs">
                          {field.field_type}
                          {fieldHasLogic && (
                            <span className="ml-2 text-yellow-600">
                              • {field.conditional_logic?.rules?.length || 0} rule(s)
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {availableFields.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        <p>No fields available to use as conditions.</p>
                        <p className="text-xs mt-1">
                          Add more fields before this one to enable conditional logic.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Logic Settings */}
                        {fieldHasLogic && (
                          <div className="flex items-center gap-4 p-3 bg-secondary/50 rounded-lg">
                            <Select
                              value={field.conditional_logic?.action || "show"}
                              onValueChange={(value) =>
                                updateLogicSettings(field.id, {
                                  action: value as "show" | "hide",
                                })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {actions.map((action) => (
                                  <SelectItem key={action.value} value={action.value}>
                                    <div className="flex items-center gap-2">
                                      <action.icon className="w-4 h-4" />
                                      {action.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">
                              this field when
                            </span>
                            <Select
                              value={field.conditional_logic?.logic || "all"}
                              onValueChange={(value) =>
                                updateLogicSettings(field.id, {
                                  logic: value as "all" | "any",
                                })
                              }
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="any">Any</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">
                              of the following rules match:
                            </span>
                          </div>
                        )}

                        {/* Rules */}
                        <div className="space-y-2">
                          {field.conditional_logic?.rules?.map((rule, ruleIndex) => {
                            const ruleField = fields.find(
                              (f) => f.id === rule.field_id
                            )
                            const ruleFieldOptions = getFieldOptions(rule.field_id)
                            const showValueInput = !["is_empty", "is_not_empty"].includes(
                              rule.operator
                            )

                            return (
                              <div
                                key={ruleIndex}
                                className="flex items-center gap-2 p-3 bg-background border rounded-lg"
                              >
                                {/* Field selector */}
                                <Select
                                  value={rule.field_id}
                                  onValueChange={(value) =>
                                    updateRule(field.id, ruleIndex, { field_id: value })
                                  }
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue placeholder="Select field" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableFields.map((f) => (
                                      <SelectItem key={f.id} value={f.id}>
                                        {f.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {/* Operator */}
                                <Select
                                  value={rule.operator}
                                  onValueChange={(value) =>
                                    updateRule(field.id, ruleIndex, {
                                      operator: value as any,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-36">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {operators.map((op) => (
                                      <SelectItem key={op.value} value={op.value}>
                                        {op.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {/* Value */}
                                {showValueInput && (
                                  <>
                                    {ruleFieldOptions.length > 0 ? (
                                      <Select
                                        value={String(rule.value)}
                                        onValueChange={(value) =>
                                          updateRule(field.id, ruleIndex, { value })
                                        }
                                      >
                                        <SelectTrigger className="flex-1">
                                          <SelectValue placeholder="Select value" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ruleFieldOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <Input
                                        value={String(rule.value || "")}
                                        onChange={(e) =>
                                          updateRule(field.id, ruleIndex, {
                                            value: e.target.value,
                                          })
                                        }
                                        placeholder="Enter value"
                                        className="flex-1"
                                      />
                                    )}
                                  </>
                                )}

                                {/* Remove */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeRule(field.id, ruleIndex)}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>

                        {/* Add Rule Button */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addRule(field.id)}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Rule
                          </Button>
                          {fieldHasLogic && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAllLogic(field.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove All Logic
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Help Text */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="py-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            How Conditional Logic Works
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Fields can only depend on fields that appear before them</li>
            <li>• Use "All" when every condition must be met</li>
            <li>• Use "Any" when at least one condition must be met</li>
            <li>• "Show" makes a field visible when conditions match</li>
            <li>• "Hide" makes a field invisible when conditions match</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
