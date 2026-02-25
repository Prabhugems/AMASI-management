"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  ListOrdered,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Users,
  Bell,
  UserPlus,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function WaitlistInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Waitlist Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to manage the event waitlist and promote attendees</p>
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
                  <p className="font-medium">Waitlist Fills Automatically</p>
                  <p className="text-sm text-muted-foreground">When tickets sell out, new registrants are added to the waitlist automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">View Waitlist Entries</p>
                  <p className="text-sm text-muted-foreground">See all waiting attendees with their position, contact info, and join date</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Notify Users</p>
                  <p className="text-sm text-muted-foreground">When spots open up, notify waitlisted users that they can now register</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Promote to Registration</p>
                  <p className="text-sm text-muted-foreground">Convert waitlisted entries to confirmed registrations as capacity allows</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/waitlist`}>
                <Button>
                  <ListOrdered className="h-4 w-4 mr-2" />
                  View Waitlist
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Statuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Waitlist Statuses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Waiting</Badge>
                  <span className="text-sm">In the queue, waiting for a spot to open</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Notified</Badge>
                  <span className="text-sm">Notified that a spot is available, awaiting their response</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Converted</Badge>
                  <span className="text-sm">Successfully promoted to a confirmed registration</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Expired</Badge>
                  <span className="text-sm">Notification window expired without response</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Waitlist Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Position Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Each waitlisted entry has a position number based on when they joined. First come, first served.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Fairly manage who gets spots first when cancellations occur
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Promote to Registration</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Convert a waitlisted person directly to a confirmed attendee when space becomes available.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> A registered attendee cancels, promote the next person on the waitlist
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Notifications</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Send email or WhatsApp notifications to waitlisted users when spots open up.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Automatically let the next 5 people know that spots are available
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Bulk Actions</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Select multiple waitlist entries to notify, promote, or remove in bulk.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Promote the top 10 waitlisted people at once when you increase capacity
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
                <span className="text-sm">Process the waitlist <strong>in order</strong> — promote from the top to maintain fairness</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Set a <strong>response deadline</strong> when notifying — give 48-72 hours before moving to the next person</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Keep the waitlist <strong>clean</strong> by marking expired entries to avoid confusion</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Consider <strong>increasing capacity</strong> if the waitlist is very long — it shows strong demand</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Export the <strong>waitlist data</strong> for planning future events with higher capacity</span>
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
                <p className="font-medium text-sm text-amber-800">Waitlist not accepting new entries?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Check that the waitlist feature is enabled for the event and that tickets are actually sold out.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Notification not reaching the attendee?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Verify their email address or phone number. Check email delivery logs for any bounce-backs.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Promoted user can't complete registration?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure there is actually available capacity on the ticket. The promotion may fail if another ticket was sold in the meantime.
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
              <Link href={`/events/${eventId}/waitlist`}>
                <Button variant="outline" size="sm">
                  <ListOrdered className="h-4 w-4 mr-2" />
                  Manage Waitlist
                </Button>
              </Link>
              <Link href={`/events/${eventId}/tickets`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Ticket Settings
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
