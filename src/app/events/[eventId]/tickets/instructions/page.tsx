"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  Ticket,
  Plus,
  Settings,
  EyeOff,
  Clock,
  Users,
  FileText,
  Shield,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function TicketInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Ticket Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to create and manage tickets for your event</p>
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
                  <p className="font-medium">Create a Ticket Type</p>
                  <p className="text-sm text-muted-foreground">Click &quot;New Ticket&quot; to create your first ticket type (e.g., Early Bird, Regular, VIP)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Set Price & Availability</p>
                  <p className="text-sm text-muted-foreground">Configure pricing, GST, quantity limits, and sale dates</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Activate the Ticket</p>
                  <p className="text-sm text-muted-foreground">Toggle the ticket status to &quot;Active&quot; to start selling</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Share Registration Link</p>
                  <p className="text-sm text-muted-foreground">Use the Preview button to get your public registration page URL</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/tickets`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Understanding Ticket Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                  <span className="text-sm">Ticket is on sale and visible to attendees</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Paused</Badge>
                  <span className="text-sm">Temporarily hidden from sale, can be reactivated</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Draft</Badge>
                  <span className="text-sm">Not yet published, still being configured</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20">Sold Out</Badge>
                  <span className="text-sm">All available tickets have been purchased</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Explained */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Ticket Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* Hidden Tickets */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Hidden Tickets</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Hidden tickets are not shown on the public registration page. They can only be accessed via a direct link.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> VIP tickets, speaker passes, sponsor complimentary passes
                </div>
              </div>

              {/* Sale Period */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Sale Period</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Set start and end dates to control when tickets are available for purchase.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Early bird pricing that ends on a specific date
                </div>
              </div>

              {/* Quantity Limits */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Quantity Controls</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Control total availability and per-order limits (min/max).
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Total:</strong> Leave blank for unlimited | <strong>Per Order:</strong> Typically 1-10
                </div>
              </div>

              {/* Exclusivity Groups */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Exclusivity Groups</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Tickets in the same exclusivity group are mutually exclusive - only one can be selected per order.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Exam specialties (Surgery vs Gynecology) where attendee must choose one
                </div>
              </div>

              {/* Registration Forms */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Registration Forms</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Attach a custom form to collect additional information when a specific ticket is selected.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Workshop preferences, dietary requirements, size selections
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
                <span className="text-sm">Create <strong>Early Bird tickets</strong> with lower prices and earlier end dates to incentivize early registration</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Use <strong>descriptive names</strong> that clearly indicate what&apos;s included (e.g., &quot;Full Conference + Workshop&quot; vs just &quot;VIP&quot;)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Set <strong>quantity limits</strong> to manage capacity and create urgency</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Include <strong>GST in pricing</strong> to avoid confusion at checkout</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Test your <strong>registration flow</strong> using the Preview button before going live</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Common Issues */}
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
                <p className="font-medium text-sm text-amber-800">Ticket not showing on registration page?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Check: 1) Status is &quot;Active&quot;, 2) Not marked as &quot;Hidden&quot;, 3) Current date is within sale period
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Price showing differently than expected?</p>
                <p className="text-xs text-amber-700 mt-1">
                  The displayed price includes GST. Check your GST percentage setting.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Oversold tickets?</p>
                <p className="text-xs text-amber-700 mt-1">
                  This can happen with manual registrations. Monitor the &quot;Available&quot; count and adjust quantity if needed.
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
              <Link href={`/events/${eventId}/tickets`}>
                <Button variant="outline" size="sm">
                  <Ticket className="h-4 w-4 mr-2" />
                  Manage Tickets
                </Button>
              </Link>
              <Link href={`/events/${eventId}/tickets/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Ticket Settings
                </Button>
              </Link>
              <Link href={`/events/${eventId}/forms`}>
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Registration Forms
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
