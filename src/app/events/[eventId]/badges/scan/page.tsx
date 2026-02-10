"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  QrCode,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  User,
  Badge as BadgeIcon,
  Hash,
  Shield,
  Camera,
} from "lucide-react"
import { toast } from "sonner"

export default function ScanBadgePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [badgeId, setBadgeId] = useState("")
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    valid: boolean
    registration?: {
      id: string
      registration_number?: string
      name: string
      email: string
      designation?: string
      institution?: string
      ticket_type?: string
      badge_printed?: boolean
      checked_in?: boolean
      checked_in_at?: string
    }
    error?: string
  } | null>(null)

  // Fetch event details
  useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, title")
        .eq("id", eventId)
        .single()

      return data
    },
  })

  const verifyBadge = async () => {
    if (!badgeId.trim()) {
      toast.error("Enter a badge ID or scan QR code")
      return
    }

    setSearching(true)
    setResult(null)

    try {
      let searchValue = badgeId.trim()

      // If it's a URL (from QR code), extract the token
      if (searchValue.includes("/v/")) {
        const parts = searchValue.split("/v/")
        searchValue = parts[parts.length - 1]
      }

      // Search for registration by registration_number, checkin_token, or id
      const { data, error } = await (supabase as any)
        .from("registrations")
        .select("id, registration_number, attendee_name, attendee_email, attendee_designation, attendee_institution, badge_generated_at, checked_in, checked_in_at, status, ticket_types(name)")
        .eq("event_id", eventId)
        .or(`registration_number.ilike.${searchValue},checkin_token.eq.${searchValue},id.eq.${searchValue}`)
        .single()

      if (error || !data) {
        setResult({
          valid: false,
          error: "Badge not found. Please check the ID and try again.",
        })
        return
      }

      if (data.status !== "confirmed") {
        setResult({
          valid: false,
          error: `Registration is ${data.status}. Only confirmed registrations are valid.`,
        })
        return
      }

      setResult({
        valid: true,
        registration: {
          id: data.id,
          registration_number: data.registration_number,
          name: data.attendee_name,
          email: data.attendee_email,
          designation: data.attendee_designation,
          institution: data.attendee_institution,
          ticket_type: data.ticket_types?.name,
          badge_printed: !!data.badge_generated_at,
          checked_in: data.checked_in,
          checked_in_at: data.checked_in_at,
        },
      })
    } catch {
      setResult({
        valid: false,
        error: "An error occurred while verifying. Please try again.",
      })
    } finally {
      setSearching(false)
    }
  }

  const checkInAttendee = async () => {
    if (!result?.registration?.id) return

    try {
      const now = new Date().toISOString()
      const { error } = await (supabase as any)
        .from("registrations")
        .update({
          checked_in: true,
          checked_in_at: now,
        })
        .eq("id", result.registration.id)

      if (error) throw error

      setResult({
        ...result,
        registration: {
          ...result.registration,
          checked_in: true,
          checked_in_at: now,
        },
      })
      toast.success(`${result.registration.name} checked in!`)
    } catch {
      toast.error("Failed to check in")
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Scan & Verify Badge</h1>
        <p className="text-muted-foreground">Validate badges and check in attendees</p>
      </div>

      {/* Verification Form */}
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-lg border p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Badge Verification</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Scan QR code or enter badge ID
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter Badge ID..."
                value={badgeId}
                onChange={(e) => setBadgeId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyBadge()}
                className="pl-10 text-lg h-12"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-12"
                onClick={() => toast.info("Camera scanning coming soon")}
              >
                <Camera className="h-4 w-4 mr-2" />
                Scan QR
              </Button>
              <Button
                className="h-12"
                onClick={verifyBadge}
                disabled={searching}
              >
                {searching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Verify
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-6">
            {result.valid ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">Valid Badge</h3>
                    <p className="text-sm text-green-600">This badge is authentic</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-green-200">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Attendee</p>
                      <p className="font-medium text-green-800">{result.registration?.name}</p>
                      {result.registration?.designation && (
                        <p className="text-sm text-green-600">{result.registration.designation}</p>
                      )}
                      {result.registration?.institution && (
                        <p className="text-sm text-green-600">{result.registration.institution}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Registration #</p>
                      <p className="font-mono font-medium text-green-800">{result.registration?.registration_number}</p>
                    </div>
                  </div>

                  {result.registration?.ticket_type && (
                    <div className="flex items-center gap-3">
                      <BadgeIcon className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Ticket Type</p>
                        <p className="font-medium text-green-800">{result.registration.ticket_type}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Status</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {result.registration?.badge_printed ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Badge Generated</span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">Badge Not Generated</span>
                        )}
                        {result.registration?.checked_in ? (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            Checked In {result.registration.checked_in_at &&
                              `at ${new Date(result.registration.checked_in_at).toLocaleTimeString()}`}
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">Not Checked In</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!result.registration?.checked_in && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <Button className="w-full" onClick={checkInAttendee}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Check In Attendee
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800">Invalid Badge</h3>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clear button */}
        {result && (
          <div className="mt-4 text-center">
            <Button
              variant="outline"
              onClick={() => {
                setResult(null)
                setBadgeId("")
              }}
            >
              Scan Another Badge
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
