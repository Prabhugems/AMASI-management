"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QrCode, Printer, ArrowLeft, Loader2, AlertCircle } from "lucide-react"

interface CheckinListEntry {
  id: string
  name: string
  list_purpose: "entry" | "collection"
  access_token: string
}

interface PrintStationEntry {
  id: string
  name: string
  access_token: string
}

interface LauncherData {
  event: { id: string; name: string; short_name: string | null }
  checkinLists: CheckinListEntry[]
  printStations: PrintStationEntry[]
}

type View = "menu" | "checkin" | "print"

export default function KioskLauncherPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const [view, setView] = useState<View>("menu")

  const { data, isLoading, error } = useQuery({
    queryKey: ["kiosk-launcher", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk-launcher/${eventId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      return json as LauncherData
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Not available</h1>
          <p className="text-gray-600">
            {error instanceof Error ? error.message : "This link is invalid."}
          </p>
        </div>
      </div>
    )
  }

  const eventLabel = data.event.short_name || data.event.name

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          {view !== "menu" && (
            <button
              onClick={() => setView("menu")}
              className="p-2 hover:bg-white/10 rounded-lg"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold">{eventLabel}</h1>
            <p className="text-sm text-white/50">
              {view === "menu" ? "Kiosk" : view === "checkin" ? "Check-in" : "Print Badge"}
            </p>
          </div>
        </div>

        {view === "menu" && (
          <div className="space-y-4">
            <button
              onClick={() => setView("checkin")}
              className="w-full flex items-center gap-4 p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <QrCode className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-semibold">Check-in</div>
                <div className="text-sm text-white/50">Scan attendees into a list</div>
              </div>
            </button>

            <button
              onClick={() => setView("print")}
              className="w-full flex items-center gap-4 p-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                <Printer className="w-7 h-7 text-sky-400" />
              </div>
              <div>
                <div className="text-lg font-semibold">Print Badge</div>
                <div className="text-sm text-white/50">Scan and print at a station</div>
              </div>
            </button>
          </div>
        )}

        {view === "checkin" && (
          <div className="space-y-3">
            {data.checkinLists.length === 0 && (
              <p className="text-white/50 text-center py-8">No active check-in lists for this event.</p>
            )}
            {data.checkinLists.map((list) => (
              <a
                key={list.id}
                href={`/checkin/access/${list.access_token}`}
                className="block w-full p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors"
              >
                <div className="font-semibold">{list.name}</div>
                <div className="text-xs text-white/40 mt-1 uppercase tracking-wide">
                  {list.list_purpose === "collection" ? "Collection" : "Entry"}
                </div>
              </a>
            ))}
          </div>
        )}

        {view === "print" && (
          <div className="space-y-3">
            {data.printStations.length === 0 && (
              <p className="text-white/50 text-center py-8">No active print stations for this event.</p>
            )}
            {data.printStations.map((station) => (
              <a
                key={station.id}
                href={`/print/${station.access_token}`}
                className="block w-full p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors"
              >
                <div className="font-semibold">{station.name}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
