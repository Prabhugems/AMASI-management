"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSignature,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { toast, Toaster } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SignaturePad } from "@/components/ui/signature-pad"

type Entity = {
  org: string
  relationship: string
  compensation_type: string
}

type Disclosure = {
  id: string
  faculty_id: string
  event_id: string
  version: number
  has_conflict: boolean
  disclosure_text: string | null
  entities: Entity[] | null
  signed_at: string | null
  signature_image_url: string | null
  pdf_storage_path: string | null
  is_current: boolean
}

type DisclosureResponse = {
  disclosure: Disclosure | null
  faculty: {
    id: string | null
    name: string | null
    email: string | null
  }
}

const RELATIONSHIPS = [
  "Employee",
  "Consultant",
  "Speaker bureau",
  "Advisor",
  "Stockholder",
  "Royalties",
  "Other",
] as const

const COMPENSATION_TYPES = [
  "Salary",
  "Honorarium",
  "Stock",
  "Grant",
  "Royalty",
  "Other",
] as const

function emptyEntity(): Entity {
  return { org: "", relationship: "", compensation_type: "" }
}

export default function SpeakerDisclosurePage() {
  const params = useParams()
  const token = params.token as string
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery<DisclosureResponse>({
    queryKey: ["speaker-disclosure", token],
    queryFn: async () => {
      const res = await fetch(`/api/speaker/${token}/disclosure`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load disclosure")
      return json as DisclosureResponse
    },
  })

  const current = data?.disclosure ?? null
  const [editing, setEditing] = useState(false)

  // When current disclosure loads/changes, default the UI: show form when none exists.
  useEffect(() => {
    if (!current) setEditing(true)
  }, [current])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-3xl mx-auto py-8 space-y-4" role="status" aria-label="Loading disclosure">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur border-white/20">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
            <h2 className="text-xl font-semibold text-white mb-2">Unable to load</h2>
            <p className="text-white/70 text-sm">{(error as Error).message}</p>
            <Link
              href={`/speaker/${token}`}
              className="mt-4 inline-block text-sm text-white/80 hover:text-white underline"
            >
              Back to portal
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Toaster richColors position="top-right" />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link
            href={`/speaker/${token}`}
            className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to speaker portal
          </Link>
          <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-white">
            Financial disclosure & COI
          </h1>
          {data?.faculty?.name && (
            <p className="text-sm text-white/70 mt-1">
              Signing as <span className="text-white">{data.faculty.name}</span>
              {data.faculty.email ? ` (${data.faculty.email})` : ""}
            </p>
          )}
        </div>

        <Card className="bg-white/5 backdrop-blur border-white/15">
          <CardContent className="py-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
            <p className="text-sm text-white/80">
              Required for CME accreditation. Please disclose any financial relationships
              with commercial entities that could be perceived as influencing your
              presentation.
            </p>
          </CardContent>
        </Card>

        {current && !editing && (
          <CurrentDisclosureCard
            disclosure={current}
            onResign={() => setEditing(true)}
          />
        )}

        {editing && (
          <DisclosureForm
            token={token}
            previous={current}
            onCancel={current ? () => setEditing(false) : undefined}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["speaker-disclosure", token] })
              setEditing(false)
              toast.success("Disclosure submitted.")
            }}
          />
        )}
      </div>
    </div>
  )
}

