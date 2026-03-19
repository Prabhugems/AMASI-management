import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export type MarkColumn = {
  key: string
  label: string
  max: number
}

export type ExamSettings = {
  exam_type: string
  pass_marks: number
  mark_columns: MarkColumn[]
  convocation_prefix: string
  convocation_start?: number
  without_exam_prefix?: string
  without_exam_start?: number
  exam_ticket_types?: string[]
}

const DEFAULT_SETTINGS: ExamSettings = {
  exam_type: "fmas",
  pass_marks: 15,
  mark_columns: [
    { key: "practical", label: "Practical", max: 10 },
    { key: "viva", label: "VIVA", max: 10 },
    { key: "publication", label: "Publication", max: 5 },
  ],
  convocation_prefix: "FMAS",
}

export function useExamSettings(eventId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["exam-settings", eventId],
    queryFn: async (): Promise<ExamSettings> => {
      const { data } = await (supabase as any)
        .from("events")
        .select("settings")
        .eq("id", eventId)
        .maybeSingle()

      const eventSettings = (data as any)?.settings as Record<string, any> | null
      const exam = eventSettings?.examination as ExamSettings | undefined
      return exam || DEFAULT_SETTINGS
    },
    enabled: !!eventId,
    staleTime: 30000,
  })
}
