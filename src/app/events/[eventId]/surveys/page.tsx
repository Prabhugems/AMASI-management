"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Send,
  ExternalLink,
  ClipboardList,
  BarChart3,
  BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Survey = {
  id: string
  title: string
  description: string | null
  form_type: string
  status: string
  slug: string | null
  submission_count: number
  created_at: string
}

type ResponseRate = {
  totalAttendees: number
  surveys: Array<{
    form_id: string
    title: string
    submissions: number
    totalAttendees: number
    responseRate: number
  }>
}

export default function SurveysPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [form, setForm] = useState({ title: "", description: "" })

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["surveys", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/surveys`)
      if (!res.ok) throw new Error("Failed to fetch surveys")
      return res.json() as Promise<Survey[]>
    },
  })

  const { data: responseRates } = useQuery({
    queryKey: ["survey-response-rates", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/surveys/response-rate`)
      if (!res.ok) throw new Error("Failed to fetch response rates")
      return res.json() as Promise<ResponseRate>
    },
  })

  const createSurvey = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/events/${eventId}/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create survey")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Survey created. Add questions in the Form Builder.")
      queryClient.invalidateQueries({ queryKey: ["surveys", eventId] })
      setShowCreateDialog(false)
      setForm({ title: "", description: "" })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const sendSurvey = useMutation({
    mutationFn: async (formId: string) => {
      const res = await fetch(`/api/events/${eventId}/surveys/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to send")
      }
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || "Survey sent")
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const getRateForSurvey = (formId: string) => {
    return responseRates?.surveys.find((s) => s.form_id === formId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Surveys</h1>
          <p className="text-muted-foreground">Collect feedback from attendees</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/events/${eventId}/surveys/instructions`}>
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4 mr-2" />
              How to Use
            </Button>
          </Link>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Survey
          </Button>
        </div>
      </div>

      {/* Response Rate Overview */}
      {responseRates && responseRates.surveys.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Attendees</p>
            <p className="text-2xl font-bold">{responseRates.totalAttendees}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Surveys</p>
            <p className="text-2xl font-bold">{responseRates.surveys.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Avg Response Rate</p>
            <p className="text-2xl font-bold">
              {responseRates.surveys.length > 0
                ? Math.round(
                    responseRates.surveys.reduce((a, b) => a + b.responseRate, 0) /
                      responseRates.surveys.length
                  )
                : 0}
              %
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!surveys || surveys.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Surveys Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a survey to collect feedback from your attendees
          </p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Survey
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Responses</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {surveys.map((survey) => {
                const rate = getRateForSurvey(survey.id)
                return (
                  <TableRow key={survey.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{survey.title}</p>
                        {survey.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{survey.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-white capitalize",
                          survey.status === "published" ? "bg-green-500" : survey.status === "draft" ? "bg-amber-500" : "bg-gray-500"
                        )}
                      >
                        {survey.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{survey.submission_count}</TableCell>
                    <TableCell className="text-right font-mono">
                      {rate ? `${rate.responseRate}%` : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(survey.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/forms/${survey.id}`}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Edit in Form Builder
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/forms/${survey.id}/responses`}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Responses
                            </Link>
                          </DropdownMenuItem>
                          {survey.status === "published" && (
                            <DropdownMenuItem
                              onClick={() => sendSurvey.mutate(survey.id)}
                              disabled={sendSurvey.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Send to Attendees
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Survey Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Survey</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Post-Event Feedback Survey"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief description of the survey..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createSurvey.mutate(form)}
              disabled={createSurvey.isPending || !form.title.trim()}
            >
              {createSurvey.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
