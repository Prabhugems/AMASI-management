"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Settings,
  Save,
  Loader2,
  Plus,
  Trash2,
  Link,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react"

export type MarkColumn = {
  key: string
  label: string
  max: number
}

export type ExaminerToken = {
  id: string
  label: string
  created_at: string
}

export type ExamSettings = {
  exam_type: string
  pass_marks: number
  mark_columns: MarkColumn[]
  convocation_prefix: string
  convocation_start?: number
  without_exam_prefix?: string
  without_exam_start?: number
  exam_ticket_types?: string[]
  examiner_tokens?: ExaminerToken[]
}

const FMAS_DEFAULTS: MarkColumn[] = [
  { key: "practical", label: "Practical", max: 10 },
  { key: "viva", label: "VIVA", max: 10 },
  { key: "publication", label: "Publication", max: 5 },
]

const MMAS_DEFAULTS: MarkColumn[] = [
  { key: "highest_qualification", label: "Highest Qualification", max: 20 },
  { key: "viva", label: "VIVA", max: 10 },
  { key: "publication", label: "Publication", max: 10 },
]

const defaultSettings: ExamSettings = {
  exam_type: "fmas",
  pass_marks: 15,
  mark_columns: FMAS_DEFAULTS,
  convocation_prefix: "FMAS",
}

