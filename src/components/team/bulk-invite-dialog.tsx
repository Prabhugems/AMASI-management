"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle, Users } from "lucide-react"
import { toast } from "sonner"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = ["admin", "coordinator", "travel"]

type ParsedRow = {
  name: string
  email: string
  role: string
  valid: boolean
  error?: string
}

type InviteResult = {
  email: string
  status: "sent" | "duplicate" | "exists" | "invalid" | "error"
  reason?: string
}

type Step = "input" | "preview" | "sending" | "results"

export function BulkInviteDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}) {
  const [step, setStep] = useState<Step>("input")
  const [csvText, setCsvText] = useState("")
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<InviteResult[]>([])
  const [isSending, setIsSending] = useState(false)

  const reset = () => {
    setStep("input")
    setCsvText("")
    setParsedRows([])
    setResults([])
    setIsSending(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) reset()
    onOpenChange(open)
  }

  const parseCSV = () => {
    const lines = csvText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) {
      toast.error("No data to parse")
      return
    }

    // Detect if first line is a header
    const firstLine = lines[0].toLowerCase()
    const startIndex =
      firstLine.includes("name") && firstLine.includes("email") ? 1 : 0

    const rows: ParsedRow[] = []
    const seenEmails = new Set<string>()

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]
      // Support comma and tab separators
      const parts = line.includes("\t")
        ? line.split("\t").map((p) => p.trim())
        : line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""))

      const name = parts[0] || ""
      const email = (parts[1] || "").toLowerCase()
      const role = (parts[2] || "coordinator").toLowerCase()

      let valid = true
      let error: string | undefined

      if (!name) {
        valid = false
        error = "Name is required"
      } else if (!email || !EMAIL_REGEX.test(email)) {
        valid = false
        error = "Invalid email"
      } else if (seenEmails.has(email)) {
        valid = false
        error = "Duplicate in list"
      } else if (role && !VALID_ROLES.includes(role)) {
        valid = false
        error = `Invalid role "${role}"`
      }

      if (email) seenEmails.add(email)

      rows.push({
        name,
        email,
        role: VALID_ROLES.includes(role) ? role : "coordinator",
        valid,
        error,
      })
    }

    setParsedRows(rows)
    setStep("preview")
  }

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.valid),
    [parsedRows]
  )
  const invalidRows = useMemo(
    () => parsedRows.filter((r) => !r.valid),
    [parsedRows]
  )

  const sendInvites = async () => {
    if (validRows.length === 0) {
      toast.error("No valid rows to send")
      return
    }

    setIsSending(true)
    setStep("sending")

    try {
      const res = await fetch("/api/team/invite/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: validRows.map((r) => ({
            email: r.email,
            name: r.name,
            role: r.role,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Request failed")
      }

      const data = await res.json()
      setResults(data.results || [])
      setStep("results")

      const sent = (data.results || []).filter(
        (r: InviteResult) => r.status === "sent"
      ).length
      if (sent > 0) {
        toast.success(`${sent} invitation${sent > 1 ? "s" : ""} sent successfully`)
        onComplete?.()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invites")
      setStep("preview")
    } finally {
      setIsSending(false)
    }
  }

  const resultCounts = useMemo(() => {
    const counts = { sent: 0, duplicate: 0, exists: 0, invalid: 0, error: 0 }
    for (const r of results) {
      counts[r.status] = (counts[r.status] || 0) + 1
    }
    return counts
  }, [results])

  const statusConfig: Record<
    string,
    { label: string; color: string; icon: typeof CheckCircle }
  > = {
    sent: { label: "Sent", color: "bg-green-100 text-green-800", icon: CheckCircle },
    duplicate: { label: "Duplicate", color: "bg-amber-100 text-amber-800", icon: AlertCircle },
    exists: { label: "Exists", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
    invalid: { label: "Invalid", color: "bg-red-100 text-red-800", icon: XCircle },
    error: { label: "Error", color: "bg-red-100 text-red-800", icon: XCircle },
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Invite Team Members
          </DialogTitle>
          <DialogDescription>
            Paste CSV data with columns: Name, Email, Role (admin / coordinator / travel)
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: CSV Input */}
        {step === "input" && (
          <div className="space-y-4">
            <Textarea
              placeholder={`John Doe, john@example.com, coordinator\nJane Smith, jane@example.com, admin\n...`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Separate columns with commas or tabs. First row is skipped if it looks like a header.
              Role defaults to &quot;coordinator&quot; if omitted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={parseCSV} disabled={!csvText.trim()}>
                <Upload className="h-4 w-4 mr-2" />
                Parse
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {validRows.length} valid
              </Badge>
              {invalidRows.length > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {invalidRows.length} invalid
                </Badge>
              )}
              <span className="text-muted-foreground">
                {validRows.length} invite{validRows.length !== 1 ? "s" : ""} will be sent
              </span>
            </div>

            <div className="overflow-auto max-h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow
                      key={i}
                      className={row.valid ? "" : "bg-red-50/50"}
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium">{row.name || "-"}</TableCell>
                      <TableCell className="text-sm">{row.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {row.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.valid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-xs text-red-600">{row.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={sendInvites} disabled={validRows.length === 0}>
                  Send {validRows.length} Invite{validRows.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Sending */}
        {step === "sending" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-sm text-muted-foreground">
              Sending {validRows.length} invitation{validRows.length !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === "results" && (
          <div className="space-y-4 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              {resultCounts.sent > 0 && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {resultCounts.sent} sent
                </Badge>
              )}
              {resultCounts.duplicate > 0 && (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {resultCounts.duplicate} duplicate
                </Badge>
              )}
              {resultCounts.exists > 0 && (
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {resultCounts.exists} already members
                </Badge>
              )}
              {resultCounts.error > 0 && (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  {resultCounts.error} failed
                </Badge>
              )}
            </div>

            <div className="overflow-auto max-h-[400px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => {
                    const cfg = statusConfig[r.status] || statusConfig.error
                    const Icon = cfg.icon
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{r.email}</TableCell>
                        <TableCell>
                          <Badge className={cfg.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.reason || "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
