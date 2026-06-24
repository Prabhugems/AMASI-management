"use client"

import { useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  FileText,
  ShieldAlert,
  Users,
  XCircle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

type Faculty = {
  id: string
  name: string
  email: string | null
  designation: string | null
  institution: string | null
}

type Disclosure = {
  id: string
  version: number
  has_conflict: boolean
  signed_at: string | null
  pdf_storage_path: string | null
}

type Row = {
  faculty: Faculty
  disclosure: Disclosure | null
}

type Counts = {
  total: number
  signed: number
  with_conflict: number
  unsigned: number
}

type ListResponse = {
  data: Row[]
  counts: Counts
}

export default function DisclosureCompliancePage() {
  const params = useParams()
  const eventId = params.eventId as string

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ["event-disclosures", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/disclosures`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load disclosures")
      return json as ListResponse
    },
  })

  const rows = useMemo(() => {
    const list = data?.data ?? []
    // Sort: unsigned first, then with conflict, then signed; alpha by name within.
    const rank = (r: Row) => {
      if (!r.disclosure) return 0
      if (r.disclosure.has_conflict) return 1
      return 2
    }
    return [...list].sort((a, b) => {
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      return (a.faculty.name || "").localeCompare(b.faculty.name || "")
    })
  }, [data])

  const counts: Counts = data?.counts ?? {
    total: 0,
    signed: 0,
    with_conflict: 0,
    unsigned: 0,
  }

  async function viewPdf(disclosureId: string) {
    const tId = toast.loading("Preparing PDF…")
    try {
      const res = await fetch(
        `/api/events/${eventId}/disclosures/${disclosureId}/signed-pdf`
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        throw new Error(json.error || "Could not open PDF")
      }
      toast.dismiss(tId)
      window.open(json.url, "_blank", "noopener,noreferrer")
    } catch (e) {
      toast.dismiss(tId)
      toast.error((e as Error).message)
    }
  }

  function nudgeUnsigned() {
    toast("Will send reminder emails — coming soon")
  }

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Disclosure compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track financial / COI disclosures across all assigned faculty.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={nudgeUnsigned}
          disabled={counts.unsigned === 0}
        >
          <BellRing className="h-4 w-4 mr-2" />
          Nudge unsigned
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total speakers"
          value={counts.total}
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Signed"
          value={counts.signed}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          tone="emerald"
        />
        <KpiCard
          label="With declared conflict"
          value={counts.with_conflict}
          icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
          tone="amber"
        />
        <KpiCard
          label="Unsigned"
          value={counts.unsigned}
          icon={<XCircle className="h-4 w-4 text-red-500" />}
          tone="red"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance roster</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" role="status" aria-label="Loading disclosures">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{(error as Error).message}</p>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No assigned faculty"
              description="Assign faculty to this event to track disclosure compliance."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Speaker</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const d = row.disclosure
                    const statusBadge = !d ? (
                      <Badge
                        variant="outline"
                        className="border-red-300 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30"
                      >
                        Unsigned
                      </Badge>
                    ) : d.has_conflict ? (
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30"
                      >
                        With conflict
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30"
                      >
                        Signed
                      </Badge>
                    )

                    return (
                      <TableRow key={row.faculty.id}>
                        <TableCell>
                          <div className="font-medium">{row.faculty.name}</div>
                          {row.faculty.designation && (
                            <div className="text-xs text-muted-foreground">
                              {row.faculty.designation}
                              {row.faculty.institution
                                ? ` · ${row.faculty.institution}`
                                : ""}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.faculty.email || "—"}
                        </TableCell>
                        <TableCell>{statusBadge}</TableCell>
                        <TableCell className="text-sm">
                          {d ? `v${d.version}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {d?.signed_at ? formatDate(d.signed_at) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!d || !d.pdf_storage_path}
                            onClick={() => d && viewPdf(d.id)}
                            title={
                              d && !d.pdf_storage_path
                                ? "PDF will be generated in a later release"
                                : undefined
                            }
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            View PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: "emerald" | "amber" | "red"
}) {
  const toneText =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-300"
        : tone === "red"
          ? "text-red-600 dark:text-red-300"
          : "text-foreground"

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {icon}
        </div>
        <p className={`text-2xl font-semibold mt-1 ${toneText}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