export default function ExamSettingsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<ExamSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null)
  const [tokenLabel, setTokenLabel] = useState("")

  // Fetch ticket types for this event
  const { data: ticketTypes } = useQuery({
    queryKey: ["event-ticket-types", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name")
        .eq("event_id", eventId)
        .order("name")
      return (data || []) as { id: string; name: string }[]
    },
    enabled: !!eventId,
  })

  const { data: settings, isLoading } = useQuery({
    queryKey: ["exam-settings", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .maybeSingle()

      const eventSettings = (data as any)?.settings as Record<string, any> | null
      return (eventSettings?.examination as ExamSettings) || null
    },
    enabled: !!eventId,
  })

  useEffect(() => {
    if (settings) {
      setFormData({ ...defaultSettings, ...settings })
    }
  }, [settings])

  const handleExamTypeChange = (type: string) => {
    const columns = type === "mmas" ? MMAS_DEFAULTS : FMAS_DEFAULTS
    const prefix = type === "mmas" ? "MMAS" : "FMAS"
    const passMark = type === "mmas" ? 25 : 15
    setFormData(prev => ({
      ...prev,
      exam_type: type,
      mark_columns: columns,
      convocation_prefix: prefix,
      pass_marks: passMark,
    }))
  }

  const updateColumn = (index: number, field: keyof MarkColumn, value: string | number) => {
    setFormData(prev => {
      const cols = [...prev.mark_columns]
      cols[index] = { ...cols[index], [field]: value }
      if (field === "label") {
        cols[index].key = (value as string).toLowerCase().replace(/[^a-z0-9]/g, "_")
      }
      return { ...prev, mark_columns: cols }
    })
  }

  const addColumn = () => {
    setFormData(prev => ({
      ...prev,
      mark_columns: [...prev.mark_columns, { key: "new_column", label: "New Column", max: 10 }],
    }))
  }

  const removeColumn = (index: number) => {
    setFormData(prev => ({
      ...prev,
      mark_columns: prev.mark_columns.filter((_, i) => i !== index),
    }))
  }

  const totalMax = formData.mark_columns.reduce((sum, col) => sum + col.max, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: event } = await (supabase as any)
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .maybeSingle()

      const currentSettings = ((event as any)?.settings as Record<string, any>) || {}

      const { error } = await (supabase as any)
        .from("events")
        .update({
          settings: { ...currentSettings, examination: formData },
        })
        .eq("id", eventId)

      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: ["exam-settings", eventId] })
    } catch (error) {
      console.error("Failed to save exam settings:", error)
    }
    setSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Examination Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure exam type, scoring columns, and pass criteria
        </p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-6">
        {/* Quick Presets */}
        <div>
          <label className="text-sm font-medium mb-2 block">Quick Presets</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "fmas", label: "FMAS", desc: "Fellowship in Minimal Access Surgery" },
              { key: "mmas", label: "MMAS", desc: "Mastery in Minimal Access Surgery" },
            ].map(preset => (
              <button
                key={preset.key}
                onClick={() => handleExamTypeChange(preset.key)}
                className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                  formData.exam_type === preset.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/30 hover:bg-secondary/60 border-border"
                }`}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs opacity-70 ml-1">- {preset.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Click a preset to load default columns, or type a custom name below.
          </p>
        </div>

        {/* Custom Exam Type Name */}
        <div>
          <label className="text-sm font-medium">Examination Name</label>
          <Input
            value={formData.exam_type}
            onChange={(e) => setFormData(prev => ({ ...prev, exam_type: e.target.value }))}
            className="mt-1.5"
            placeholder="e.g. FMAS, MMAS, Diploma MAS, Custom Exam"
          />
          <p className="text-xs text-muted-foreground mt-1">
            You can type any name. This appears on PDFs and reports.
          </p>
        </div>

        {/* Convocation Number Settings */}
        <div>
          <label className="text-sm font-medium mb-2 block">Exam Convocation Numbers</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Prefix</label>
              <Input
                value={formData.convocation_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, convocation_prefix: e.target.value }))}
                className="mt-1"
                placeholder="e.g. 122AEC"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start Number</label>
              <Input
                type="number"
                value={formData.convocation_start || 1001}
                onChange={(e) => setFormData(prev => ({ ...prev, convocation_start: Number(e.target.value) }))}
                className="mt-1"
                placeholder="e.g. 1001"
                min={1}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Without Exam Convocation Numbers</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Prefix</label>
              <Input
                value={formData.without_exam_prefix || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, without_exam_prefix: e.target.value }))}
                className="mt-1"
                placeholder="e.g. 122WEC"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start Number</label>
              <Input
                type="number"
                value={formData.without_exam_start || 1001}
                onChange={(e) => setFormData(prev => ({ ...prev, without_exam_start: Number(e.target.value) }))}
                className="mt-1"
                placeholder="e.g. 1001"
                min={1}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Preview: <span className="font-mono">{formData.convocation_prefix || "FMAS"}{formData.convocation_start || 1001}</span> (exam) / <span className="font-mono">{formData.without_exam_prefix || "WEC"}{formData.without_exam_start || 1001}</span> (without exam)
          </p>
        </div>

        {/* Exam Ticket Types */}
        <div>
          <label className="text-sm font-medium mb-2 block">Exam Ticket Types</label>
          <p className="text-xs text-muted-foreground mb-3">
            Select which ticket types participate in the examination. Only these candidates will appear in exam pages.
          </p>
          {ticketTypes && ticketTypes.length > 0 ? (
            <div className="space-y-2 p-3 bg-secondary/30 rounded-lg">
              {ticketTypes.map((tt) => (
                <label key={tt.id} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={formData.exam_ticket_types?.includes(tt.id) || false}
                    onCheckedChange={(checked) => {
                      setFormData(prev => {
                        const current = prev.exam_ticket_types || []
                        return {
                          ...prev,
                          exam_ticket_types: checked
                            ? [...current, tt.id]
                            : current.filter(id => id !== tt.id),
                        }
                      })
                    }}
                  />
                  <span className="text-sm">{tt.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No ticket types found for this event.</p>
          )}
          {(!formData.exam_ticket_types || formData.exam_ticket_types.length === 0) && (
            <p className="text-xs text-orange-600 mt-2">
              No ticket types selected — all candidates will be shown in exam pages.
            </p>
          )}
        </div>

        {/* Mark Columns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium">Scoring Columns</label>
            <Button size="sm" variant="outline" onClick={addColumn} className="gap-1 h-7 text-xs">
              <Plus className="h-3 w-3" /> Add Column
            </Button>
          </div>

          <div className="space-y-2">
            {formData.mark_columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
                <div className="flex-1">
                  <Input
                    value={col.label}
                    onChange={(e) => updateColumn(i, "label", e.target.value)}
                    placeholder="Column name"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    value={col.max}
                    onChange={(e) => updateColumn(i, "max", Number(e.target.value))}
                    placeholder="Max"
                    className="h-8 text-sm text-center"
                    min={1}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-8">max</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeColumn(i)}
                  className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Total Max Marks</span>
            <span className="text-xl font-bold">{totalMax}</span>
          </div>
        </div>

        {/* Pass Marks */}
        <div>
          <label className="text-sm font-medium">Pass Marks (out of {totalMax})</label>
          <Input
            type="number"
            value={formData.pass_marks}
            onChange={(e) => setFormData(prev => ({ ...prev, pass_marks: Number(e.target.value) }))}
            className="mt-1.5 max-w-xs"
            min={0}
            max={totalMax}
          />
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-4 w-4" />Save Settings</>
            )}
          </Button>
        </div>
      </div>

      {/* Examiner Portal Section */}
      <div className="bg-card border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Link className="h-5 w-5" />
            Examiner Portal
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Generate shareable links for examiners to enter marks from their phones.
          </p>
        </div>

        {/* Generate new token */}
        <div className="flex items-center gap-2">
          <Input
            value={tokenLabel}
            onChange={(e) => setTokenLabel(e.target.value)}
            placeholder="Label (e.g. Examiner 1, Dr. Smith)"
            className="flex-1"
          />
          <Button
            variant="outline"
            className="gap-1 whitespace-nowrap"
            onClick={async () => {
              const newToken: ExaminerToken = {
                id: crypto.randomUUID(),
                label: tokenLabel.trim() || `Examiner ${(formData.examiner_tokens?.length || 0) + 1}`,
                created_at: new Date().toISOString(),
              }
              const updatedTokens = [...(formData.examiner_tokens || []), newToken]
              const updatedForm = { ...formData, examiner_tokens: updatedTokens }
              setFormData(updatedForm)
              setTokenLabel("")

              // Auto-save to persist the token immediately
              try {
                const { data: event } = await (supabase as any)
                  .from("events")
                  .select("settings")
                  .eq("id", eventId)
                  .maybeSingle()

                const currentSettings = ((event as any)?.settings as Record<string, any>) || {}
                await (supabase as any)
                  .from("events")
                  .update({
                    settings: { ...currentSettings, examination: updatedForm },
                  })
                  .eq("id", eventId)
                await queryClient.invalidateQueries({ queryKey: ["exam-settings", eventId] })
              } catch (error) {
                console.error("Failed to save token:", error)
              }
            }}
          >
            <Plus className="h-4 w-4" />
            Generate Examiner Link
          </Button>
        </div>

        {/* Existing tokens */}
        {formData.examiner_tokens && formData.examiner_tokens.length > 0 ? (
          <div className="space-y-2">
            {formData.examiner_tokens.map((t) => {
              const url = typeof window !== "undefined"
                ? `${window.location.origin}/examiner/${t.id}`
                : `/examiner/${t.id}`
              const isCopied = copiedTokenId === t.id

              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.label}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {url}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(url)
                      setCopiedTokenId(t.id)
                      setTimeout(() => setCopiedTokenId(null), 2000)
                    }}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={async () => {
                      const updatedTokens = (formData.examiner_tokens || []).filter(
                        (tok) => tok.id !== t.id
                      )
                      const updatedForm = { ...formData, examiner_tokens: updatedTokens }
                      setFormData(updatedForm)

                      // Auto-save
                      try {
                        const { data: event } = await (supabase as any)
                          .from("events")
                          .select("settings")
                          .eq("id", eventId)
                          .maybeSingle()

                        const currentSettings =
                          ((event as any)?.settings as Record<string, any>) || {}
                        await (supabase as any)
                          .from("events")
                          .update({
                            settings: { ...currentSettings, examination: updatedForm },
                          })
                          .eq("id", eventId)
                        await queryClient.invalidateQueries({
                          queryKey: ["exam-settings", eventId],
                        })
                      } catch (error) {
                        console.error("Failed to delete token:", error)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">
            No examiner links generated yet. Click the button above to create one.
          </p>
        )}
      </div>
    </div>
  )
}
