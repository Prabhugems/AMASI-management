"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  FileText,
  Users,
  UserCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  MessageSquare,
  Award,
  ArrowRight,
  ArrowDown,
  AlertCircle,
  Mail,
  ClipboardCheck,
  Presentation,
  ChevronRight,
  BookOpen,
  Settings,
  BarChart3,
  Shuffle,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  XCircle,
  HelpCircle,
  Target,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Workflow stages configuration
const workflowStages = [
  {
    id: "submission",
    title: "Submission",
    icon: FileText,
    color: "bg-blue-500",
    description: "Delegates submit their abstracts through the public submission portal",
    status: "submission",
    details: [
      "Author fills 6-step submission form",
      "Uploads supporting files (PDF, images, videos)",
      "Auto-save drafts every 30 seconds",
      "Receives confirmation email on submission",
    ],
  },
  {
    id: "review",
    title: "Peer Review",
    icon: Eye,
    color: "bg-purple-500",
    description: "Assigned reviewers evaluate abstracts based on scientific criteria",
    status: "under_review",
    details: [
      "Abstracts assigned to 2-3 reviewers",
      "Blind review (author info hidden)",
      "Scoring based on category criteria",
      "Reviewers submit recommendations",
    ],
  },
  {
    id: "committee",
    title: "Committee Decision",
    icon: Users,
    color: "bg-amber-500",
    description: "Scientific committee reviews scores and makes final decisions",
    status: "review_complete",
    details: [
      "Committee sees aggregated review scores",
      "Can accept, reject, or request second review",
      "Assigns presentation type (oral/poster/video)",
      "Decision logged with notes",
    ],
  },
  {
    id: "scheduling",
    title: "Program Scheduling",
    icon: Calendar,
    color: "bg-green-500",
    description: "Accepted abstracts are assigned to sessions and time slots",
    status: "accepted",
    details: [
      "Assign to specific session",
      "Set date, time, and venue",
      "Allocate poster board numbers",
      "Generate program schedule",
    ],
  },
  {
    id: "notification",
    title: "Communication",
    icon: Mail,
    color: "bg-cyan-500",
    description: "Authors notified of decisions and presentation details",
    status: "notified",
    details: [
      "Acceptance/rejection emails sent",
      "Schedule details communicated",
      "Upload reminders for presentations",
      "Registration verification notices",
    ],
  },
  {
    id: "presentation",
    title: "Conference Day",
    icon: Presentation,
    color: "bg-rose-500",
    description: "Presenters check-in and deliver their presentations",
    status: "ready",
    details: [
      "Verify presenter registration",
      "Check-in at speaker desk",
      "Mark presentation as completed",
      "Award nominations processed",
    ],
  },
]

// Role cards
const roles = [
  {
    title: "Delegate / Author",
    icon: FileText,
    color: "text-blue-600 bg-blue-50",
    responsibilities: [
      "Submit abstracts via public portal",
      "Upload supporting documents",
      "Track submission status",
      "Complete registration",
      "Present at the conference",
    ],
    accessPoint: "Public submission link",
  },
  {
    title: "Reviewer",
    icon: Eye,
    color: "text-purple-600 bg-purple-50",
    responsibilities: [
      "Review assigned abstracts",
      "Score based on criteria",
      "Provide recommendations",
      "Submit reviews before deadline",
      "Request reassignment if conflicted",
    ],
    accessPoint: "Token-based reviewer portal",
  },
  {
    title: "Committee Member",
    icon: Users,
    color: "text-amber-600 bg-amber-50",
    responsibilities: [
      "Review aggregated scores",
      "Make accept/reject decisions",
      "Send for second review if needed",
      "Assign presentation types",
      "Handle appeals",
    ],
    accessPoint: "Committee dashboard",
  },
  {
    title: "Event Admin",
    icon: Settings,
    color: "text-green-600 bg-green-50",
    responsibilities: [
      "Configure submission settings",
      "Manage reviewer pool",
      "Assign reviewers to abstracts",
      "Schedule presentations",
      "Send bulk notifications",
    ],
    accessPoint: "Admin dashboard",
  },
]

