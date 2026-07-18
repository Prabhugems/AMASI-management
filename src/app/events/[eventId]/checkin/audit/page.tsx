"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"

type CheckinList = {
  id: string
  name: string
}

type AuditRow = {
  id: string
  created_at: string
  action: string
  performed_by: string | null
  performed_via: string | null
  error_message: string | null
  checkin_list_id: string | null
  checkin_lists: { name: string } | null
  registration_id: string | null
  registrations: { attendee_name: string; registration_number: string } | null
}

type AuditResponse = {
  data: AuditRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function CheckinAuditPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [checkinListId, setCheckinListId] = useState<string>("")
  const [page, setPage] = useState(1)

  const { data: checkinLists } = useQuery({
    queryKey: ["checkin-lists-audit-filter", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("id, name")
        .eq("event_id", eventId)
        .order("sort_order")
      return (data || []) as CheckinList[]
    },
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["checkin-audit", eventId, checkinListId, page],
    queryFn: async () => {
      const searchParams = new URLSearchParams({ event_id: eventId, page: String(page) })
      if (checkinListId) searchParams.set("checkin_list_id", checkinListId)
      const res = await fetch(`/api/checkin/audit?${searchParams}`)
      if (!res.ok) throw new Error("Failed to load audit log")
      return res.json() as Promise<AuditResponse>
    },
  })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Failed Scans</h1>
          <p className="text-muted-foreground">
            Check-in attempts that didn&apos;t succeed — a live view to catch a pattern (wrong list, expired
            link, repeated same error) before it snowballs during an event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={checkinListId}
            onChange={(e) => { setCheckinListId(e.target.value); setPage(1) }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All lists</option>
            {(checkinLists || []).map((list) => (
              <option key={list.id} value={list.id}>{list.name}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        {!data || data.data.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No failed scans</h3>
            <p className="text-sm text-muted-foreground">
              {checkinListId ? "None for this list." : "Nothing to see here — that's the goal."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Attendee</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Via</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatTime(row.created_at)}
                  </TableCell>
                  <TableCell>{row.checkin_lists?.name || "—"}</TableCell>
                  <TableCell>
                    {row.registrations
                      ? `${row.registrations.attendee_name} (#${row.registrations.registration_number})`
                      : <span className="text-muted-foreground">Unknown token</span>}
                  </TableCell>
                  <TableCell className="text-sm">{row.action}</TableCell>
                  <TableCell className="text-sm text-red-600">{row.error_message || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.performed_by || row.performed_via || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} · {data.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
