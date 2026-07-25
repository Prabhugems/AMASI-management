"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileDown } from "lucide-react"
import { toast } from "sonner"
import { LETTER_TEMPLATES } from "@/lib/services/faculty-letter-templates"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
}

type FacultyAssignment = {
  role: string
  topic_title: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  session_name: string | null
}

// Maps a template field key to how it should prefill from the speaker's
// first faculty_assignments row, if one exists. Only keys present in a
// given template's field schema are ever looked up, so this map can safely
// list every mapping every template might use.
function prefillFromAssignment(assignment: FacultyAssignment | undefined): Record<string, string> {
  if (!assignment) return {}
  const timeRange = assignment.start_time
    ? `${assignment.start_time}${assignment.end_time ? ` - ${assignment.end_time}` : ""}`
    : ""
  return {
    facultyRole: assignment.role ? assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1) : "",
    trackSession: assignment.session_name || "",
    presentationTopic: assignment.topic_title || "",
    sessionTitle: assignment.session_name || "",
    sessionDate: assignment.session_date || "",
    sessionTime: timeRange,
    hall: assignment.hall || "",
  }
}

export function LetterComposerSheet({
  eventId,
  speaker,
  assignments,
  open,
  onOpenChange,
}: {
  eventId: string
  speaker: Speaker | null
  assignments: FacultyAssignment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [templateKey, setTemplateKey] = useState<string>("initial_invitation")
  const [values, setValues] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)

  const template = LETTER_TEMPLATES[templateKey]

  // Reset the form each time the sheet opens for a (possibly new) speaker,
  // prefilling from their first assignment where the template has a
  // matching field. Guarded by a ref so this only fires once per
  // (open, templateKey) combination — `assignments` is an array that the
  // caller can re-mint on every render (e.g. `speakerAssignments || []`),
  // and without the guard that reference churn would reset the form and
  // discard in-progress edits while the sheet stays open.
  const prefilledKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) {
      prefilledKeyRef.current = null
      return
    }
    const prefillKey = `${templateKey}`
    if (prefilledKeyRef.current === prefillKey) return
    prefilledKeyRef.current = prefillKey
    const prefill = prefillFromAssignment(assignments[0])
    const next: Record<string, string> = {}
    for (const f of template.fields) {
      next[f.key] = prefill[f.key] || ""
    }
    setValues(next)
  }, [open, templateKey, assignments, template.fields])

  const missingRequired = useMemo(
    () => template.fields.filter((f) => !values[f.key]?.trim()),
    [template.fields, values]
  )

  const handleGenerate = async () => {
    if (!speaker) return
    if (missingRequired.length > 0) {
      toast.error(`Fill in: ${missingRequired.map((f) => f.label).join(", ")}`)
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/events/${eventId}/faculty-letter-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey,
          registration_id: speaker.id,
          fields: values,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate letter")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${template.label.replace(/[^a-zA-Z0-9]/g, "_")}-${speaker.attendee_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Letter generated")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate letter")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ResizableSheetContent side="right" defaultWidth={480} storageKey="letter-composer-width">
        {speaker && (
          <div className="p-4 space-y-6">
            <SheetHeader>
              <SheetTitle>Generate Letter</SheetTitle>
              <SheetDescription>{speaker.attendee_name}</SheetDescription>
            </SheetHeader>

            <div>
              <label className="text-sm font-medium text-foreground">Template</label>
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LETTER_TEMPLATES).map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {template.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-foreground">{f.label}</label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                      className="mt-1.5"
                    />
                  ) : (
                    <Input
                      type={f.type === "date" ? "date" : "text"}
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1.5"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        )}
      </ResizableSheetContent>
    </Sheet>
  )
}
