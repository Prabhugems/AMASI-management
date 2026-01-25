"use client"

import { useState } from "react"
import { X, Bell, Loader2, CheckCircle } from "lucide-react"
import { getTrackingIds } from "@/hooks/usePageTracking"

interface NotifyMeModalProps {
  eventId: string
  eventName: string
  isOpen: boolean
  onClose: () => void
}

export function NotifyMeModal({ eventId, eventName, isOpen, onClose }: NotifyMeModalProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      const { visitorId } = getTrackingIds()
      const urlParams = new URLSearchParams(window.location.search)

      const res = await fetch("/api/analytics/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          email,
          name: name || null,
          phone: phone || null,
          source: "notify_me",
          visitor_id: visitorId,
          utm_source: urlParams.get("utm_source"),
          utm_medium: urlParams.get("utm_medium"),
          utm_campaign: urlParams.get("utm_campaign"),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to save")
      }

      setIsSuccess(true)
      setTimeout(() => {
        onClose()
        setIsSuccess(false)
        setEmail("")
        setName("")
        setPhone("")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-6 h-6" />
            <h2 className="text-xl font-bold">Get Notified</h2>
          </div>
          <p className="text-emerald-100 text-sm">
            We'll notify you about updates and registration reminders for this event.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {isSuccess ? (
            <div className="text-center py-6">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">You're on the list!</h3>
              <p className="text-gray-500">We'll keep you updated about {eventName}.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email}
                className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Notify Me
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                We'll only send you updates about this event. No spam, ever.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
