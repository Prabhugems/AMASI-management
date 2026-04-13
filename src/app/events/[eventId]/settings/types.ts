export interface EventSettings {
  id: string
  name: string
  short_name: string | null
  slug: string | null
  description: string | null
  event_type: string
  status: string
  start_date: string | null
  end_date: string | null
  venue_name: string | null
  venue_address: string | null
  city: string | null
  state: string | null
  country: string
  timezone: string
  is_public: boolean
  registration_open: boolean
  max_attendees: number | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  banner_url: string | null
  logo_url: string | null
  primary_color: string | null
  edition: number | null
  scientific_chairman: string | null
  organizing_chairman: string | null
  organized_by: string | null
  signatory_title: string | null
  signature_image_url: string | null
  registration_deadline: string | null
  venue_map_url: string | null
  favicon_url: string | null
  social_twitter: string | null
  social_instagram: string | null
  social_linkedin: string | null
  seo_title: string | null
  seo_description: string | null
  settings: {
    speaker_invitation?: {
      signer_name: string
      signer_title: string
      signature_url: string
    }
    [key: string]: any
  } | null
}

export interface SectionProps {
  eventId: string
  formData: Partial<EventSettings>
  updateField: (field: keyof EventSettings, value: any) => void
  setFormData: React.Dispatch<React.SetStateAction<Partial<EventSettings>>>
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
