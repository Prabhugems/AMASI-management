"use client"

/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

// Dashboard stats interface
interface DashboardStats {
  totalMembers: number
  totalFaculty: number
  activeEvents: number
  totalDelegates: number
}

// Event interface
interface Event {
  id: string
  event_name: string
  event_code: string
  event_type: string
  start_date: string
  end_date: string
  venue_name: string
  status: string
  faculty_count?: number
  delegate_count?: number
}

// Online user interface
interface OnlineUser {
  id: string
  name: string
  role: string
  page: string
  status: "online" | "idle"
  lastActive: string
}

// Faculty activity interface
interface FacultyActivity {
  id: string
  faculty_name: string
  email: string
  event_name: string
  invitation_status: string
  response_status: string
  response_at: string | null
  total_sessions: number
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    totalFaculty: 0,
    activeEvents: 0,
    totalDelegates: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()

      try {
        // Fetch all counts in parallel
        const [facultyResult, eventsResult, delegatesResult] = await Promise.all([
          supabase.from("faculty").select("id", { count: "exact", head: true }),
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .in("status", ["active", "planning", "setup"]),
          supabase.from("delegates").select("id", { count: "exact", head: true }),
        ])

        setStats({
          totalMembers: 17324, // This would come from a members table in production
          totalFaculty: facultyResult.count || 0,
          activeEvents: eventsResult.count || 0,
          totalDelegates: delegatesResult.count || 0,
        })
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch stats"))
      } finally {
        setLoading(false)
      }
    }

    fetchStats()

    // Set up real-time subscription for updates
    const supabase = createClient()
    const channel = supabase
      .channel("dashboard-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "faculty" },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => fetchStats()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delegates" },
        () => fetchStats()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { stats, loading, error }
}

export function useActiveEvents() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient()

      try {
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .in("status", ["active", "planning", "setup"])
          .order("start_date", { ascending: true })
          .limit(5)

        if (error) throw error
        setEvents(data || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch events"))
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  return { events, loading, error }
}

export function useOnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production, this would connect to a presence system
    // For now, we return mock data
    setUsers([
      {
        id: "1",
        name: "Prabhu",
        role: "Super Admin",
        page: "Dashboard",
        status: "online",
        lastActive: "Now",
      },
      {
        id: "2",
        name: "Dr. Rajesh",
        role: "Event Admin",
        page: "Faculty",
        status: "online",
        lastActive: "2m ago",
      },
    ])
    setLoading(false)
  }, [])

  return { users, loading }
}

export function useRecentFacultyActivity() {
  const [activities, setActivities] = useState<FacultyActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchActivities = async () => {
      const supabase = createClient()

      try {
        // For now, return mock data since the table might not exist yet
        // In production, uncomment the Supabase query below
        const mockActivities: FacultyActivity[] = [
          {
            id: "1",
            faculty_name: "Dr. Kalpesh Jani",
            email: "kalpesh@hospital.com",
            event_name: "AMASICON 2026",
            invitation_status: "sent",
            response_status: "confirmed",
            response_at: new Date().toISOString(),
            total_sessions: 3,
          },
          {
            id: "2",
            faculty_name: "Dr. Priya Sharma",
            email: "priya@medical.org",
            event_name: "AMASICON 2026",
            invitation_status: "sent",
            response_status: "pending",
            response_at: null,
            total_sessions: 2,
          },
        ]

        setActivities(mockActivities)

        /* Uncomment when Supabase is set up:
        const { data, error } = await supabase
          .from("faculty_invitations")
          .select(`
            id,
            invitation_status,
            response_status,
            response_at,
            total_sessions,
            faculty:faculty_id (
              full_name,
              email_primary
            ),
            event:event_id (
              event_name
            )
          `)
          .order("updated_at", { ascending: false })
          .limit(10)

        if (error) throw error

        interface FacultyInvitationRow {
          id: string
          invitation_status: string
          response_status: string | null
          response_at: string | null
          total_sessions: number | null
          faculty: { full_name: string; email_primary: string } | null
          event: { event_name: string } | null
        }

        const formattedData = (data as FacultyInvitationRow[])?.map((item) => ({
          id: item.id,
          faculty_name: item.faculty?.full_name || "",
          email: item.faculty?.email_primary || "",
          event_name: item.event?.event_name || "",
          invitation_status: item.invitation_status,
          response_status: item.response_status || "pending",
          response_at: item.response_at,
          total_sessions: item.total_sessions || 0,
        })) || []

        setActivities(formattedData)
        */
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch activities"))
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  return { activities, loading, error }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<
    Array<{
      id: string
      type: "critical" | "warning" | "info"
      title: string
      description: string
      action?: { label: string; href: string }
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      const supabase = createClient()

      try {
        // Check for faculty without responses (7+ days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const { count: pendingFaculty } = await supabase
          .from("faculty_invitations")
          .select("id", { count: "exact", head: true })
          .eq("response_status", "pending")
          .lt("sent_at", sevenDaysAgo.toISOString())

        const newAlerts = []

        if (pendingFaculty && pendingFaculty > 0) {
          newAlerts.push({
            id: "pending-faculty",
            type: "critical" as const,
            title: `${pendingFaculty} Faculty Haven't Responded`,
            description: "Invitations sent 7+ days ago",
            action: { label: "Send Reminders", href: "/faculty?filter=no_response" },
          })
        }

        setAlerts(newAlerts)
      } catch (err) {
        console.error("Failed to fetch alerts:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  return { alerts, loading }
}
