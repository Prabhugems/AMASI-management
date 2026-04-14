"use client"

import { useParams } from "next/navigation"
import {
  ScrollText,
  MapPin,
  Truck,
  Users,
  FileCheck,
  Construction,
} from "lucide-react"

const PLANNED_FEATURES = [
  {
    icon: MapPin,
    title: "Built-in Address Form",
    description: "Candidates fill their dispatch address directly on /my page — no Fillout or Airtable forms needed. Instant save to database.",
    status: "Coming Soon",
  },
  {
    icon: FileCheck,
    title: "Certificate Name Confirmation",
    description: "Candidates verify the exact name to be printed on their certificate. Locked after deadline.",
    status: "Coming Soon",
  },
  {
    icon: Truck,
    title: "Dispatch Tracking",
    description: "Track certificate dispatch status per candidate — printed, packed, shipped, delivered. Integration with courier APIs.",
    status: "Planned",
  },
  {
    icon: Users,
    title: "Convocation RSVP",
    description: "Candidates confirm attendance for convocation ceremony. Manage headcount, seating, and guest passes.",
    status: "Planned",
  },
]

export default function ConvocationProcessPage() {
  const params = useParams()
  const eventId = params.eventId as string

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Convocation Process
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          End-to-end convocation management — address collection, certificate dispatch, and ceremony coordination.
        </p>
      </div>

      {/* Under Construction Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6 flex items-start gap-4">
        <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">Module Under Development</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            This module will replace the current address collection workflow with a fully built-in solution.
            No more dependency on external forms (Fillout/Airtable). Currently, address collection continues
            to work via the existing Examination &rarr; Address Collection page.
          </p>
        </div>
      </div>

      {/* Planned Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANNED_FEATURES.map((feature) => {
          const Icon = feature.icon
          return (
            <div key={feature.title} className="bg-card rounded-xl border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  feature.status === "Coming Soon"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  {feature.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
