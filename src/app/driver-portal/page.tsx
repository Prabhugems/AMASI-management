"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Car, Phone, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"

export default function DriverPortalPage() {
  const router = useRouter()
  const supabase = createClient()

  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Normalize phone number (remove non-digits except +)
      const normalizedPhone = phone.replace(/[^\d+]/g, "")

      if (normalizedPhone.length < 10) {
        setError("Please enter a valid phone number")
        setLoading(false)
        return
      }

      // Search for any transfers assigned to this driver
      type RegType = { id: string; event_id: string; custom_fields: any }
      const { data: registrationsData } = await supabase
        .from("registrations")
        .select("id, event_id, custom_fields")
      const registrations = registrationsData as RegType[] | null

      // Find registrations where this driver is assigned
      const hasAssignments = registrations?.some(r => {
        const booking = r.custom_fields?.booking || {}
        const pickupPhone = booking.pickup_driver_phone?.replace(/[^\d+]/g, "") || ""
        const dropPhone = booking.drop_driver_phone?.replace(/[^\d+]/g, "") || ""

        return pickupPhone.includes(normalizedPhone.slice(-10)) ||
               dropPhone.includes(normalizedPhone.slice(-10)) ||
               normalizedPhone.includes(pickupPhone.slice(-10)) ||
               normalizedPhone.includes(dropPhone.slice(-10))
      })

      if (!hasAssignments) {
        setError("No assignments found for this phone number. Please check with the coordinator.")
        setLoading(false)
        return
      }

      // Navigate to driver's assignments page
      router.push(`/driver-portal/${encodeURIComponent(normalizedPhone)}`)
    } catch (_err) {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <Car className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">Driver Portal</h1>
          <p className="text-slate-400 mt-2">View your pickup and drop assignments</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone" className="text-sm font-medium">
                Your Phone Number
              </Label>
              <div className="relative mt-1.5">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="pl-11 h-12 text-lg"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the phone number registered with the event coordinator
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={loading || !phone.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Car className="h-5 w-5 mr-2" />
                  View My Assignments
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-muted-foreground">
              Having trouble? Contact your event coordinator
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500 mt-6">
          AMASI Event Management System
        </p>
      </div>
    </div>
  )
}