// Status badges configuration
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  draft: { label: "Draft", variant: "outline", color: "text-gray-500" },
  submitted: { label: "Submitted", variant: "secondary", color: "text-blue-600" },
  under_review: { label: "Under Review", variant: "default", color: "text-purple-600" },
  review_complete: { label: "Review Complete", variant: "secondary", color: "text-amber-600" },
  accepted: { label: "Accepted", variant: "default", color: "text-green-600" },
  rejected: { label: "Rejected", variant: "destructive", color: "text-red-600" },
  revision_requested: { label: "Revision Requested", variant: "outline", color: "text-orange-600" },
  withdrawn: { label: "Withdrawn", variant: "outline", color: "text-gray-500" },
}

// Committee decisions
const committeeDecisions = [
  {
    decision: "Accept - Oral Presentation",
    description: "Abstract approved for oral presentation in a scientific session",
    icon: Presentation,
    color: "text-green-600",
  },
  {
    decision: "Accept - Poster Presentation",
    description: "Abstract approved for poster presentation",
    icon: FileText,
    color: "text-green-600",
  },
  {
    decision: "Accept - Video Presentation",
    description: "Abstract approved for video presentation",
    icon: Eye,
    color: "text-green-600",
  },
  {
    decision: "Second Review",
    description: "Additional review required before final decision",
    icon: Clock,
    color: "text-amber-600",
  },
  {
    decision: "Reject",
    description: "Abstract does not meet acceptance criteria",
    icon: AlertCircle,
    color: "text-red-600",
  },
]

