"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CheckCircle,
  XCircle,
  Search,
  Award,
  Loader2,
  QrCode,
  User,
  Calendar,
  Hash,
  Shield,
  Mail,
  Building2,
  Ticket,
} from "lucide-react"
import { toast } from "sonner"

export default function VerifyCertificatePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [searchValue, setSearchValue] = useState("")
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    valid: boolean
    attendee?: {
      name: string
      email: string
      registration_number: string
      designation?: string
      institution?: string
      ticket_type?: string
    }
    error?: string
  } | null>(null)

  // Fetch event details
  const { data: event } = useQuery({
    queryKey: ["event-details", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, start_date, end_date")
        .eq("id", eventId)
        .single()

      return data
    },
  })

  const verifyCertificate = async () => {
    const query = searchValue.trim()
    if (!query) {
      toast.error("Enter a registration number or email")
      return
    }

    setSearching(true)
    setResult(null)

    try {
      // Determine search type: email contains @, otherwise treat as registration number
      const isEmail = query.includes("@")

      let registrationQuery = (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_designation,
          attendee_institution,
          status,
          ticket_type_id,
          ticket_types (name)
        `)
        .eq("event_id", eventId)
        .eq("status", "confirmed")

      if (isEmail) {
        registrationQuery = registrationQuery.ilike("attendee_email", query)
      } else {
        registrationQuery = registrationQuery.ilike("registration_number", query)
      }

      const { data, error } = await registrationQuery.single()

      if (error || !data) {
        setResult({
          valid: false,
          error: isEmail
            ? "No confirmed registration found with this email for this event."
            : "No confirmed registration found with this registration number.",
        })
        return
      }

      setResult({
        valid: true,
        attendee: {
          name: data.attendee_name,
          email: data.attendee_email,
          registration_number: data.registration_number,
          designation: data.attendee_designation,
          institution: data.attendee_institution,
          ticket_type: data.ticket_types?.name,
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

  const formatEventDate = () => {
    if (!event?.start_date) return null
    const start = new Date(event.start_date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    if (!event.end_date) return start
    const end = new Date(event.end_date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    return `${start} - ${end}`
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Verify Certificate</h1>
        <p className="text-muted-foreground">Validate the authenticity of a certificate</p>
      </div>

      {/* Verification Form */}
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-lg border p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Certificate Verification</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the registration number or email address
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Registration number or email..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyCertificate()}
                className="pl-10"
              />
            </div>
            <Button
              className="w-full"
              onClick={verifyCertificate}
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
                  Verify Certificate
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <QrCode className="h-4 w-4 flex-shrink-0" />
            <span>Scan the QR code on the certificate to verify instantly via the verification link</span>
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
                    <h3 className="font-semibold text-green-800">Valid Certificate</h3>
                    <p className="text-sm text-green-600">This certificate is authentic and verified</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-green-200">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Issued To</p>
                      <p className="font-medium text-green-800">{result.attendee?.name}</p>
                      {result.attendee?.designation && (
                        <p className="text-sm text-green-600">{result.attendee.designation}</p>
                      )}
                    </div>
                  </div>

                  {result.attendee?.institution && (
                    <div className="flex items-center gap-3">
                      <Building2 className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Institution</p>
                        <p className="font-medium text-green-800">{result.attendee.institution}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Email</p>
                      <p className="font-medium text-green-800">{result.attendee?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Hash className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Registration Number</p>
                      <p className="font-mono font-medium text-green-800">{result.attendee?.registration_number}</p>
                    </div>
                  </div>

                  {result.attendee?.ticket_type && (
                    <div className="flex items-center gap-3">
                      <Ticket className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Ticket Type</p>
                        <p className="font-medium text-green-800">{result.attendee.ticket_type}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Event</p>
                      <p className="font-medium text-green-800">{event?.name || "Event"}</p>
                    </div>
                  </div>

                  {formatEventDate() && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Event Date</p>
                        <p className="font-medium text-green-800">{formatEventDate()}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800">Not Found</h3>
                    <p className="text-sm text-red-600">{result.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="max-w-lg mx-auto">
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">About Certificate Verification</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each certificate has a QR code with a verification link</li>
            <li>• You can verify by scanning the QR code or entering the registration number</li>
            <li>• You can also search by email address</li>
            <li>• Only confirmed registrations can be verified</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
