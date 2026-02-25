"use client"

import { useParams } from "next/navigation"

export default function MealsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useParams() // ensure we're in event context
  return <>{children}</>
}