export default function AbstractWorkflowGuidePage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/events/${eventId}`} className="hover:text-foreground">
            Event
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/events/${eventId}/abstracts`} className="hover:text-foreground">
            Abstracts
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Workflow Guide</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Abstract Workflow Guide</h1>
            <p className="text-muted-foreground mt-1">
              Complete guide to the abstract submission, review, and presentation workflow
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="workflow" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="statuses">Statuses</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        {/* Workflow Tab */}
        <TabsContent value="workflow" className="space-y-8">
          {/* Visual Workflow */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Workflow Stages
              </CardTitle>
              <CardDescription>
                Follow the journey of an abstract from submission to presentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop Timeline */}
              <div className="hidden lg:block">
                <div className="relative">
                  {/* Connection Line */}
                  <div className="absolute top-8 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-amber-500 via-green-500 via-cyan-500 to-rose-500 rounded-full" />

                  {/* Stages */}
                  <div className="grid grid-cols-6 gap-4 relative">
                    {workflowStages.map((stage, index) => (
                      <div key={stage.id} className="flex flex-col items-center">
                        <div className={`w-16 h-16 rounded-full ${stage.color} flex items-center justify-center text-white shadow-lg z-10 ring-4 ring-white`}>
                          <stage.icon className="h-7 w-7" />
                        </div>
                        <div className="mt-4 text-center">
                          <h3 className="font-semibold text-sm">{stage.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {stage.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile/Tablet Vertical Timeline */}
              <div className="lg:hidden space-y-6">
                {workflowStages.map((stage, index) => (
                  <div key={stage.id} className="relative">
                    {index < workflowStages.length - 1 && (
                      <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-full ${stage.color} flex items-center justify-center text-white shadow-lg z-10 shrink-0`}>
                        <stage.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 pb-6">
                        <h3 className="font-semibold">{stage.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {stage.description}
                        </p>
                        <ul className="mt-3 space-y-1">
                          {stage.details.map((detail, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Stage Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {workflowStages.map((stage) => (
              <Card key={stage.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${stage.color}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${stage.color} flex items-center justify-center text-white`}>
                      <stage.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{stage.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {stage.description}
                  </p>
                  <ul className="space-y-2">
                    {stage.details.map((detail, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Committee Decisions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                Committee Decision Types
              </CardTitle>
              <CardDescription>
                Possible outcomes when the scientific committee reviews an abstract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {committeeDecisions.map((item) => (
                  <div
                    key={item.decision}
                    className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                  >
                    <item.icon className={`h-5 w-5 ${item.color} shrink-0 mt-0.5`} />
                    <div>
                      <h4 className="font-medium text-sm">{item.decision}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignment Tab - Auto-matching, Decline, Reassignment, Category Mismatch */}
        <TabsContent value="assignment" className="space-y-6">
          {/* Auto-Matching Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Intelligent Reviewer Auto-Matching
              </CardTitle>
              <CardDescription>
                System automatically matches reviewers to abstracts based on expertise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg border bg-gradient-to-br from-amber-50 to-orange-50">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-amber-600" />
                    How Matching Works
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span><strong>Keywords Match:</strong> Abstract keywords compared to reviewer expertise areas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span><strong>Category Expertise:</strong> Reviewers with experience in the abstract&apos;s category score higher</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span><strong>Workload Balance:</strong> Reviewers with capacity get priority</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span><strong>Track Record:</strong> Experienced, fast reviewers get bonus points</span>
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-indigo-50">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-purple-600" />
                    Match Score Calculation
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Keyword Match (each)</span>
                      <Badge variant="secondary">+30 pts</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Category Expertise</span>
                      <Badge variant="secondary">+25 pts</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Title Word Match</span>
                      <Badge variant="secondary">+15 pts</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>High Capacity Available</span>
                      <Badge variant="secondary">+20 pts</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>10+ Reviews Completed</span>
                      <Badge variant="secondary">+10 pts</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Fast Reviewer (&lt;24h avg)</span>
                      <Badge variant="secondary">+5 pts</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-2">Match Levels</h4>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm"><strong>High Match:</strong> 50+ points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm"><strong>Medium Match:</strong> 25-49 points</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm"><strong>Low Match:</strong> &lt;25 points</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reviewer Actions Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-blue-500" />
                Reviewer Actions & Reassignment
              </CardTitle>
              <CardDescription>
                What happens when a reviewer cannot review an assigned abstract
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Decline Flow */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                      <XCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Reviewer Declines Assignment</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        When a reviewer cannot review due to conflict of interest, time constraints, or other reasons
                      </p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">Reviewer declines</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">Committee notified</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">New reviewer assigned</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Flag Mismatch Flow */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Reviewer Flags Expertise Mismatch</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reviewer can flag when abstract doesn&apos;t match their expertise or seems miscategorized
                      </p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">Reviewer flags</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">Committee reviews</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">Category changed or reassigned</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extension Request Flow */}
                <div className="p-4 rounded-lg border">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">Reviewer Requests Extension</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reviewer needs more time to complete the review
                      </p>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">Extension requested</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">Committee approves</Badge>
                        <ArrowRight className="h-4 w-4" />
                        <Badge variant="outline">New deadline set</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Mismatch Handling */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 text-orange-500" />
                Category Mismatch Handling
              </CardTitle>
              <CardDescription>
                When an abstract is submitted to the wrong category
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Who Can Flag Category Issues?</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <Eye className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <span><strong>Reviewers:</strong> Flag during review if abstract doesn&apos;t fit assigned category</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <span><strong>Committee:</strong> Identify during decision-making phase</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Settings className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span><strong>Admin:</strong> Change category at any stage</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">What Happens Next?</h4>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    <li>Abstract flagged with mismatch reason</li>
                    <li>Committee receives notification</li>
                    <li>Committee reviews suggested category</li>
                    <li>If category changed, new reviewers assigned</li>
                    <li>Author may be notified of category change</li>
                  </ol>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-orange-50 border border-orange-200">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800">Important Note</h4>
                    <p className="text-sm text-orange-700 mt-1">
                      When a category is changed, the existing reviews remain valid if scoring criteria are compatible.
                      Otherwise, the abstract is re-assigned to new reviewers with expertise in the new category.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Committee Reassignment Powers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                Committee Reassignment Powers
              </CardTitle>
              <CardDescription>
                Actions available to the scientific committee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="h-6 w-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold">Reassign Reviewer</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Replace a reviewer who declined or flagged with a better-matched expert
                  </p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                    <Shuffle className="h-6 w-6 text-amber-600" />
                  </div>
                  <h4 className="font-semibold">Change Category</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Move abstract to a more appropriate category when flagged
                  </p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold">Approve Extensions</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Grant additional time for reviewers who request it
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {roles.map((role) => (
              <Card key={role.title}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg ${role.color} flex items-center justify-center`}>
                      <role.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle>{role.title}</CardTitle>
                      <CardDescription>{role.accessPoint}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="text-sm font-medium mb-3">Responsibilities:</h4>
                  <ul className="space-y-2">
                    {role.responsibilities.map((resp, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Role Interaction Diagram */}
          <Card>
            <CardHeader>
              <CardTitle>Role Interactions</CardTitle>
              <CardDescription>
                How different roles interact during the abstract workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative p-8 bg-muted/30 rounded-lg">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
                  {/* Delegate */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                      <FileText className="h-8 w-8 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium">Delegate</span>
                    <p className="text-xs text-muted-foreground">Submits</p>
                  </div>

                  <ArrowRight className="h-6 w-6 text-gray-400 hidden md:block" />
                  <ArrowDown className="h-6 w-6 text-gray-400 md:hidden" />

                  {/* Reviewer */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                      <Eye className="h-8 w-8 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium">Reviewer</span>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>

                  <ArrowRight className="h-6 w-6 text-gray-400 hidden md:block" />
                  <ArrowDown className="h-6 w-6 text-gray-400 md:hidden" />

                  {/* Committee */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                      <Users className="h-8 w-8 text-amber-600" />
                    </div>
                    <span className="text-sm font-medium">Committee</span>
                    <p className="text-xs text-muted-foreground">Decides</p>
                  </div>

                  <ArrowRight className="h-6 w-6 text-gray-400 hidden md:block" />
                  <ArrowDown className="h-6 w-6 text-gray-400 md:hidden" />

                  {/* Admin */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                      <Settings className="h-8 w-8 text-green-600" />
                    </div>
                    <span className="text-sm font-medium">Admin</span>
                    <p className="text-xs text-muted-foreground">Schedules</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statuses Tab */}
        <TabsContent value="statuses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Abstract Status Reference</CardTitle>
              <CardDescription>
                All possible statuses an abstract can have during its lifecycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Status Transitions */}
          <Card>
            <CardHeader>
              <CardTitle>Status Transitions</CardTitle>
              <CardDescription>
                Valid status transitions during the workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline">Draft</Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge variant="secondary">Submitted</Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge>Under Review</Badge>
                  <ArrowRight className="h-4 w-4" />
                  <Badge variant="secondary">Review Complete</Badge>
                </div>
                <div className="flex items-center gap-3 flex-wrap pl-8">
                  <span className="text-sm text-muted-foreground">Then:</span>
                  <Badge className="bg-green-600">Accepted</Badge>
                  <span className="text-sm text-muted-foreground">or</span>
                  <Badge variant="destructive">Rejected</Badge>
                  <span className="text-sm text-muted-foreground">or</span>
                  <Badge variant="outline">Revision Requested</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Actions Tab */}
        <TabsContent value="actions" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">View All Abstracts</h3>
                      <p className="text-sm text-muted-foreground">
                        Browse and manage submissions
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts/committee`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Committee Queue</h3>
                      <p className="text-sm text-muted-foreground">
                        Review pending decisions
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts/reviewers`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <UserCheck className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Manage Reviewers</h3>
                      <p className="text-sm text-muted-foreground">
                        Reviewer pool & assignments
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts/presenter-checkin`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-rose-100 flex items-center justify-center">
                      <ClipboardCheck className="h-6 w-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Presenter Check-in</h3>
                      <p className="text-sm text-muted-foreground">
                        Conference day attendance
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts/settings`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Settings className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Submission Settings</h3>
                      <p className="text-sm text-muted-foreground">
                        Configure deadlines & rules
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Link href={`/events/${eventId}/abstracts/awards`}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <Award className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Awards</h3>
                      <p className="text-sm text-muted-foreground">
                        Best paper nominations
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Help Section */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Need Help?</h3>
                  <p className="text-muted-foreground mt-1">
                    If you have questions about the abstract workflow or need assistance,
                    please contact the conference organizing team.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Support
                    </Button>
                    <Button variant="ghost" size="sm">
                      View Documentation
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
