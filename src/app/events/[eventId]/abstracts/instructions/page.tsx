"use client"

import { useParams } from "next/navigation"
import {
  BookOpen,
  FileText,
  CheckSquare,
  Settings,
  Mail,
  ExternalLink,
  Clock,
} from "lucide-react"

export default function InstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Abstract Management Guide</h1>
        <p className="text-muted-foreground mt-1">
          Learn how to set up and manage abstract submissions for your event
        </p>
      </div>

      {/* Quick Setup */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Quick Setup Checklist
        </h2>
        <div className="space-y-3">
          {[
            { step: 1, text: "Create abstract categories (e.g., Free Paper, Video, Poster)" },
            { step: 2, text: "Configure settings: deadlines, word limits, presentation types" },
            { step: 3, text: "Set submission guidelines to display to authors" },
            { step: 4, text: "Share the submission link with your delegates" },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-sm flex items-center justify-center font-medium">
                {item.step}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Abstract Workflow
        </h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-semibold">Submitted</h3>
              <p className="text-sm text-muted-foreground">Author submits abstract through the public form. They receive a confirmation email with their abstract number.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-semibold">Under Review</h3>
              <p className="text-sm text-muted-foreground">Reviewers score the abstract on criteria like Originality, Methodology, Relevance, and Clarity (1-10 scale).</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-semibold">Decision</h3>
              <p className="text-sm text-muted-foreground">Scientific committee reviews scores and makes final decision: Accept (as oral/poster/video), Reject, or Request Revision.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">4</div>
            <div>
              <h3 className="font-semibold">Notification</h3>
              <p className="text-sm text-muted-foreground">Author receives email notification of decision. Accepted abstracts can be assigned to program sessions.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Categories
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Categories help organize submissions by type or track.
          </p>
          <ul className="text-sm space-y-2">
            <li>• <strong>Free Paper</strong> - Original research presentations</li>
            <li>• <strong>Video</strong> - Surgical/procedure videos</li>
            <li>• <strong>Poster/ePoster</strong> - Digital poster presentations</li>
            <li>• <strong>Young Scholar</strong> - For students and residents</li>
            <li>• <strong>Case Report</strong> - Interesting clinical cases</li>
          </ul>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Review Scoring
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Reviewers score abstracts on four criteria (1-10 scale):
          </p>
          <ul className="text-sm space-y-2">
            <li>• <strong>Originality</strong> - Novelty of the research</li>
            <li>• <strong>Methodology</strong> - Quality of methods used</li>
            <li>• <strong>Relevance</strong> - Importance to the field</li>
            <li>• <strong>Clarity</strong> - Quality of writing/presentation</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-4">
            Overall score is calculated as the average of all criteria.
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Settings
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Configure these settings before opening submissions:
          </p>
          <ul className="text-sm space-y-2">
            <li>• Submission open/close dates</li>
            <li>• Word limit for abstracts</li>
            <li>• Maximum submissions per author</li>
            <li>• Allowed presentation types</li>
            <li>• File upload requirements</li>
            <li>• Registration requirement</li>
          </ul>
        </div>

        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Notifications
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Automatic emails are sent to authors:
          </p>
          <ul className="text-sm space-y-2">
            <li>• <strong>On Submission</strong> - Confirmation with abstract number</li>
            <li>• <strong>On Decision</strong> - Acceptance/rejection notification</li>
            <li>• <strong>Revision Request</strong> - Instructions for revisions</li>
            <li>• <strong>Session Assignment</strong> - Presentation details</li>
          </ul>
        </div>
      </div>

      {/* Public Submission Link */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          Public Submission Link
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Share this link with your delegates to allow abstract submissions:
        </p>
        <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
          {typeof window !== "undefined" && `${window.location.origin}/events/${eventId}/submit-abstract`}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Authors will need to enter their registered email to submit.
        </p>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <BookOpen className="h-5 w-5" />
          Best Practices
        </h2>
        <ul className="text-sm space-y-2 text-amber-800 dark:text-amber-300">
          <li>• Set clear deadlines and communicate them well in advance</li>
          <li>• Enable blind review for unbiased scoring (hides author names from reviewers)</li>
          <li>• Aim for at least 2 reviewers per abstract for balanced evaluation</li>
          <li>• Use consistent criteria across all reviewers</li>
          <li>• Send decision notifications at least 4-6 weeks before the event</li>
          <li>• Have a clear policy for late submissions and withdrawals</li>
        </ul>
      </div>
    </div>
  )
}
