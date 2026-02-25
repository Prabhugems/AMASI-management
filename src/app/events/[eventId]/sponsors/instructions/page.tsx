"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  Building2,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Award,
  Users,
  Grid3X3,
  DollarSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function SponsorsInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Sponsors Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to manage sponsors, tiers, contacts, and stall allocations</p>
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
                  <p className="font-medium">Create Sponsor Tiers</p>
                  <p className="text-sm text-muted-foreground">Set up tiers like Platinum, Gold, Silver with benefits and pricing</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Add Sponsors</p>
                  <p className="text-sm text-muted-foreground">Add sponsor companies and assign them to the appropriate tier</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Add Contacts</p>
                  <p className="text-sm text-muted-foreground">Add key contact persons for each sponsor company</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Assign Stalls</p>
                  <p className="text-sm text-muted-foreground">Allocate exhibition stalls to sponsors from the floor plan</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/sponsors/tiers`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Set Up Sponsor Tiers
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
              <Building2 className="h-5 w-5" />
              Sponsor Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Tier Management</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Create sponsorship tiers with different benefits, pricing, and visibility levels.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Platinum sponsors get main stage branding, Gold get booth + banner, Silver get booth only
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Contact Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Store key contacts for each sponsor — name, email, phone, and role.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Quickly find the right person to contact for logistics, payments, or branding approvals
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Stall Allocation</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Define exhibition stalls and assign them to sponsors based on their tier and preference.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Map out the exhibition area and assign prime locations to top-tier sponsors
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Payment Tracking</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Track sponsor payment status to know who has paid and who has outstanding balances.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Follow up with sponsors who haven't completed payment before the event
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
                <span className="text-sm">Create <strong>sponsor tiers first</strong> before adding any sponsors so you can assign them properly</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Add <strong>at least one contact person</strong> per sponsor for communication purposes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Set up the <strong>floor plan early</strong> so stall assignments can be shared with sponsors for logistics</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Track <strong>payment status</strong> diligently and follow up 2 weeks before the event</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Keep sponsor <strong>logos and branding assets</strong> linked to their profile for easy access</span>
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
                <p className="font-medium text-sm text-amber-800">Can't assign a stall to a sponsor?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Make sure stalls are created in the Stalls section first. The sponsor must also be saved before assigning a stall.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Sponsor not showing in the overview?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Ensure the sponsor is assigned to a tier. Untiered sponsors may not appear in tier-based views.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Sponsor income not reflecting in budget?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Sponsor income is linked to confirmed payments. Mark sponsor payments as received for them to appear in budget reports.
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
              <Link href={`/events/${eventId}/sponsors`}>
                <Button variant="outline" size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  Sponsor Overview
                </Button>
              </Link>
              <Link href={`/events/${eventId}/sponsors/list`}>
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Sponsors
                </Button>
              </Link>
              <Link href={`/events/${eventId}/sponsors/tiers`}>
                <Button variant="outline" size="sm">
                  <Award className="h-4 w-4 mr-2" />
                  Manage Tiers
                </Button>
              </Link>
              <Link href={`/events/${eventId}/sponsors/stalls`}>
                <Button variant="outline" size="sm">
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Manage Stalls
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
