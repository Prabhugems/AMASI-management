"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  ClipboardList,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Send,
  BarChart3,
  Users,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function SurveysInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Surveys Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to create and manage event feedback surveys</p>
      </div>

      <div className="space-y-6">
        {/* Quick Start */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <p className="font-medium">Create a Survey Form</p>
                  <p className="text-sm text-muted-foreground">Use the form builder to create your feedback survey with questions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Link to Event</p>
                  <p className="text-sm text-muted-foreground">Associate the survey with your event so it targets the right attendees</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Send to Attendees</p>
                  <p className="text-sm text-muted-foreground">Distribute the survey via email or WhatsApp to all registered attendees</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Track Responses</p>
                  <p className="text-sm text-muted-foreground">Monitor response rates and view collected feedback in real time</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/surveys`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Survey
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Survey Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Auto-Skip Responded Attendees</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  When sending reminders, attendees who have already responded are automatically skipped.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Send reminder emails without annoying people who already completed the survey
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Response Rate Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  See real-time response rates per survey — how many were sent vs how many responded.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Decide when to send reminders based on current response rates
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Form Builder Integration</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Surveys use the built-in form builder — create custom questions with multiple field types.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Mix ratings, text fields, and multiple choice for comprehensive feedback
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Multi-Channel Distribution</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Send surveys via email or WhatsApp to maximize response rates.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Send email first, then WhatsApp reminder to non-responders
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Send surveys <strong>within 24-48 hours</strong> after the event while the experience is fresh</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Keep surveys <strong>short and focused</strong> — 5-10 questions get the best completion rates</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Include a mix of <strong>rating scales and open-ended questions</strong> for both quantitative and qualitative feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Send a <strong>reminder after 3-5 days</strong> to boost response rates (non-responders only)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Use <strong>WhatsApp for reminders</strong> as it tends to get higher open rates than email</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Troubleshooting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Survey not sending to all attendees?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Only confirmed registrations receive surveys. Check that attendees have valid email addresses or phone numbers.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Low response rate?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Try sending a WhatsApp reminder. Also check if the survey link is working correctly by testing it yourself.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Form not linked to survey?</p>
                <p className="text-xs text-amber-700 mt-1">
                  When creating a survey, make sure you select an existing form. Create the form first in the Forms section if needed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Link href={`/events/${eventId}/surveys`}>
                <Button variant="outline" size="sm">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Manage Surveys
                </Button>
              </Link>
              <Link href={`/events/${eventId}/forms`}>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Form Builder
                </Button>
              </Link>
              <Link href={`/events/${eventId}/registrations`}>
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  View Registrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
