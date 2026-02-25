"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  FileText,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Mail,
  Globe,
  Send,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function VisaInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Visa Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to manage visa invitation letter requests for international attendees</p>
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
                  <p className="font-medium">Add Visa Request</p>
                  <p className="text-sm text-muted-foreground">Create a new visa request for an international attendee who needs an invitation letter</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Enter Passport Details</p>
                  <p className="text-sm text-muted-foreground">Fill in passport number, nationality, and travel dates for the letter</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Generate Letter</p>
                  <p className="text-sm text-muted-foreground">Generate the official invitation letter with event and attendee details</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Send via Email</p>
                  <p className="text-sm text-muted-foreground">Email the generated letter directly to the attendee for their visa application</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/visa`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Visa Requests
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Request Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Request Statuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>
                  <span className="text-sm">Request received, letter not yet generated</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Generated</Badge>
                  <span className="text-sm">Letter has been generated and is ready to send</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Sent</Badge>
                  <span className="text-sm">Letter has been emailed to the attendee</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Visa Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Invitation Letter Generation</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Auto-generate official invitation letters with event details, attendee info, and organizer signatures.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Foreign delegates need formal invitation letters for their visa applications
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Email Sending</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Send the generated invitation letter directly to the attendee via email with one click.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Quickly deliver letters to multiple international attendees
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Request Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Track each request from submission through generation to delivery. Know exactly where each request stands.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Follow up on pending requests and ensure no one is missed
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
                <span className="text-sm">Start processing requests <strong>at least 2-3 months</strong> before the event for visa processing time</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Verify <strong>passport details carefully</strong> — errors in the letter can delay visa applications</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Include <strong>complete event details</strong> (venue, dates, purpose) as embassies require specifics</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Keep the <strong>sent status updated</strong> so you can track which attendees have received their letters</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Follow up with attendees who have been <strong>pending for more than a week</strong> for missing details</span>
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
                <p className="font-medium text-sm text-amber-800">Letter generation failing?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure all required fields are filled: full name, passport number, nationality, and travel dates.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Email not being received?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Check the email address is correct. The letter may end up in spam — ask the attendee to check their spam folder.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Need to update a sent letter?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Update the attendee details and regenerate the letter. Then resend via email with the corrected version.
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
              <Link href={`/events/${eventId}/visa`}>
                <Button variant="outline" size="sm">
                  <Globe className="h-4 w-4 mr-2" />
                  Visa Requests
                </Button>
              </Link>
              <Link href={`/events/${eventId}/registrations`}>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Registrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