function CurrentDisclosureCard({
  disclosure,
  onResign,
}: {
  disclosure: Disclosure
  onResign: () => void
}) {
  const signedAt = disclosure.signed_at
    ? new Date(disclosure.signed_at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—"

  const entities: Entity[] = Array.isArray(disclosure.entities) ? disclosure.entities : []

  return (
    <Card className="bg-white/10 backdrop-blur border-white/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              Disclosure on file
            </CardTitle>
            <p className="text-xs text-white/60 mt-1">
              Version {disclosure.version} · signed {signedAt}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              disclosure.has_conflict
                ? "border-amber-400/50 text-amber-200 bg-amber-500/10"
                : "border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
            }
          >
            {disclosure.has_conflict ? "Conflict declared" : "No conflict"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {disclosure.has_conflict ? (
          entities.length > 0 ? (
            <div className="rounded-md border border-white/15 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Organization</th>
                    <th className="text-left px-3 py-2 font-medium">Relationship</th>
                    <th className="text-left px-3 py-2 font-medium">Compensation</th>
                  </tr>
                </thead>
                <tbody className="text-white/85">
                  {entities.map((e, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="px-3 py-2">{e.org || "—"}</td>
                      <td className="px-3 py-2">{e.relationship || "—"}</td>
                      <td className="px-3 py-2">{e.compensation_type || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-white/70">No entities recorded.</p>
          )
        ) : (
          <p className="text-sm text-white/80">
            You declared no financial conflicts of interest.
          </p>
        )}

        {disclosure.disclosure_text && (
          <div>
            <p className="text-xs uppercase tracking-wide text-white/50 mb-1">
              Additional notes
            </p>
            <p className="text-sm text-white/85 whitespace-pre-wrap">
              {disclosure.disclosure_text}
            </p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            onClick={onResign}
          >
            <FileSignature className="h-4 w-4 mr-2" />
            Resign disclosure
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DisclosureForm({
  token,
  previous,
  onCancel,
  onSuccess,
}: {
  token: string
  previous: Disclosure | null
  onCancel?: () => void
  onSuccess: () => void
}) {
  const initialEntities: Entity[] = useMemo(() => {
    if (previous?.has_conflict && Array.isArray(previous.entities) && previous.entities.length > 0) {
      return previous.entities
    }
    return [emptyEntity()]
  }, [previous])

  const [hasConflict, setHasConflict] = useState<boolean>(previous?.has_conflict ?? false)
  const [entities, setEntities] = useState<Entity[]>(initialEntities)
  const [notes, setNotes] = useState<string>(previous?.disclosure_text ?? "")
  const [signature, setSignature] = useState<string | null>(
    previous?.signature_image_url ?? null
  )

  const submit = useMutation({
    mutationFn: async () => {
      const payload: {
        has_conflict: boolean
        disclosure_text?: string
        entities?: Entity[]
        signature_image_url?: string
      } = {
        has_conflict: hasConflict,
      }
      if (notes.trim()) payload.disclosure_text = notes.trim()
      if (hasConflict) {
        payload.entities = entities
          .map((e) => ({
            org: e.org.trim(),
            relationship: e.relationship,
            compensation_type: e.compensation_type,
          }))
          .filter((e) => e.org || e.relationship || e.compensation_type)
      }
      if (signature) payload.signature_image_url = signature

      const res = await fetch(`/api/speaker/${token}/disclosure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Failed to sign disclosure")
      return json
    },
    onSuccess,
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  function updateEntity(i: number, patch: Partial<Entity>) {
    setEntities((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  function addRow() {
    setEntities((prev) => [...prev, emptyEntity()])
  }

  function removeRow(i: number) {
    setEntities((prev) => (prev.length === 1 ? [emptyEntity()] : prev.filter((_, idx) => idx !== i)))
  }

  function handleSubmit() {
    if (hasConflict) {
      const valid = entities.some(
        (e) => e.org.trim() && e.relationship && e.compensation_type
      )
      if (!valid) {
        toast.error("Please complete at least one entity row.")
        return
      }
    }
    if (!signature) {
      toast.error("Please add your signature.")
      return
    }
    submit.mutate()
  }

  return (
    <Card className="bg-white/10 backdrop-blur border-white/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-lg">
          {previous ? "Resign disclosure" : "Sign disclosure"}
        </CardTitle>
        {previous && (
          <p className="text-xs text-white/60">
            This will create a new version (v{(previous.version ?? 1) + 1}) and supersede
            the current one.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-white">
            Do you have any financial conflict of interest?
          </Label>
          <RadioGroup
            value={hasConflict ? "yes" : "no"}
            onValueChange={(v) => setHasConflict(v === "yes")}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="no"
                id="coi-no"
                className="border-white/40 text-white"
              />
              <Label htmlFor="coi-no" className="text-white font-normal cursor-pointer">
                No
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="yes"
                id="coi-yes"
                className="border-white/40 text-white"
              />
              <Label htmlFor="coi-yes" className="text-white font-normal cursor-pointer">
                Yes
              </Label>
            </div>
          </RadioGroup>
        </div>

        {hasConflict && (
          <div className="space-y-3">
            <Label className="text-white">Disclosed entities</Label>
            <div className="rounded-md border border-white/15 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-white/70 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-2/5">Organization</th>
                    <th className="text-left px-3 py-2 font-medium">Relationship</th>
                    <th className="text-left px-3 py-2 font-medium">Compensation</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {entities.map((entity, i) => (
                    <tr key={i} className="border-t border-white/10 align-top">
                      <td className="px-3 py-2">
                        <Input
                          value={entity.org}
                          onChange={(e) => updateEntity(i, { org: e.target.value })}
                          placeholder="Organization name"
                          className="h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={entity.relationship || undefined}
                          onValueChange={(v) => updateEntity(i, { relationship: v })}
                        >
                          <SelectTrigger className="h-9 bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIPS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={entity.compensation_type || undefined}
                          onValueChange={(v) =>
                            updateEntity(i, { compensation_type: v })
                          }
                        >
                          <SelectTrigger className="h-9 bg-white/10 border-white/20 text-white">
                            <SelectValue placeholder="Select…" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMPENSATION_TYPES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-white/60 hover:text-red-200 hover:bg-red-500/10"
                          onClick={() => removeRow(i)}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add row
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-white">
            Additional notes (optional)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else relevant to your disclosure"
            rows={3}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-white">Signature</Label>
          <div className="rounded-md bg-white p-3">
            <SignaturePad
              onChange={(url) => setSignature(url)}
              width={420}
              height={160}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="text-white/80 hover:bg-white/10 hover:text-white"
              onClick={onCancel}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submit.isPending}
          >
            {submit.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSignature className="h-4 w-4 mr-2" />
            )}
            Sign & submit
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
