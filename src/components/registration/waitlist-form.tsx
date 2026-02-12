"use client"

import { useState } from "react"
import { Bell, Loader2, CheckCircle, AlertCircle, Users } from "lucide-react"

interface WaitlistFormProps {
  eventId: string
  ticketTypeId?: string
  ticketName?: string
  onSuccess?: (position: number) => void
}

export function WaitlistForm({
  eventId,
  ticketTypeId,
  ticketName,
  onSuccess,
}: WaitlistFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ position: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: ticketTypeId,
          ...formData,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join waitlist")
      }

      setSuccess({ position: data.position })
      onSuccess?.(data.position)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-200">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-emerald-100">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">You&apos;re on the waitlist!</h3>
            <p className="text-emerald-700 mt-1">
              You are <span className="font-bold">#{success.position}</span> in line
              {ticketName && ` for ${ticketName}`}.
            </p>
            <p className="text-sm text-emerald-600 mt-2">
              We&apos;ll notify you at <span className="font-medium">{formData.email}</span> when a spot becomes available.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!isOpen) {
    return (
      <div className="p-6 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-amber-100">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-900">
              {ticketName ? `${ticketName} - Sold Out` : "Tickets Sold Out"}
            </h3>
            <p className="text-amber-700 mt-1">
              This event is currently sold out, but you can join the waitlist to be notified if spots become available.
            </p>
            <button
              onClick={() => setIsOpen(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              Join Waitlist
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-full bg-emerald-100">
          <Users className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Join the Waitlist</h3>
          {ticketName && (
            <p className="text-sm text-gray-500">for {ticketName}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address *
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            placeholder="Enter your phone number"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                Join Waitlist
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          You&apos;ll be notified when a spot becomes available. No payment required now.
        </p>
      </form>
    </div>
  )
}
