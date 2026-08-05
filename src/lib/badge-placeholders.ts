export interface BadgeRegistrationLike {
  attendee_name?: string
  registration_number?: string
  ticket_types?: { name?: string }
  attendee_email?: string
  attendee_phone?: string
  attendee_institution?: string
  attendee_designation?: string
  checkin_token?: string
  registration_addons?: { addons?: { name?: string } | null }[]
}

export interface BadgeEventLike {
  name?: string
  start_date?: string
  end_date?: string
}

export function replacePlaceholders(
  text: string,
  registration: BadgeRegistrationLike | undefined,
  event: BadgeEventLike | undefined
): string {
  if (!text) return ""
  let result = text
  result = result.replace(/\{\{name\}\}/g, registration?.attendee_name || "John Doe")
  result = result.replace(/\{\{registration_number\}\}/g, registration?.registration_number || "REG001")
  result = result.replace(/\{\{ticket_type\}\}/g, registration?.ticket_types?.name || "Delegate")
  result = result.replace(/\{\{email\}\}/g, registration?.attendee_email || "email@example.com")
  result = result.replace(/\{\{phone\}\}/g, registration?.attendee_phone || "+91 9876543210")
  result = result.replace(/\{\{institution\}\}/g, registration?.attendee_institution || "Institution")
  result = result.replace(/\{\{designation\}\}/g, registration?.attendee_designation || "Designation")
  result = result.replace(/\{\{event_name\}\}/g, event?.name || "Event Name")

  const addonNames = (registration?.registration_addons || [])
    .map((ra) => ra.addons?.name)
    .filter(Boolean)
    .join(", ")
  result = result.replace(/\{\{addons\}\}/g, addonNames || "")

  const checkinToken = registration?.checkin_token || registration?.registration_number || "TOKEN"
  result = result.replace(/\{\{checkin_token\}\}/g, checkinToken)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "")
  result = result.replace(/\{\{checkin_url\}\}/g, `${baseUrl}/v/${checkinToken}`)
  result = result.replace(/\{\{verify_url\}\}/g, `${baseUrl}/v/${checkinToken}`)

  if (event?.start_date && event?.end_date) {
    const start = new Date(event.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    const end = new Date(event.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    result = result.replace(/\{\{event_date\}\}/g, `${start} - ${end}`)
  } else {
    result = result.replace(/\{\{event_date\}\}/g, "Event Date")
  }
  return result
}

export function applyTextCase(text: string, textCase?: string): string {
  if (!text) return text
  switch (textCase) {
    case "uppercase": return text.toUpperCase()
    case "lowercase": return text.toLowerCase()
    case "capitalize": return text.toLowerCase().replace(/(?:^|[\s.])([a-z])/g, (match) => match.toUpperCase())
    default: return text
  }
}
