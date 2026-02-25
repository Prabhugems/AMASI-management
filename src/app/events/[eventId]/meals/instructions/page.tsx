"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  BookOpen,
  UtensilsCrossed,
  Plus,
  Settings,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  Users,
  ClipboardList,
  Download,
  Salad,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function MealsInstructionsPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6" />
          Meals Instructions
        </h1>
        <p className="text-muted-foreground mt-1">Learn how to manage meal plans and dietary tracking for your event</p>
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
                  <p className="font-medium">Create Meal Plans</p>
                  <p className="text-sm text-muted-foreground">Set up meals for each day of your event (breakfast, lunch, dinner, tea, snack)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <p className="font-medium">Bulk-Register Attendees</p>
                  <p className="text-sm text-muted-foreground">Add attendees to meal plans in bulk from your registration list</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <p className="font-medium">Track Dietary Preferences</p>
                  <p className="text-sm text-muted-foreground">Record dietary requirements for accurate catering counts</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">4</div>
                <div>
                  <p className="font-medium">Meal Check-in</p>
                  <p className="text-sm text-muted-foreground">Track who has collected their meal at each service point</p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <Link href={`/events/${eventId}/meals`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Meal Plan
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Meal Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Meal Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Breakfast</Badge>
                  <span className="text-sm">Morning meal service</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Lunch</Badge>
                  <span className="text-sm">Midday main meal</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Dinner</Badge>
                  <span className="text-sm">Evening main meal</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Tea</Badge>
                  <span className="text-sm">Tea/coffee break with light refreshments</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20">Snack</Badge>
                  <span className="text-sm">Light snack service between meals</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dietary Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Salad className="h-5 w-5" />
              Dietary Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">Regular</Badge>
                  <span className="text-sm">No specific dietary restrictions</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Vegetarian</Badge>
                  <span className="text-sm">No meat or fish</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Vegan</Badge>
                  <span className="text-sm">No animal products of any kind</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Jain</Badge>
                  <span className="text-sm">No root vegetables, onion, garlic in addition to vegetarian</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20">Halal</Badge>
                  <span className="text-sm">Prepared according to Islamic dietary guidelines</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Meal Features Explained
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Bulk Registration</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Add all confirmed attendees to a meal plan at once instead of one by one.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Quickly assign all 200+ delegates to Day 1 lunch
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Dietary Summary</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Get a breakdown of dietary preferences per meal to share with your caterer.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Share exact counts: 150 regular, 30 vegetarian, 10 jain, 5 vegan
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Meal Check-in</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Mark attendees as they collect their meal to prevent duplicates and track attendance.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Staff at food counters scan badges or check names off
                </div>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Export for Caterer</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Export meal lists with dietary details to share with your catering vendor.
                </p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <strong>Use case:</strong> Send a CSV to the caterer 2 days before the event
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
                <span className="text-sm">Create <strong>meal plans early</strong> so attendees can indicate dietary preferences during registration</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Add a <strong>10% buffer</strong> to catering counts for walk-ins and last-minute changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Export the <strong>dietary summary 2-3 days before</strong> the event and share with your caterer</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Use <strong>meal check-in</strong> to avoid duplicate servings and track actual consumption</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />
                <span className="text-sm">Set up <strong>separate meals per day</strong> to accurately track multi-day events</span>
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
                <p className="font-medium text-sm text-amber-800">Attendee not showing in meal list?</p>
                <p className="text-xs text-amber-700 mt-1">
                  They may not have been added to the meal plan yet. Use bulk registration to add all confirmed attendees.
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Dietary counts don't add up?</p>
                <p className="text-xs text-amber-700 mt-1">
                  Some attendees may not have specified a preference. Unspecified attendees default to "Regular".
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="font-medium text-sm text-amber-800">Duplicate meal check-ins?</p>
                <p className="text-xs text-amber-700 mt-1">
                  The system prevents double check-ins by default. If you see duplicates, check if the same attendee has multiple registrations.
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
              <Link href={`/events/${eventId}/meals`}>
                <Button variant="outline" size="sm">
                  <UtensilsCrossed className="h-4 w-4 mr-2" />
                  Manage Meals
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
