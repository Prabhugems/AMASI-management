import { TechnosurgSheetProgramView } from "@/app/technosurg/program/sheet-program-view"
import LegacyPublicProgram from "./legacy-public-program"

export const revalidate = 60

const TECHNOSURG_EVENT_ID = "87c614b3-ff23-47c5-8682-87ea32aa77b9"

type PageProps = { params: Promise<{ eventId: string }> }

export default async function PublicProgramPage({ params }: PageProps) {
  const { eventId } = await params
  if (eventId === TECHNOSURG_EVENT_ID) {
    return <TechnosurgSheetProgramView />
  }
  return <LegacyPublicProgram />
}
