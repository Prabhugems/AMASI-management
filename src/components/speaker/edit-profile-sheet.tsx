"use client"

import React, { useEffect, useId, useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { SlideOver } from "@/components/ui/slide-over"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TagInput } from "@/components/ui/tag-input"
import { HeadshotManager } from "@/components/speaker/headshot-manager"

type FacultyProfile = {
  id: string
  title?: string | null
  name: string
  email: string | null
  phone?: string | null
  designation?: string | null
  institution?: string | null
  city?: string | null
  bio?: string | null
  bio_markdown?: string | null
  expertise_tags?: string[] | null
  youtube_reel_url?: string | null
  linkedin?: string | null
  twitter?: string | null
  orcid_id?: string | null
  website?: string | null
  researchgate?: string | null
  pubmed_id?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  faculty: FacultyProfile
}

export function EditProfileSheet({ open, onClose, faculty }: Props) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FacultyProfile>(faculty)

  const identityHeadingId = useId()
  const headshotsHeadingId = useId()
  const bioHeadingId = useId()
  const presenceHeadingId = useId()

  useEffect(() => {
    if (open) setForm(faculty)
  }, [open, faculty])

  const mutation = useMutation({
    mutationFn: async (body: Partial<FacultyProfile>) => {
      const res = await fetch(`/api/faculty/${faculty.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to save")
      return json.data as FacultyProfile
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faculty", faculty.id] })
      onClose()
    },
  })

  const update = <K extends keyof FacultyProfile>(key: K, value: FacultyProfile[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const hasChanges = useMemo(() => {
    return (Object.keys(form) as (keyof FacultyProfile)[]).some((key) => {
      if (key === "id") return false
      const formValue = form[key]
      const facultyValue = faculty[key]
      const normalizedForm =
        typeof formValue === "string" && formValue.trim() === "" ? null : formValue
      const normalizedFaculty =
        typeof facultyValue === "string" && facultyValue.trim() === "" ? null : facultyValue
      return normalizedForm !== normalizedFaculty
    })
  }, [form, faculty])

  const handleCancel = () => {
    if (hasChanges && !window.confirm("Discard unsaved changes?")) return
    onClose()
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const toSubmit: Partial<FacultyProfile> = {}
    ;(Object.keys(form) as (keyof FacultyProfile)[]).forEach((key) => {
      if (key === "id") return
      let value: FacultyProfile[typeof key] = form[key]
      if (typeof value === "string" && value.trim() === "") {
        value = null as FacultyProfile[typeof key]
      }
      if (value !== faculty[key]) {
        // @ts-expect-error narrowing across union key
        toSubmit[key] = value
      }
    })
    if (Object.keys(toSubmit).length === 0) {
      onClose()
      return
    }
    mutation.mutate(toSubmit)
  }

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Edit speaker profile"
      subtitle={faculty.name}
      width="2xl"
    >
      <form onSubmit={submit} className="space-y-6 p-6">
        <section className="space-y-4" aria-labelledby={identityHeadingId}>
          <h3
            id={identityHeadingId}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Identity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Title (Dr./Prof.)">
              <Input
                value={form.title ?? ""}
                onChange={(e) => update("title", e.target.value)}
              />
            </Field>
            <Field label="Full name" required>
              <Input
                value={form.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value || null)}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </Field>
            <Field label="Designation">
              <Input
                value={form.designation ?? ""}
                onChange={(e) => update("designation", e.target.value)}
              />
            </Field>
            <Field label="Institution">
              <Input
                value={form.institution ?? ""}
                onChange={(e) => update("institution", e.target.value)}
              />
            </Field>
            <Field label="City">
              <Input
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4" aria-labelledby={headshotsHeadingId}>
          <h3
            id={headshotsHeadingId}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Headshots
          </h3>
          <div className="mt-2">
            <HeadshotManager facultyId={faculty.id} />
          </div>
        </section>

        <section className="space-y-4" aria-labelledby={bioHeadingId}>
          <h3
            id={bioHeadingId}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Bio &amp; expertise
          </h3>
          <Field label="Bio (Markdown)" hint="Long-form bio. Markdown headings, lists, links supported.">
            <Textarea
              value={form.bio_markdown ?? ""}
              onChange={(e) => update("bio_markdown", e.target.value)}
              rows={6}
              placeholder="A consultant surgeon at..."
            />
          </Field>
          <Field label="Expertise tags" hint="Curated taxonomy for filtering & discovery.">
            <TagInput
              value={form.expertise_tags ?? []}
              onChange={(tags) => update("expertise_tags", tags)}
              placeholder="Add tag and press Enter…"
              maxTags={20}
            />
          </Field>
          <Field label="Video reel URL" hint="YouTube or other embed URL for an intro video.">
            <Input
              value={form.youtube_reel_url ?? ""}
              onChange={(e) => update("youtube_reel_url", e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </Field>
        </section>

        <section className="space-y-4" aria-labelledby={presenceHeadingId}>
          <h3
            id={presenceHeadingId}
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Online presence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="LinkedIn">
              <Input
                value={form.linkedin ?? ""}
                onChange={(e) => update("linkedin", e.target.value)}
                placeholder="https://linkedin.com/in/…"
              />
            </Field>
            <Field label="Twitter / X handle">
              <Input
                value={form.twitter ?? ""}
                onChange={(e) => update("twitter", e.target.value)}
                placeholder="@handle"
              />
            </Field>
            <Field label="ORCID iD">
              <Input
                value={form.orcid_id ?? ""}
                onChange={(e) => update("orcid_id", e.target.value)}
                placeholder="0000-0002-…"
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website ?? ""}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="ResearchGate">
              <Input
                value={form.researchgate ?? ""}
                onChange={(e) => update("researchgate", e.target.value)}
              />
            </Field>
            <Field label="PubMed ID">
              <Input
                value={form.pubmed_id ?? ""}
                onChange={(e) => update("pubmed_id", e.target.value)}
              />
            </Field>
          </div>
        </section>

        {mutation.isError && (
          <p className="text-sm text-destructive">{(mutation.error as Error).message}</p>
        )}

        <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t bg-background flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={handleCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || !hasChanges}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>
    </SlideOver>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
