"use client"

import { useState, useRef, useEffect } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  Ticket,
  Mail,
  Phone,
  Clock,
  Hash,
  List,
} from "lucide-react"

type Registration = {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  attendee_phone?: string
  attendee_designation?: string
  ticket_type?: { id: string; name: string }
  checked_in: boolean
  checked_in_at?: string
}

type CheckinRecord = {
  id: string
  checkin_list_id: string
  checked_in_at: string
  checked_out_at?: string
  checkin_list?: { id: string; name: string }
}

export default function TrackAttendeePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch check-in lists for this event
  const { data: lists } = useQuery({
    queryKey: ["checkin-lists", eventId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checkin_lists")
        .select("id, name, ticket_type_ids")
        .eq("event_id", eventId)
        .eq("is_active", true)
        .order("sort_order")

      return data || []
    },
  })

  // Search for registrations
  const { data: searchResults, isLoading: searchLoading, refetch: _refetch } = useQuery({
    queryKey: ["track-attendee", eventId, searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return []

      const input = searchQuery.trim()

      // Check if input looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input)

      // Build query to search by multiple fields
      let query = (supabase as any)
        .from("registrations")
        .select(`
          id,
          registration_number,
          attendee_name,
          attendee_email,
          attendee_phone,
          attendee_designation,
          checked_in,
          checked_in_at,
          ticket_type:ticket_types(id, name)
        `)
        .eq("event_id", eventId)
        .eq("status", "confirmed")

      if (isUUID) {
        query = query.eq("id", input)
      } else {
        // Search by registration number, name, email, or phone
        query = query.or(`registration_number.ilike.%${input}%,attendee_name.ilike.%${input}%,attendee_email.ilike.%${input}%,attendee_phone.ilike.%${input}%`)
      }

      const { data, error } = await query.limit(20)

      if (error) {
        console.error("Search error:", error)
        return []
      }

      // For each registration, get their check-in records
      const registrationsWithCheckins = await Promise.all(
        (data || []).map(async (reg: Registration) => {
          const { data: checkinRecords } = await (supabase as any)
            .from("checkin_records")
            .select(`
              id,
              checkin_list_id,
              checked_in_at,
              checked_out_at,
              checkin_list:checkin_lists(id, name)
            `)
            .eq("registration_id", reg.id)
            .order("checked_in_at", { ascending: false })

          return {
            ...reg,
            checkin_records: checkinRecords || [],
          }
        })
      )

      return registrationsWithCheckins
    },
    enabled: !!searchQuery.trim(),
  })

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSearchQuery(searchInput.trim())
    }
  }

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // Get eligible lists for a registration based on ticket type
  const getEligibleLists = (registration: Registration & { checkin_records: CheckinRecord[] }) => {
    if (!lists) return []

    return lists.filter((list: any) => {
      // If list has no ticket type restrictions, it's eligible for everyone
      if (!list.ticket_type_ids || list.ticket_type_ids.length === 0) {
        return true
      }
      // Check if registration's ticket type is in the allowed list
      return registration.ticket_type && list.ticket_type_ids.includes(registration.ticket_type.id)
    })
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Track Attendee</h1>
        <p className="text-muted-foreground">Search for an attendee to see their check-in status across all lists</p>
      </div>

      {/* Search Interface */}
      <div className="max-w-3xl">
        <div className="bg-card rounded-lg border p-6 space-y-6">
          {/* Search Input */}
          <div className="space-y-3">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Find Attendee</h2>
              <p className="text-sm text-muted-foreground">Search by name, email, phone, or registration number</p>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  placeholder="Enter name, email, phone, or registration number..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-12 h-12"
                  autoFocus
                />
              </div>
              <Button
                className="h-12 px-6"
                onClick={handleSearch}
                disabled={searchLoading || !searchInput.trim()}
              >
                {searchLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="mt-6 space-y-4">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </p>
                {searchResults.map((registration: Registration & { checkin_records: CheckinRecord[] }) => {
                  const eligibleLists = getEligibleLists(registration)
                  const checkedInListIds = registration.checkin_records
                    .filter((r: CheckinRecord) => !r.checked_out_at)
                    .map((r: CheckinRecord) => r.checkin_list_id)

                  return (
                    <div key={registration.id} className="bg-card rounded-lg border overflow-hidden">
                      {/* Attendee Info */}
                      <div className="p-4 border-b">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-5 w-5 text-muted-foreground" />
                              <span className="font-semibold text-lg">{registration.attendee_name}</span>
                              {registration.checked_in && (
                                <Badge variant="default" className="bg-emerald-500">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Checked In
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Hash className="h-4 w-4" />
                                {registration.registration_number}
                              </span>
                              <span className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                {registration.attendee_email}
                              </span>
                              {registration.attendee_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  {registration.attendee_phone}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                              {registration.ticket_type && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Ticket className="h-4 w-4" />
                                  {registration.ticket_type.name}
                                </span>
                              )}
                              {registration.attendee_designation && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  {registration.attendee_designation}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Check-in Status by List */}
                      <div className="p-4 bg-muted/30">
                        <div className="flex items-center gap-2 mb-3">
                          <List className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Check-in Status by List</span>
                        </div>

                        {eligibleLists.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No active check-in lists for this ticket type</p>
                        ) : (
                          <div className="space-y-2">
                            {eligibleLists.map((list: any) => {
                              const isCheckedIn = checkedInListIds.includes(list.id)
                              const checkinRecord = registration.checkin_records.find(
                                (r: CheckinRecord) => r.checkin_list_id === list.id && !r.checked_out_at
                              )

                              return (
                                <div
                                  key={list.id}
                                  className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isCheckedIn ? "bg-emerald-50 border-emerald-200" : "bg-white"
                                  }`}
                                >
                                  <span className="font-medium">{list.name}</span>
                                  {isCheckedIn ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-emerald-600 flex items-center gap-1">
                                        <Clock className="h-4 w-4" />
                                        {checkinRecord && formatDateTime(checkinRecord.checked_in_at)}
                                      </span>
                                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Not checked in</span>
                                      <XCircle className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Show historical check-ins (checked out) */}
                        {registration.checkin_records.filter((r: CheckinRecord) => r.checked_out_at).length > 0 && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-muted-foreground mb-2">Previous check-ins (checked out):</p>
                            <div className="space-y-1">
                              {registration.checkin_records
                                .filter((r: CheckinRecord) => r.checked_out_at)
                                .map((record: CheckinRecord) => (
                                  <div key={record.id} className="text-sm text-muted-foreground">
                                    {record.checkin_list?.name} - {formatDateTime(record.checked_in_at)}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="bg-muted/50 rounded-lg p-8 text-center">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-1">No results found</h3>
                <p className="text-sm text-muted-foreground">
                  No attendees match &quot;{searchQuery}&quot;. Try a different search term.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        {!searchQuery && (
          <div className="mt-6 bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium mb-2">Search Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Search by full or partial name</li>
              <li>• Search by email address</li>
              <li>• Search by phone number</li>
              <li>• Search by registration number (e.g., 1211001)</li>
              <li>• View check-in status across all active lists</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
