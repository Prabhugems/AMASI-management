"use client"

import { useParams, useSearchParams } from "next/navigation"
import { KioskCheckinScreen } from "@/components/kiosk/KioskCheckinScreen"

export default function KioskPage() {
  const params = useParams()
  const searchParams = useSearchParams()

  return (
    <KioskCheckinScreen
      eventId={params.eventId as string}
      listId={params.listId as string}
      token={searchParams.get("token") ?? ""}
    />
  )
}
