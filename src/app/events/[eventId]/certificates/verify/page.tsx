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
} from "lucide-react"
import { toast } from "sonner"

export default function VerifyCertificatePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()

  const [certificateId, setCertificateId] = useState("")
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<{
    valid: boolean
    attendee?: {
      name: string
      email: string
      designation?: string
      issued_at?: string
    }
    error?: string
  } | null>(null)

  // Fetch event details
  const { data: event } = useQuery({
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

  const verifyCertificate = async () => {
    if (!certificateId.trim()) {
      toast.error("Enter a certificate ID")
      return
    }

    setSearching(true)
    setResult(null)

    try {
      // Search for registration with this certificate ID
      const { data, error } = await (supabase as any)
        .from("registrations")
        .select("id, attendee_name, attendee_email, attendee_designation, custom_fields")
        .eq("event_id", eventId)
        .or(`id.eq.${certificateId},custom_fields->certificate_id.eq.${certificateId}`)
        .single()

      if (error || !data) {
        setResult({
          valid: false,
          error: "Certificate not found. Please check the ID and try again.",
        })
        return
      }

      if (!data.custom_fields?.certificate_generated) {
        setResult({
          valid: false,
          error: "No certificate has been issued for this registration.",
        })
        return
      }

      setResult({
        valid: true,
        attendee: {
          name: data.attendee_name,
          email: data.attendee_email,
          designation: data.attendee_designation,
          issued_at: data.custom_fields?.certificate_generated_at,
        },
      })
    } catch (error) {
      setResult({
        valid: false,
        error: "An error occurred while verifying. Please try again.",
      })
    } finally {
      setSearching(false)
    }
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "Unknown"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
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
              Enter the certificate ID or scan the QR code
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter Certificate ID..."
                value={certificateId}
                onChange={(e) => setCertificateId(e.target.value)}
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
            <QrCode className="h-4 w-4" />
            <span>You can also scan the QR code on the certificate</span>
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
                    <p className="text-sm text-green-600">This certificate is authentic</p>
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

                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Event</p>
                      <p className="font-medium text-green-800">{event?.title || "Event"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Issued On</p>
                      <p className="font-medium text-green-800">
                        {formatDate(result.attendee?.issued_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-red-800">Invalid Certificate</h3>
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
            <li>• Each certificate has a unique ID encoded in its QR code</li>
            <li>• Verification confirms the certificate was officially issued</li>
            <li>• Invalid results may indicate a forged or tampered certificate</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
