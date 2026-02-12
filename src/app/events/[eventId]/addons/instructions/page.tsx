"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  Package,
  Plus,
  Settings,
  Users,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  ArrowRight,
  Layers,
  GraduationCap,
  Award,
  Ticket,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function AddonInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Add-on Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to create and manage add-ons for your event</p>
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
                  <p className="font-medium">Create an Add-on</p>
                  <p className="text-sm text-muted-foreground">Click "New Addon" to create items like workshops, meals, or merchandise</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Set Price & Variants</p>
                  <p className="text-sm text-muted-foreground">Configure pricing and add variants (like T-shirt sizes) if needed</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Link to Tickets</p>
                  <p className="text-sm text-muted-foreground">Choose which ticket types can purchase this add-on</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Activate</p>
                  <p className="text-sm text-muted-foreground">Toggle the add-on to active to make it available during registration</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/addons`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Add-on
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Add-on Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Types of Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* Simple Add-on */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Simple Add-on</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  A single item without variations. Price is the same for all.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Examples:</strong> Lunch, Parking Pass, Welcome Kit, Networking Dinner
                </div>
              </div>

              {/* Add-on with Variants */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="h-4 w-4 text-violet-500" />
                  <h4 className="font-medium">Add-on with Variants</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Items with multiple options like sizes, colors, or types.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Examples:</strong> T-shirt (S, M, L, XL), Workshop (Basic, Advanced), Meal Plan (Veg, Non-Veg)
                </div>
              </div>

              {/* Course Add-on */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="h-4 w-4 text-blue-500" />
                  <h4 className="font-medium">Course Add-on</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Workshop or training with separate certificate. Track participants separately.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Examples:</strong> Pre-conference Workshop, Skill Course, Certification Program
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Explained */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {/* Ticket Linking */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Ticket Linking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Link add-ons to specific ticket types. Only those ticket holders will see the add-on.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> VIP ticket holders can purchase exclusive lounge access
                </div>
              </div>

              {/* Max Quantity */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Quantity Limits</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Set maximum quantity per order to manage inventory or capacity.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Limit workshop seats to 50 per registration
                </div>
              </div>

              {/* Course Certificates */}
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Course Certificates</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Course add-ons can have separate certificates. Link a certificate template.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Issue separate certificate for workshop completion
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
                <span className="text-sm">Use <strong>clear names</strong> that describe what's included (e.g., "Conference Lunch - Day 1" vs just "Lunch")</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Add <strong>images</strong> for merchandise or physical items to increase conversions</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Use <strong>variants</strong> instead of multiple add-ons for items with size/type options</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Set <strong>quantity limits</strong> for items with limited availability</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Mark courses as <strong>Course Add-on</strong> for separate participant tracking and certificates</span>
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
                <p className="font-medium text-sm text-amber-800">Add-on not showing during registration?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Check: 1) Add-on is "Active", 2) If linked to tickets, check the ticket type is correct, 3) Registration page is refreshed
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Variants not appearing?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure "Add-on with Variants" is selected and at least one variant is added with a name
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Certificate not generating for course participants?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Make sure the add-on is marked as "Course" and a certificate template is linked
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
              <Link href={`/events/${eventId}/addons`}>
                <Button variant="outline" size="sm">
                  <Package className="h-4 w-4 mr-2" />
                  Manage Add-ons
                </Button>
              </Link>
              <Link href={`/events/${eventId}/addons/settings`}>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Add-on Settings
                </Button>
              </Link>
              <Link href={`/events/${eventId}/tickets`}>
                <Button variant="outline" size="sm">
                  <Ticket className="h-4 w-4 mr-2" />
                  Manage Tickets
                </Button>
              </Link>
              <Link href={`/events/${eventId}/certificates`}>
                <Button variant="outline" size="sm">
                  <Award className="h-4 w-4 mr-2" />
                  Certificate Templates
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
