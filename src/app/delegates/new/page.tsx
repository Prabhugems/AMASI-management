"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, UserPlus } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function NewAttendeePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const preselectedEventId = searchParams.get("event_id") || ""

  const [submitting, setSubmitting] = useState(false)
  const [eventId, setEventId] = useState(preselectedEventId)
  const [ticketTypeId, setTicketTypeId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("free")
  const [form, setForm] = useState({
    attendee_name: "",
    attendee_email: "",
    attendee_phone: "",
    attendee_institution: "",
    attendee_designation: "",
    attendee_city: "",
  })

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, short_name")
        .order("start_date", { ascending: false })
      return data || []
    },
  })

  // Fetch ticket types for selected event
  const { data: ticketTypes } = useQuery({
    queryKey: ["ticket-types", eventId],
    queryFn: async () => {
      if (!eventId) return []
      const { data } = await (supabase as any)
        .from("ticket_types")
        .select("id, name, price, status")
        .eq("event_id", eventId)
        .eq("status", "active")
        .order("price", { ascending: true })
      return data || []
    },
    enabled: !!eventId,
  })

  // Reset ticket when event changes
  useEffect(() => {
    setTicketTypeId("")
  }, [eventId])

  // Auto-select payment method based on ticket price
  useEffect(() => {
    if (!ticketTypeId || !ticketTypes) return
    const ticket = ticketTypes.find((t: any) => t.id === ticketTypeId)
    if (ticket && ticket.price > 0) {
      setPaymentMethod("cash")
    } else {
      setPaymentMethod("free")
    }
  }, [ticketTypeId, ticketTypes])

  const selectedTicket = ticketTypes?.find((t: any) => t.id === ticketTypeId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!eventId || !ticketTypeId) {
      toast.error("Please select an event and ticket type")
      return
    }
    if (!form.attendee_name.trim() || !form.attendee_email.trim()) {
      toast.error("Name and email are required")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          ticket_type_id: ticketTypeId,
          attendee_name: form.attendee_name.trim(),
          attendee_email: form.attendee_email.trim().toLowerCase(),
          attendee_phone: form.attendee_phone.trim() || undefined,
          attendee_institution: form.attendee_institution.trim() || undefined,
          attendee_designation: form.attendee_designation.trim() || undefined,
          attendee_city: form.attendee_city.trim() || undefined,
          payment_method: paymentMethod,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create registration")
      }

      toast.success(`Registration created: ${data.data?.registration_number}`)

      if (preselectedEventId) {
        router.push(`/events/${preselectedEventId}/registrations/list`)
      } else {
        router.push("/delegates")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create registration")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href={preselectedEventId ? `/events/${preselectedEventId}/registrations/list` : "/delegates"}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Add Attendee</h1>
            <p className="text-muted-foreground">Create a new registration manually</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event & Ticket */}
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold">Event & Ticket</h2>

            <div className="space-y-2">
              <Label>Event *</Label>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {events?.map((event: any) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.short_name || event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eventId && (
              <div className="space-y-2">
                <Label>Ticket Type *</Label>
                <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketTypes?.map((ticket: any) => (
                      <SelectItem key={ticket.id} value={ticket.id}>
                        {ticket.name} {ticket.price > 0 ? `(₹${ticket.price})` : "(Free)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedTicket && selectedTicket.price > 0 && (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Amount: ₹{selectedTicket.price} — Status will be &quot;Pending&quot; until payment is confirmed
                </p>
              </div>
            )}
          </div>

          {/* Attendee Details */}
          <div className="bg-card rounded-lg border p-6 space-y-4">
            <h2 className="font-semibold">Attendee Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Full Name *</Label>
                <Input
                  value={form.attendee_name}
                  onChange={(e) => setForm({ ...form, attendee_name: e.target.value })}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.attendee_email}
                  onChange={(e) => setForm({ ...form, attendee_email: e.target.value })}
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={form.attendee_phone}
                  onChange={(e) => setForm({ ...form, attendee_phone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>

              <div className="space-y-2">
                <Label>Institution</Label>
                <Input
                  value={form.attendee_institution}
                  onChange={(e) => setForm({ ...form, attendee_institution: e.target.value })}
                  placeholder="College / Organization"
                />
              </div>

              <div className="space-y-2">
                <Label>Designation</Label>
                <Input
                  value={form.attendee_designation}
                  onChange={(e) => setForm({ ...form, attendee_designation: e.target.value })}
                  placeholder="e.g. Professor, Student"
                />
              </div>

              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={form.attendee_city}
                  onChange={(e) => setForm({ ...form, attendee_city: e.target.value })}
                  placeholder="City"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !eventId || !ticketTypeId}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Attendee
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
