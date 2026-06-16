import type { Metadata } from "next"
import { TechnosurgSheetProgramView } from "./sheet-program-view"

export const revalidate = 60

const PAGE_URL = "https://technosurg.gemhospitals.com/technosurg/program"
const PAGE_TITLE =
  "TechnoSurg 2026 Surgery Conference Program — Live Surgeries, Lectures & Gynaec Track"
const PAGE_DESCRIPTION =
  "Full scientific program for TechnoSurg 2026: 4 parallel screens with live broadcasts of GI, Onco, Robotic and Gynaec surgeries, plus plenary lectures and breakouts. Schedule updates live from the organising committee."

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    type: "website",
    url: PAGE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
}

export default async function TechnosurgProgramPage() {
  return <TechnosurgSheetProgramView />
}
