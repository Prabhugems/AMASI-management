# Faculty Invitation Letter Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an ESSURG 2026 admin generate one of 6 formal faculty letter templates (Initial Invitation, Assignment Confirmation, Chairperson/Moderator, Workshop Faculty, Live/Operative Video Faculty, Visa Support) as a branded, dual-signed PDF from the Speakers/Invitations admin page.

**Architecture:** A pure-function template registry (`faculty-letter-templates.ts`) declares each template's per-recipient field schema and produces structured letter content (subject, paragraphs, detail rows, closing paragraphs) from filled field values. A new POST route renders that content into a PDF using the same jsPDF visual system as the existing `invitation-pdf` route (header band, addressee block, now generalized detail box) plus a Ref/Subject line and a dual-signature footer. A new Sheet component on the Speakers/Invitations page lets an admin pick a template, fill in a dynamically-rendered form (prefilled from `faculty_assignments` where available), and download the generated PDF.

**Tech Stack:** Next.js 16 App Router, TypeScript, jsPDF (existing dependency), Supabase (admin client, no schema changes), vitest (existing, for the new pure-logic module), shadcn/ui (`Sheet`, `Select`, `Input`, `Textarea`, `Button`).

## Global Constraints

- No DB migrations. Everything new lives in `events.settings` (JSONB) or is ephemeral request/response data — per the approved spec (`docs/superpowers/specs/2026-07-25-faculty-invitation-letter-templates-design.md`), this project has a standing rule that no migration is applied without explicit user go, on a pipeline that's currently broken.
- No persistence of generated letters — regenerating means re-filling the form. Nothing is written to any table by the new PDF route.
- Download-only delivery. No "email as attachment" — the primary email provider (Blastable) doesn't support attachments (see `src/lib/email.ts`); wiring that button would silently produce letter-less emails.
- The 6 templates' fixed wording is hardcoded TypeScript, not admin-editable — matches the docx closely, only the recipient-specific blanks are form-driven.
- Follow the two bug-fix patterns already merged into `invitation-pdf/route.ts` (commit `66d624e` on `main`): guard against sentinel strings like `"None"`/`"N/A"` wherever a DB text field is displayed, and measure text before drawing background bands (don't hardcode a header height/offset that can collide with wrapped text).
- Existing `invitation-pdf` route stays untouched. This is a new, additional route (`faculty-letter-pdf`) — no regression risk to the current generic invitation link used elsewhere.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/services/faculty-letter-templates.ts` (new) | Pure template registry: field schemas + content builders for all 6 templates. No I/O, no jsPDF. |
| `src/lib/services/faculty-letter-templates.test.ts` (new) | Unit tests for the registry and date-formatting helper. |
| `src/app/events/[eventId]/settings/types.ts` (modify) | Add `letter_signers` to `EventSettings.settings`. |
| `src/app/events/[eventId]/settings/general-section.tsx` (modify) | Add title + signature-image fields under Scientific Chairman and Organizing Chairman. |
| `src/app/api/events/[eventId]/faculty-letter-pdf/route.ts` (new) | `POST` — auth, fetch event/registration/signers, render the selected template to a PDF, return as a download. |
| `src/app/events/[eventId]/speakers/invitations/letter-composer-sheet.tsx` (new) | Self-contained composer UI: template picker + dynamic field form + generate/download. |
| `src/app/events/[eventId]/speakers/invitations/page.tsx` (modify) | Add a "Generate Letter" action wired to the new composer; reuses data it already fetches. |

---

## Task 1: Letter template registry (pure logic, TDD)

**Files:**
- Create: `src/lib/services/faculty-letter-templates.ts`
- Test: `src/lib/services/faculty-letter-templates.test.ts`

**Interfaces:**
- Produces (used by Task 3): `LETTER_TEMPLATES: Record<string, LetterTemplate>`, `LetterTemplate { key: string; label: string; fields: LetterFieldDef[]; build: (fields: Record<string,string>, event: LetterEventInfo) => LetterContent }`, `LetterFieldDef { key: string; label: string; type: "text" | "textarea" | "date"; placeholder?: string }`, `LetterEventInfo { name: string; edition?: number | null; dateRange: string; venue: string; city: string; contactEmail?: string | null }`, `LetterContent { subject: string; addresseeMode: "recipient" | "consular"; paragraphs: string[]; detailRows: { label: string; value: string }[]; closingParagraphs: string[] }`, `renderFields(template: LetterTemplate, rawFields: Record<string,string>): Record<string,string>` (formats `type: "date"` fields from `yyyy-mm-dd` to a display string before they reach `build`).
- Consumes: nothing (no imports from the rest of the app).

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/faculty-letter-templates.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { LETTER_TEMPLATES, renderFields } from "./faculty-letter-templates"

describe("LETTER_TEMPLATES", () => {
  it("has exactly the 6 expected templates", () => {
    expect(Object.keys(LETTER_TEMPLATES).sort()).toEqual([
      "assignment_confirmation",
      "chairperson_invitation",
      "initial_invitation",
      "live_surgery_faculty",
      "visa_support",
      "workshop_faculty",
    ])
  })

  it("every template's fields have unique keys", () => {
    for (const template of Object.values(LETTER_TEMPLATES)) {
      const keys = template.fields.map((f) => f.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("only visa_support uses consular addressee mode", () => {
    const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }
    for (const [key, template] of Object.entries(LETTER_TEMPLATES)) {
      const fields: Record<string, string> = {}
      for (const f of template.fields) fields[f.key] = "x"
      const content = template.build(fields, event)
      expect(content.addresseeMode).toBe(key === "visa_support" ? "consular" : "recipient")
    }
  })
})

describe("initial_invitation", () => {
  const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }

  it("interpolates fields into the narrative paragraphs", () => {
    const template = LETTER_TEMPLATES.initial_invitation
    const fields: Record<string, string> = {
      specialty: "Laparoscopic Surgery",
      facultyRole: "Invited Speaker",
      trackSession: "Advanced Laparoscopy Track",
      contributionFormat: "Lecture",
      proposedTitle: "Innovations in Hernia Repair",
      duration: "20 minutes",
      mainRegistration: "Complimentary",
      workshopSocialEvents: "Not included",
      travel: "Not covered",
      accommodation: "Not covered",
      localTransport: "Not covered",
      honorariumVisa: "Nil",
      acceptanceDeadline: "15 October 2026",
    }
    const content = template.build(fields, event)
    expect(content.subject).toContain("ESSURG 2026")
    expect(content.paragraphs.join(" ")).toContain("28th Annual Conference of the European Society of Surgery")
    expect(content.paragraphs.join(" ")).toContain("Laparoscopic Surgery")
    expect(content.paragraphs.join(" ")).toContain('"Innovations in Hernia Repair"')
    expect(content.detailRows).toContainEqual({ label: "Main registration", value: "Complimentary" })
    expect(content.closingParagraphs.join(" ")).toContain("15 October 2026")
  })
})

describe("visa_support", () => {
  it("builds a consular addressee block from embassyName/embassyCity", () => {
    const template = LETTER_TEMPLATES.visa_support
    expect(template.fields.some((f) => f.key === "embassyName")).toBe(true)
    expect(template.fields.some((f) => f.key === "embassyCity")).toBe(true)
    const fields: Record<string, string> = {}
    for (const f of template.fields) fields[f.key] = "x"
    fields.fullLegalName = "Dr. Jane Smith"
    fields.nationality = "British"
    const event = { name: "ESSURG 2026", edition: 28, dateRange: "27-29 November 2026", venue: "Kalakriti Cultural & Convention Centre", city: "Agra" }
    const content = template.build(fields, event)
    expect(content.subject).toContain("Dr. Jane Smith")
    expect(content.paragraphs.join(" ")).toContain("British")
  })
})

describe("renderFields", () => {
  it("formats date-typed fields to a display string and leaves others untouched", () => {
    const template = LETTER_TEMPLATES.assignment_confirmation
    const raw: Record<string, string> = {}
    for (const f of template.fields) raw[f.key] = f.type === "date" ? "2026-10-15" : "plain text"
    const out = renderFields(template, raw)
    expect(out.sessionDate).toBe("15 October 2026")
    expect(out.trackSession).toBe("plain text")
  })

  it("returns an empty string for a missing field instead of throwing", () => {
    const template = LETTER_TEMPLATES.chairperson_invitation
    const out = renderFields(template, {})
    for (const f of template.fields) expect(out[f.key]).toBe("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/services/faculty-letter-templates.test.ts`
Expected: FAIL with `Cannot find module './faculty-letter-templates'` (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/services/faculty-letter-templates.ts`:

```ts
export type LetterFieldType = "text" | "textarea" | "date"

export interface LetterFieldDef {
  key: string
  label: string
  type: LetterFieldType
  placeholder?: string
}

export interface LetterEventInfo {
  name: string
  edition?: number | null
  dateRange: string
  venue: string
  city: string
  contactEmail?: string | null
}

export interface LetterDetailRow {
  label: string
  value: string
}

export interface LetterContent {
  subject: string
  addresseeMode: "recipient" | "consular"
  paragraphs: string[]
  detailRows: LetterDetailRow[]
  closingParagraphs: string[]
}

export interface LetterTemplate {
  key: string
  label: string
  fields: LetterFieldDef[]
  build: (fields: Record<string, string>, event: LetterEventInfo) => LetterContent
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

// "28th Annual " (with trailing space) so callers can splice it directly
// before "Conference of the European Society of Surgery" — empty string
// when the event has no edition number set, so the sentence still reads.
function editionPrefix(edition?: number | null): string {
  return edition ? `${ordinal(edition)} Annual ` : ""
}

function formatDisplayDate(iso: string): string {
  if (!iso) return ""
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
}

// Registrations/settings data has occasionally been imported/backfilled with
// literal sentinel strings ("None"/"N/A") instead of real nulls (see the same
// guard in invitation-pdf/route.ts). Composer fields are free text typed by
// an admin, not imported data, so this only needs to handle the date-format
// step here — kept as a single pass over the template's own field schema so
// a missing key never throws and always resolves to "".
export function renderFields(template: LetterTemplate, rawFields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of template.fields) {
    const raw = rawFields[f.key] || ""
    out[f.key] = f.type === "date" ? formatDisplayDate(raw) : raw
  }
  return out
}

const initialInvitation: LetterTemplate = {
  key: "initial_invitation",
  label: "Initial Invitation to Join Faculty",
  fields: [
    { key: "specialty", label: "Specialty / Field", type: "text", placeholder: "e.g. Laparoscopic Surgery" },
    { key: "facultyRole", label: "Proposed Faculty Role", type: "text", placeholder: "e.g. Invited Speaker" },
    { key: "trackSession", label: "Track / Session / Workshop", type: "text", placeholder: "e.g. Advanced Laparoscopy Track" },
    { key: "contributionFormat", label: "Contribution Format", type: "text", placeholder: "Lecture / Panel / Workshop / Video" },
    { key: "proposedTitle", label: "Proposed Title", type: "text", placeholder: "e.g. Innovations in Laparoscopic Hernia Repair" },
    { key: "duration", label: "Duration", type: "text", placeholder: "e.g. 20 minutes" },
    { key: "mainRegistration", label: "Main Registration", type: "text", placeholder: "e.g. Complimentary main-conference registration" },
    { key: "workshopSocialEvents", label: "Workshop / Social Events", type: "text", placeholder: "e.g. Not included" },
    { key: "travel", label: "Travel", type: "text", placeholder: "e.g. Not covered" },
    { key: "accommodation", label: "Accommodation", type: "text", placeholder: "e.g. Not covered" },
    { key: "localTransport", label: "Local Transport", type: "text", placeholder: "e.g. Not covered" },
    { key: "honorariumVisa", label: "Honorarium / Visa Support", type: "text", placeholder: "e.g. Nil; visa support available" },
    { key: "acceptanceDeadline", label: "Acceptance Deadline", type: "date" },
  ],
  build: (fields, event) => ({
    subject: `Invitation to Join the Faculty of ${event.name}${event.city ? `, ${event.city}` : ""}`,
    addresseeMode: "recipient",
    paragraphs: [
      `On behalf of the European Society of Surgery (ESS), the Scientific Committee and the Organising Committee, we are pleased to invite you to join the faculty of ${event.name} - the ${editionPrefix(event.edition)}Conference of the European Society of Surgery - to be held from ${event.dateRange} at ${event.venue}.`,
      `In recognition of your expertise in ${fields.specialty}, we propose your participation as ${fields.facultyRole} in ${fields.trackSession}. Your tentative contribution is ${fields.contributionFormat} titled "${fields.proposedTitle}" for ${fields.duration}. The final topic, timing and format will be confirmed after Scientific Committee approval.`,
    ],
    detailRows: [
      { label: "Main registration", value: fields.mainRegistration },
      { label: "Workshop / social events", value: fields.workshopSocialEvents },
      { label: "Travel", value: fields.travel },
      { label: "Accommodation", value: fields.accommodation },
      { label: "Local transport", value: fields.localTransport },
      { label: "Honorarium / visa support", value: fields.honorariumVisa },
    ],
    closingParagraphs: [
      "Only the items expressly stated above are included. Flight or room upgrades, accompanying-person costs, personal expenses, extended stay and unlisted events are not covered unless separately approved in writing.",
      `Kindly confirm your acceptance by ${fields.acceptanceDeadline} and send your official name and credentials, affiliation, mobile number, 150-word biography, recent photograph, conflict-of-interest disclosure, and passport/visa details where applicable. A separate assignment letter and faculty declaration will follow.`,
      `We would be honoured by your participation and look forward to welcoming you${event.city ? ` to ${event.city}` : ""}.`,
    ],
  }),
}

const assignmentConfirmation: LetterTemplate = {
  key: "assignment_confirmation",
  label: "Speaker / Panelist Assignment Confirmation",
  fields: [
    { key: "facultyRole", label: "Faculty Role", type: "text", placeholder: "Invited Speaker / Panelist / Discussant / Keynote Faculty" },
    { key: "trackSession", label: "Track / Session", type: "text", placeholder: "e.g. Advanced Laparoscopy Track" },
    { key: "presentationTopic", label: "Presentation / Panel Topic", type: "text", placeholder: "Final title" },
    { key: "sessionDate", label: "Session Date", type: "date" },
    { key: "sessionTime", label: "Session Time", type: "text", placeholder: "e.g. 10:00 AM - 10:20 AM" },
    { key: "hall", label: "Hall / Location", type: "text", placeholder: "e.g. Hall A" },
    { key: "timeAllocation", label: "Time Allocation", type: "text", placeholder: "e.g. 15 min presentation + 5 min Q&A" },
    { key: "finalTitleDeadline", label: "Final Title Deadline", type: "date" },
    { key: "bioDeadline", label: "Bio / Photo / Disclosure Deadline", type: "date" },
    { key: "slidesDeadline", label: "Slides Deadline", type: "date" },
    { key: "reportingMinutes", label: "Report to AV Desk (minutes before session)", type: "text", placeholder: "e.g. 30" },
    { key: "registration", label: "Registration", type: "text", placeholder: "e.g. Complimentary main-conference registration" },
    { key: "travelStay", label: "Travel and Stay", type: "text", placeholder: "e.g. Not covered" },
    { key: "localTransfers", label: "Local Transfers", type: "text", placeholder: "e.g. Not covered" },
    { key: "honorarium", label: "Honorarium", type: "text", placeholder: "e.g. Nil" },
    { key: "reconfirmDeadline", label: "Reconfirmation Deadline", type: "date" },
  ],
  build: (fields, event) => ({
    subject: `Confirmation of Faculty Role and Scientific Assignment - ${event.name}`,
    addresseeMode: "recipient",
    paragraphs: [
      `Thank you for accepting our invitation. We are delighted to confirm your participation in ${event.name} as detailed below. Please review every item and notify the Secretariat promptly if any correction is required.`,
    ],
    detailRows: [
      { label: "Faculty role", value: fields.facultyRole },
      { label: "Track / session", value: fields.trackSession },
      { label: "Presentation / panel topic", value: fields.presentationTopic },
      { label: "Date and time", value: `${fields.sessionDate}, ${fields.sessionTime}` },
      { label: "Hall / location", value: fields.hall },
      { label: "Time allocation", value: fields.timeAllocation },
      { label: "Registration", value: fields.registration },
      { label: "Travel and stay", value: fields.travelStay },
      { label: "Local transfers", value: fields.localTransfers },
      { label: "Honorarium", value: fields.honorarium },
    ],
    closingParagraphs: [
      `Faculty requirements: confirm the final title by ${fields.finalTitleDeadline} and submit a short biography, recent photograph and conflict-of-interest disclosure by ${fields.bioDeadline}. Submit 16:9 PowerPoint/PDF slides by ${fields.slidesDeadline} and report to the Speaker Ready / AV Desk at least ${fields.reportingMinutes} minutes before the session.`,
      "Remove patient identifiers and obtain permissions for third-party images, videos and copyrighted material. A separate recording/photography consent will apply. Please keep strictly to time and present balanced, evidence-based content with clear disclosure of relevant commercial relationships.",
      `Please reconfirm this assignment by ${fields.reconfirmDeadline}. The Scientific Committee may make reasonable programme adjustments and will communicate any material change as early as possible.`,
    ],
  }),
}

const chairpersonInvitation: LetterTemplate = {
  key: "chairperson_invitation",
  label: "Session Chairperson / Moderator Invitation",
  fields: [
    { key: "role", label: "Role", type: "text", placeholder: "Chairperson / Co-Chair / Moderator" },
    { key: "sessionTitle", label: "Session Title", type: "text" },
    { key: "sessionDate", label: "Session Date", type: "date" },
    { key: "sessionTime", label: "Session Time", type: "text", placeholder: "e.g. 2:00 PM - 3:00 PM" },
    { key: "hall", label: "Hall", type: "text" },
    { key: "coChair", label: "Co-Chair / Moderator", type: "text", placeholder: "Name(s) or To be confirmed" },
    { key: "reportingTime", label: "Reporting Time", type: "text", placeholder: "e.g. 20-30 minutes before session" },
    { key: "registration", label: "Registration", type: "text", placeholder: "e.g. Complimentary main-conference registration" },
    { key: "travelAccommodation", label: "Travel / Accommodation", type: "text", placeholder: "e.g. Not covered" },
    { key: "localTransportHonorarium", label: "Local Transport / Honorarium", type: "text", placeholder: "e.g. Not covered / Nil" },
    { key: "acceptanceDeadline", label: "Acceptance Deadline", type: "date" },
  ],
  build: (fields, event) => ({
    subject: `Invitation to Serve as ${fields.role} at ${event.name}`,
    addresseeMode: "recipient",
    paragraphs: [
      `We are pleased to invite you to serve as ${fields.role} for the following ${event.name} session. Your leadership will be important in maintaining academic quality, time discipline and constructive discussion.`,
    ],
    detailRows: [
      { label: "Session title", value: fields.sessionTitle },
      { label: "Role", value: fields.role },
      { label: "Date and time", value: `${fields.sessionDate}, ${fields.sessionTime}` },
      { label: "Hall", value: fields.hall },
      { label: "Co-chair / moderator", value: fields.coChair },
      { label: "Reporting time", value: fields.reportingTime },
      { label: "Registration", value: fields.registration },
      { label: "Travel / accommodation", value: fields.travelAccommodation },
      { label: "Local transport / honorarium", value: fields.localTransportHonorarium },
    ],
    closingParagraphs: [
      "Expected responsibilities: review the session plan and speaker details in advance and inform the Secretariat of any conflict, absence or correction; introduce the session and speakers, maintain the published time limits, facilitate questions and close the session on time; maintain academic neutrality, ensure relevant disclosures are acknowledged and prevent promotional or unbalanced discussion; coordinate with the hall manager and Scientific Committee if a speaker is absent, a technical problem occurs or the programme changes.",
      `Kindly confirm your acceptance by ${fields.acceptanceDeadline}. A final session sheet and speaker contact details will be shared closer to the conference.`,
    ],
  }),
}

const workshopFaculty: LetterTemplate = {
  key: "workshop_faculty",
  label: "Workshop Faculty / Instructor Invitation",
  fields: [
    { key: "workshopTitle", label: "Workshop Title", type: "text" },
    { key: "facultyRoleStation", label: "Faculty Role / Station", type: "text", placeholder: "Course Director / Instructor / Demonstrator / Station Topic" },
    { key: "workshopDate", label: "Workshop Date", type: "date" },
    { key: "workshopTime", label: "Workshop Time", type: "text", placeholder: "e.g. 9:00 AM - 1:00 PM" },
    { key: "venueRoom", label: "Venue / Room", type: "text" },
    { key: "briefingDateTime", label: "Faculty Briefing", type: "text", placeholder: "Date and time" },
    { key: "participantCapacity", label: "Participant Capacity", type: "text", placeholder: "e.g. 20 per batch" },
    { key: "materialsDeadline", label: "Equipment / Materials List Deadline", type: "date" },
    { key: "workshopRegistration", label: "Workshop Registration", type: "text", placeholder: "e.g. Complimentary / Included / Not applicable" },
    { key: "mainRegistration", label: "Main Registration", type: "text", placeholder: "e.g. Included" },
    { key: "travelAccommodation", label: "Travel / Accommodation", type: "text", placeholder: "e.g. Not covered" },
    { key: "honorariumMaterials", label: "Honorarium / Materials", type: "text", placeholder: "e.g. Nil; material support terms" },
    { key: "acceptanceDeadline", label: "Acceptance Deadline", type: "date" },
  ],
  build: (fields, event) => ({
    subject: `Invitation to Serve as Workshop Faculty / Instructor - ${event.name}`,
    addresseeMode: "recipient",
    paragraphs: [
      `We are pleased to invite you to join the faculty of the following ${event.name} workshop. The workshop is intended to provide structured, practical and ethically governed learning under Scientific Committee oversight.`,
    ],
    detailRows: [
      { label: "Workshop", value: fields.workshopTitle },
      { label: "Faculty role / station", value: fields.facultyRoleStation },
      { label: "Date and time", value: `${fields.workshopDate}, ${fields.workshopTime}` },
      { label: "Venue / room", value: fields.venueRoom },
      { label: "Faculty briefing", value: fields.briefingDateTime },
      { label: "Participant capacity", value: fields.participantCapacity },
      { label: "Workshop registration", value: fields.workshopRegistration },
      { label: "Main registration", value: fields.mainRegistration },
      { label: "Travel / accommodation", value: fields.travelAccommodation },
      { label: "Honorarium / materials", value: fields.honorariumMaterials },
    ],
    closingParagraphs: [
      `Workshop responsibilities and safeguards: attend the faculty briefing, follow the agreed learning objectives and submit the equipment, consumables and teaching-material list by ${fields.materialsDeadline}; comply with applicable safety, infection-control, equipment, simulation, specimen/cadaver and venue rules, and stop any activity that is unsafe; any patient interaction, invasive procedure or use of identifiable clinical material requires separate institutional approval and informed consent; disclose relevant company/device relationships and keep instruction educational rather than promotional.`,
      `Please confirm by ${fields.acceptanceDeadline} and submit your bio, photograph, conflict-of-interest disclosure and final station requirements. The Organising Committee may modify or cancel the workshop if approvals, enrolment, safety requirements or logistics are not adequate.`,
    ],
  }),
}

const liveSurgeryFaculty: LetterTemplate = {
  key: "live_surgery_faculty",
  label: "Live / Operative Video Faculty Invitation",
  fields: [
    { key: "facultyRole", label: "Faculty Role", type: "text", placeholder: "Operating Surgeon / Commentator / Video Presenter" },
    { key: "procedureTopic", label: "Procedure / Topic", type: "text" },
    { key: "format", label: "Format", type: "text", placeholder: "Live Surgery / Unedited Video / Edited Operative Video / Commentary" },
    { key: "hostInstitution", label: "Host Institution", type: "text", placeholder: "Hospital / operating site / Not applicable for video" },
    { key: "provisionalDateTime", label: "Provisional Date/Time", type: "text", placeholder: "e.g. 28 November 2026, 2:00 PM - 3:00 PM" },
    { key: "leadClinicalTeam", label: "Lead Clinical Team", type: "text", placeholder: "Names / roles" },
    { key: "transmissionRecording", label: "Transmission / Recording", type: "text", placeholder: "Live link / Recording / No archive / Subject to separate consent" },
    { key: "travelStay", label: "Travel / Stay", type: "text", placeholder: "e.g. Not covered" },
    { key: "professionalCover", label: "Professional Cover", type: "text", placeholder: "Host-institution / faculty / other approved arrangement" },
    { key: "equipmentDevices", label: "Equipment / Devices", type: "text", placeholder: "Approved list and responsible party" },
    { key: "acceptanceDeadline", label: "Acceptance Deadline", type: "date" },
  ],
  build: (fields, event) => ({
    subject: `Provisional Invitation as Live / Operative Video Faculty - ${event.name}`,
    addresseeMode: "recipient",
    paragraphs: [
      `We are pleased to invite you, on a provisional basis, to participate as ${fields.facultyRole} for ${fields.procedureTopic} during ${event.name}.`,
      "This invitation becomes effective only after written clearance by the Scientific Committee and host institution, satisfactory credentialing, patient consent, all required ethics/administrative/legal approvals, insurance or indemnity arrangements, and confirmation of technical feasibility.",
    ],
    detailRows: [
      { label: "Format", value: fields.format },
      { label: "Procedure / topic", value: fields.procedureTopic },
      { label: "Host institution", value: fields.hostInstitution },
      { label: "Provisional date/time", value: fields.provisionalDateTime },
      { label: "Lead clinical team", value: fields.leadClinicalTeam },
      { label: "Transmission / recording", value: fields.transmissionRecording },
      { label: "Travel / stay", value: fields.travelStay },
      { label: "Professional cover", value: fields.professionalCover },
      { label: "Equipment / devices", value: fields.equipmentDevices },
    ],
    closingParagraphs: [
      "Essential conditions: patient welfare and the authority of the host clinical team override the programme, and the procedure or transmission may be delayed, converted or cancelled at any time for safety; written consent must separately cover the clinical procedure and any broadcast, photography, recording or later educational use, and all displayed data must be appropriately de-identified; faculty must comply with credentialing, infection control, approved devices/medicines, data protection, institutional policies and applicable professional standards; relevant conflicts and sponsor relationships must be disclosed, and scientific and clinical decisions must remain independent of commercial support; a clinical and technical contingency plan is mandatory, and the conference does not guarantee uninterrupted transmission or publication of the material.",
      `Please provide the documents listed by the host institution and confirm acceptance by ${fields.acceptanceDeadline}. A separate clinical, consent, credentialing and technical protocol must be completed before final confirmation.`,
    ],
  }),
}

const visaSupport: LetterTemplate = {
  key: "visa_support",
  label: "International Faculty Visa Support Letter",
  fields: [
    { key: "embassyName", label: "Embassy / High Commission / Consulate", type: "text" },
    { key: "embassyCity", label: "Embassy City, Country", type: "text" },
    { key: "fullLegalName", label: "Full Legal Name (as in passport)", type: "text" },
    { key: "nationality", label: "Nationality", type: "text" },
    { key: "passportNumber", label: "Passport Number", type: "text" },
    { key: "passportValidity", label: "Passport Valid Until", type: "date" },
    { key: "institutionDesignation", label: "Institution and Designation", type: "text" },
    { key: "conferenceRole", label: "Conference Role", type: "text", placeholder: "Invited Speaker / Chair / Workshop Faculty / Other" },
    { key: "travelDatesArrival", label: "Proposed Arrival Date", type: "date" },
    { key: "travelDatesDeparture", label: "Proposed Departure Date", type: "date" },
    { key: "accommodationIndia", label: "Accommodation in India", type: "textarea", placeholder: "Hotel name, address, check-in/check-out" },
    { key: "airTravel", label: "Air Travel", type: "text", placeholder: "Self-funded / Organiser-booked / Reimbursable up to approved limit" },
    { key: "accommodationHospitality", label: "Accommodation / Hospitality", type: "text", placeholder: "Covered as stated / Self-funded" },
    { key: "registration", label: "Registration", type: "text", placeholder: "Complimentary / Paid" },
    { key: "honorarium", label: "Honorarium", type: "text", placeholder: "Nil / Approved amount and tax terms" },
  ],
  build: (fields, event) => ({
    subject: `Visa Support for ${fields.fullLegalName} - Invited Faculty, ${event.name}`,
    addresseeMode: "consular",
    paragraphs: [
      `This is to confirm that ${fields.fullLegalName}, an invited faculty member from ${fields.nationality}, has been invited to participate in ${event.name} - the ${editionPrefix(event.edition)}Conference of the European Society of Surgery - to be held from ${event.dateRange} at ${event.venue}.`,
    ],
    detailRows: [
      { label: "Full name as in passport", value: fields.fullLegalName },
      { label: "Nationality", value: fields.nationality },
      { label: "Passport number / validity", value: `${fields.passportNumber}; valid until ${fields.passportValidity}` },
      { label: "Institution and designation", value: fields.institutionDesignation },
      { label: "Conference role", value: fields.conferenceRole },
      { label: "Proposed travel dates", value: `${fields.travelDatesArrival} - ${fields.travelDatesDeparture}` },
      { label: "Accommodation in India", value: fields.accommodationIndia },
      { label: "Air travel", value: fields.airTravel },
      { label: "Accommodation / hospitality", value: fields.accommodationHospitality },
      { label: "Registration", value: fields.registration },
      { label: "Honorarium", value: fields.honorarium },
    ],
    closingParagraphs: [
      "The visit is for participation in an academic, scientific and educational conference. It does not constitute employment in India. The invited faculty member is expected to depart India after completion of the approved visit.",
      `We respectfully request that the appropriate visa be considered to enable the above faculty member to attend the conference. For verification, please contact the ${event.name} Secretariat${event.contactEmail ? ` at ${event.contactEmail}` : ""}.`,
      "This letter is issued solely in support of the visa application and does not guarantee visa issuance. All information should match the passport, invitation acceptance and travel plan.",
    ],
  }),
}

export const LETTER_TEMPLATES: Record<string, LetterTemplate> = {
  initial_invitation: initialInvitation,
  assignment_confirmation: assignmentConfirmation,
  chairperson_invitation: chairpersonInvitation,
  workshop_faculty: workshopFaculty,
  live_surgery_faculty: liveSurgeryFaculty,
  visa_support: visaSupport,
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/services/faculty-letter-templates.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full existing suite to confirm nothing else broke**

Run: `npm test`
Expected: PASS (all existing tests plus the 7 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/faculty-letter-templates.ts src/lib/services/faculty-letter-templates.test.ts
git commit -m "feat(letters): add faculty invitation letter template registry"
```

---

## Task 2: Dual signer settings (type + UI)

**Files:**
- Modify: `src/app/events/[eventId]/settings/types.ts`
- Modify: `src/app/events/[eventId]/settings/general-section.tsx`

**Interfaces:**
- Produces (used by Task 3): `event.settings.letter_signers?.scientific?: { title: string; signature_url: string }`, `event.settings.letter_signers?.organizing?: { title: string; signature_url: string }` — names come from the existing `event.scientific_chairman` / `event.organizing_chairman` columns, not from this new object.
- Consumes: existing `ImageUpload` component (`src/components/ui/image-upload.tsx`), existing `SectionProps`/`updateField`/`setFormData` plumbing already used by `speaker_invitation` in the same file.

- [ ] **Step 1: Add the type**

In `src/app/events/[eventId]/settings/types.ts`, extend the `settings` field of `EventSettings` (currently only declares `speaker_invitation`):

```ts
  settings: {
    speaker_invitation?: {
      signer_name: string
      signer_title: string
      signature_url: string
    }
    letter_signers?: {
      scientific?: { title: string; signature_url: string }
      organizing?: { title: string; signature_url: string }
    }
    [key: string]: any
  } | null
```

- [ ] **Step 2: Add the UI fields**

In `src/app/events/[eventId]/settings/general-section.tsx`, replace the existing Scientific Chairman / Organizing Chairman grid block (currently just two `Input`s side by side) with a version that adds a title + signature image under each name field:

```tsx
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Scientific Chairman</label>
                <Input
                  value={formData.scientific_chairman || ""}
                  onChange={(e) => updateField("scientific_chairman", e.target.value)}
                  placeholder="Dr. John Doe"
                  maxLength={100}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.settings?.letter_signers?.scientific?.title || ""}
                  onChange={(e) => {
                    const current = formData.settings || {}
                    const signers = current.letter_signers || {}
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...current,
                        letter_signers: {
                          ...signers,
                          scientific: { ...(signers.scientific || { title: "", signature_url: "" }), title: e.target.value },
                        },
                      },
                    }))
                  }}
                  placeholder="Chairman, Scientific Committee"
                  maxLength={80}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Signature Image</label>
                <ImageUpload
                  value={formData.settings?.letter_signers?.scientific?.signature_url || ""}
                  onChange={(url) => {
                    const current = formData.settings || {}
                    const signers = current.letter_signers || {}
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...current,
                        letter_signers: {
                          ...signers,
                          scientific: { ...(signers.scientific || { title: "", signature_url: "" }), signature_url: url },
                        },
                      },
                    }))
                  }}
                  eventId={eventId}
                  folder={`events/${eventId}/scientific-chairman-signature`}
                  aspectRatio="banner"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground">Organizing Chairman</label>
                <Input
                  value={formData.organizing_chairman || ""}
                  onChange={(e) => updateField("organizing_chairman", e.target.value)}
                  placeholder="Dr. Jane Smith"
                  maxLength={100}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.settings?.letter_signers?.organizing?.title || ""}
                  onChange={(e) => {
                    const current = formData.settings || {}
                    const signers = current.letter_signers || {}
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...current,
                        letter_signers: {
                          ...signers,
                          organizing: { ...(signers.organizing || { title: "", signature_url: "" }), title: e.target.value },
                        },
                      },
                    }))
                  }}
                  placeholder="Chairman, Organising Committee"
                  maxLength={80}
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Signature Image</label>
                <ImageUpload
                  value={formData.settings?.letter_signers?.organizing?.signature_url || ""}
                  onChange={(url) => {
                    const current = formData.settings || {}
                    const signers = current.letter_signers || {}
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...current,
                        letter_signers: {
                          ...signers,
                          organizing: { ...(signers.organizing || { title: "", signature_url: "" }), signature_url: url },
                        },
                      },
                    }))
                  }}
                  eventId={eventId}
                  folder={`events/${eventId}/organizing-chairman-signature`}
                  aspectRatio="banner"
                />
              </div>
            </div>
          </div>
```

This block replaces the existing plain two-`Input` grid at (currently) lines 270-291 of `general-section.tsx` — leave the pre-existing single "Signatory Title" / "Signature Image" fields further down (lines 293-315) untouched; those still drive the existing `invitation-pdf` route and are a separate, still-valid single-signer fallback.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "general-section\|settings/types"`
Expected: no output (no errors).

Run: `npx eslint "src/app/events/[eventId]/settings/general-section.tsx" "src/app/events/[eventId]/settings/types.ts"`
Expected: no errors (warnings, if any, must match what was already present before this change — check with `git stash` + re-run if unsure).

- [ ] **Step 4: Manual verification**

1. Run `npm run dev`.
2. Open `http://localhost:3000/events/<any-event-id>/settings` (General tab).
3. Confirm you see, under Scientific Chairman: a Title field and a Signature Image uploader; same under Organizing Chairman.
4. Fill in a title for each, upload any test PNG for each signature.
5. Click **Save Changes**. Confirm the "Settings saved successfully" toast appears.
6. Reload the page. Confirm both titles and both signature images are still populated (round-tripped through `events.settings`).

- [ ] **Step 5: Commit**

```bash
git add src/app/events/[eventId]/settings/types.ts src/app/events/[eventId]/settings/general-section.tsx
git commit -m "feat(settings): add per-chairman title and signature fields for dual-signed letters"
```

---

## Task 3: `POST /api/events/[eventId]/faculty-letter-pdf`

**Files:**
- Create: `src/app/api/events/[eventId]/faculty-letter-pdf/route.ts`

**Interfaces:**
- Consumes: `LETTER_TEMPLATES`, `renderFields`, `LetterEventInfo`, `LetterContent` from `src/lib/services/faculty-letter-templates.ts` (Task 1); `event.settings.letter_signers` shape from Task 2; `requireEventAndPermission` from `src/lib/auth/api-auth.ts`; `createAdminClient` from `src/lib/supabase/server.ts`.
- Produces: `POST` endpoint accepting JSON body `{ template_key: string; registration_id: string; fields: Record<string,string> }`, returning a `application/pdf` binary response (same `Content-Disposition: attachment` pattern as `invitation-pdf/route.ts`) on success, or `NextResponse.json({ error })` with an appropriate status on failure.

- [ ] **Step 1: Write the route**

Create `src/app/api/events/[eventId]/faculty-letter-pdf/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAndPermission } from "@/lib/auth/api-auth"
import { jsPDF } from "jspdf"
import { LETTER_TEMPLATES, renderFields, type LetterEventInfo, type LetterContent } from "@/lib/services/faculty-letter-templates"

// Same sentinel-string guard as invitation-pdf/route.ts — registration data
// has occasionally been imported/backfilled with the literal string "None"
// instead of a real null.
function cleanField(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed || ["none", "n/a", "null", "na"].includes(trimmed.toLowerCase())) return undefined
  return trimmed
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "-"
  const start = new Date(startDate)
  const end = endDate ? new Date(endDate) : null

  const startStr = start.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  if (!end || start.toDateString() === end.toDateString()) return startStr

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
  }
  return `${startStr} - ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
}

function buildRef(shortName: string | null, registrationNumber: string | undefined): string {
  const prefix = (shortName || "EVENT").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const serial = registrationNumber || Math.random().toString(36).slice(2, 8).toUpperCase()
  return `${prefix}/FAC/${serial}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  const { user, error: authError } = await requireEventAndPermission(eventId, "speakers")
  if (authError) return authError
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { template_key, registration_id, fields: rawFields } = body as {
    template_key?: string
    registration_id?: string
    fields?: Record<string, string>
  }

  const template = template_key ? LETTER_TEMPLATES[template_key] : undefined
  if (!template) {
    return NextResponse.json({ error: "Unknown template_key" }, { status: 400 })
  }
  if (!registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 })
  }

  for (const f of template.fields) {
    if (!rawFields?.[f.key]) {
      return NextResponse.json({ error: `Missing required field: ${f.label}` }, { status: 400 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createAdminClient()) as any

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, name, short_name, start_date, end_date, venue_name, city, state, contact_email, scientific_chairman, organizing_chairman, edition, settings")
    .eq("id", eventId)
    .single()
  if (eventError || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 })
  }

  const { data: registration, error: regError } = await supabase
    .from("registrations")
    .select("attendee_name, attendee_designation, attendee_institution, registration_number")
    .eq("id", registration_id)
    .eq("event_id", eventId)
    .single()
  if (regError || !registration) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 })
  }

  const recipient = {
    name: registration.attendee_name as string,
    designation: cleanField(registration.attendee_designation),
    institution: cleanField(registration.attendee_institution),
  }

  const fields = renderFields(template, rawFields || {})

  const eventInfo: LetterEventInfo = {
    name: event.name,
    edition: event.edition,
    dateRange: formatDateRange(event.start_date, event.end_date),
    venue: event.venue_name || "To be announced",
    city: event.city || "",
    contactEmail: event.contact_email,
  }

  const content: LetterContent = template.build(fields, eventInfo)
  // Only visa_support uses "consular" mode; its field schema is the one
  // place that guarantees embassyName/embassyCity keys exist.
  const embassyName = content.addresseeMode === "consular" ? fields.embassyName : undefined
  const embassyCity = content.addresseeMode === "consular" ? fields.embassyCity : undefined

  const letterSigners = event.settings?.letter_signers as
    | { scientific?: { title?: string; signature_url?: string }; organizing?: { title?: string; signature_url?: string } }
    | undefined

  const signers: { name: string; title: string; signature_url?: string }[] = []
  if (event.scientific_chairman && letterSigners?.scientific?.title) {
    signers.push({ name: event.scientific_chairman, title: letterSigners.scientific.title, signature_url: letterSigners.scientific.signature_url })
  }
  if (event.organizing_chairman && letterSigners?.organizing?.title) {
    signers.push({ name: event.organizing_chairman, title: letterSigners.organizing.title, signature_url: letterSigners.organizing.signature_url })
  }

  const pdfBuffer = await renderLetterPdf(
    content,
    recipient,
    eventInfo,
    signers,
    buildRef(event.short_name, registration.registration_number),
    embassyName,
    embassyCity
  )

  const filename = `${template.label.replace(/[^a-zA-Z0-9]/g, "_")}-${recipient.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

async function renderLetterPdf(
  content: LetterContent,
  recipient: { name: string; designation?: string; institution?: string },
  event: LetterEventInfo,
  signers: { name: string; title: string; signature_url?: string }[],
  ref: string,
  embassyName?: string,
  embassyCity?: string
): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin
  let y = 0

  const primary: [number, number, number] = [37, 99, 235]
  const primaryDark: [number, number, number] = [29, 78, 216]
  const dark: [number, number, number] = [15, 23, 42]
  const body: [number, number, number] = [51, 65, 85]
  const muted: [number, number, number] = [100, 116, 139]
  const light: [number, number, number] = [148, 163, 184]

  // === HEADER BAND — measure before draw, same fix as invitation-pdf/route.ts ===
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  const titleLines = doc.splitTextToSize(event.name || "Event", contentWidth - 10)
  const titleStartY = titleLines.length > 1 ? 12 : 15
  const afterTitleY = titleStartY + titleLines.length * 7.5
  const editionY = afterTitleY + 6
  const headerHeight = Math.max(35, editionY + 4)

  doc.setFillColor(...primaryDark)
  doc.rect(0, 0, pageWidth, headerHeight, "F")
  doc.setFillColor(...primary)
  doc.rect(0, 0, pageWidth, headerHeight - 3, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(titleLines, pageWidth / 2, titleStartY, { align: "center", lineHeightFactor: 1.3 })

  if (event.edition) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(255, 255, 255, 160)
    doc.text(`${event.edition} Edition`, pageWidth / 2, editionY, { align: "center" })
  }

  y = headerHeight + 8

  // === DATE + REF ===
  doc.setTextColor(...muted)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
  doc.text(`Date: ${today}`, margin, y)
  y += 5
  doc.text(`Ref: ${ref}`, margin, y)
  y += 9

  // === ADDRESSEE ===
  doc.setTextColor(...dark)
  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text("To,", margin, y)
  y += 5
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  doc.setFontSize(9.5)
  if (content.addresseeMode === "consular") {
    doc.text("The Visa / Consular Officer", margin, y)
    y += 4.5
    if (embassyName) { doc.text(embassyName, margin, y); y += 4.5 }
    if (embassyCity) { doc.text(embassyCity, margin, y); y += 4.5 }
  } else {
    doc.text(recipient.name, margin, y)
    y += 5
    if (recipient.designation) { doc.text(recipient.designation, margin, y); y += 4.5 }
    if (recipient.institution) { doc.text(recipient.institution, margin, y); y += 4.5 }
  }
  y += 6

  // === SUBJECT ===
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...dark)
  const subjectLines = doc.splitTextToSize(`Subject: ${content.subject}`, contentWidth)
  doc.text(subjectLines, margin, y)
  y += subjectLines.length * 4.5 + 6

  // === SALUTATION ===
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...dark)
  doc.text(content.addresseeMode === "consular" ? "Dear Sir/Madam," : `Dear ${recipient.name},`, margin, y)
  y += 8

  // === PARAGRAPHS ===
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  for (const para of content.paragraphs) {
    const lines = doc.splitTextToSize(para, contentWidth)
    if (y + lines.length * 5 > pageHeight - 60) { doc.addPage(); y = 25 }
    doc.text(lines, margin, y, { lineHeightFactor: 1.4 })
    y += lines.length * 5 + 6
  }

  // === DETAIL BOX (dynamic rows) ===
  if (content.detailRows.length > 0) {
    const labelX = margin + 6
    const valueX = margin + 55
    const boxPadding = 5
    const rowHeight = 7
    const detailLines: { label: string; lines: string[] }[] = content.detailRows.map((row) => ({
      label: row.label,
      lines: doc.splitTextToSize(row.value || "-", contentWidth - (valueX - margin) - boxPadding),
    }))
    const totalRowUnits = detailLines.reduce((sum, r) => sum + Math.max(1, r.lines.length), 0)
    const boxHeight = boxPadding * 2 + totalRowUnits * rowHeight

    if (y + boxHeight > pageHeight - 60) { doc.addPage(); y = 25 }

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, "FD")
    doc.setFillColor(...primary)
    doc.rect(margin, y, 3, boxHeight, "F")

    let detailY = y + boxPadding + 4
    doc.setFontSize(9)
    for (const row of detailLines) {
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...dark)
      doc.text(row.label + ":", labelX, detailY)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(...body)
      doc.text(row.lines, valueX, detailY)
      detailY += Math.max(1, row.lines.length) * rowHeight
    }
    y += boxHeight + 8
  }

  // === CLOSING PARAGRAPHS ===
  doc.setFontSize(9.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...body)
  for (const para of content.closingParagraphs) {
    const lines = doc.splitTextToSize(para, contentWidth)
    if (y + lines.length * 5 > pageHeight - 60) { doc.addPage(); y = 25 }
    doc.text(lines, margin, y, { lineHeightFactor: 1.4 })
    y += lines.length * 5 + 6
  }

  // === SIGNATURES (one or two, side by side) ===
  if (y > pageHeight - 60) { doc.addPage(); y = 25 }
  doc.setTextColor(...body)
  doc.setFontSize(9.5)
  doc.text("With warm regards,", margin, y)
  y += 6

  const columnWidth = signers.length > 1 ? contentWidth / 2 : contentWidth
  const signatureRowStartY = y
  let maxSignatureY = y

  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i]
    const colX = margin + i * columnWidth
    let colY = signatureRowStartY

    if (signer.signature_url) {
      try {
        const sigRes = await fetch(signer.signature_url)
        if (sigRes.ok) {
          const sigBuffer = await sigRes.arrayBuffer()
          const sigBase64 = Buffer.from(sigBuffer).toString("base64")
          const contentType = sigRes.headers.get("content-type") || "image/png"
          const imgFormat = contentType.includes("png") ? "PNG" : "JPEG"
          doc.addImage(`data:${contentType};base64,${sigBase64}`, imgFormat, colX, colY, 40, 15)
          colY += 18
        } else {
          colY += 5
        }
      } catch {
        colY += 5
      }
    } else {
      colY += 5
    }

    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.setTextColor(...dark)
    doc.text(signer.name, colX, colY)
    colY += 5
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text(signer.title, colX, colY)

    maxSignatureY = Math.max(maxSignatureY, colY)
  }
  y = maxSignatureY

  // === FOOTER ===
  const footerY = pageHeight - 10
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5)
  doc.setTextColor(...light)
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.text(`This is a computer-generated letter.  |  Generated on ${today}`, pageWidth / 2, footerY, { align: "center" })

  return Buffer.from(doc.output("arraybuffer"))
}
```

Note on the `visa_support` addressee: that template's `addresseeMode` is `"consular"`, and its field schema is the only one guaranteed to include `embassyName`/`embassyCity` keys — the route reads those two fields directly (via `fields.embassyName`/`fields.embassyCity`, computed above) rather than overloading `recipient.name`, which stays the actual registrant's name throughout.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "faculty-letter-pdf"`
Expected: no output.

Run: `npx eslint "src/app/api/events/[eventId]/faculty-letter-pdf/route.ts"`
Expected: no errors (the pre-existing `no-explicit-any` pattern used elsewhere in this codebase for the Supabase client cast is suppressed the same way `invitation-pdf/route.ts` does it, with an inline eslint-disable comment — already included in Step 1's code).

- [ ] **Step 3: Manual verification (curl, all 6 templates)**

With `npm run dev` running and logged into the dashboard in a browser (to get a valid session cookie), find a real `registration_id` for a speaker-type registration on a test event, then for each template run:

```bash
curl -X POST "http://localhost:3000/api/events/<eventId>/faculty-letter-pdf" \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste session cookie from browser devtools>" \
  -d '{
    "template_key": "initial_invitation",
    "registration_id": "<registration_id>",
    "fields": {
      "specialty": "Laparoscopic Surgery",
      "facultyRole": "Invited Speaker",
      "trackSession": "Advanced Laparoscopy Track",
      "contributionFormat": "Lecture",
      "proposedTitle": "Innovations in Hernia Repair",
      "duration": "20 minutes",
      "mainRegistration": "Complimentary",
      "workshopSocialEvents": "Not included",
      "travel": "Not covered",
      "accommodation": "Not covered",
      "localTransport": "Not covered",
      "honorariumVisa": "Nil",
      "acceptanceDeadline": "2026-10-15"
    }
  }' --output /tmp/initial_invitation.pdf
```

Expected: HTTP 200, `/tmp/initial_invitation.pdf` opens as a valid PDF with the ESSURG header, both configured signatures (if Task 2's fields were saved), and no literal `undefined` or `[object Object]` text anywhere. Repeat with each of the other 5 `template_key` values and their respective field sets (drawn from Task 1's field schemas), confirming each renders cleanly. Confirm a request missing a required field returns `400` with a clear `error` message instead of a PDF.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/events/[eventId]/faculty-letter-pdf/route.ts"
git commit -m "feat(letters): add faculty-letter-pdf generation route"
```

---

## Task 4: Letter Composer UI

**Files:**
- Create: `src/app/events/[eventId]/speakers/invitations/letter-composer-sheet.tsx`
- Modify: `src/app/events/[eventId]/speakers/invitations/page.tsx`

**Interfaces:**
- Consumes: `LETTER_TEMPLATES` from `src/lib/services/faculty-letter-templates.ts` (Task 1); `POST /api/events/[eventId]/faculty-letter-pdf` (Task 3); the `Speaker` and `FacultyAssignment` types already defined in `page.tsx`; existing `Sheet`/`ResizableSheetContent`/`Select`/`Input`/`Textarea`/`Button` UI components.
- Produces: `LetterComposerSheet` component with props `{ eventId: string; speaker: Speaker | null; assignments: FacultyAssignment[]; open: boolean; onOpenChange: (open: boolean) => void }`.

- [ ] **Step 1: Create the composer component**

Create `src/app/events/[eventId]/speakers/invitations/letter-composer-sheet.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Sheet,
  ResizableSheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileDown } from "lucide-react"
import { toast } from "sonner"
import { LETTER_TEMPLATES } from "@/lib/services/faculty-letter-templates"

type Speaker = {
  id: string
  attendee_name: string
  attendee_email: string
}

type FacultyAssignment = {
  role: string
  topic_title: string | null
  session_date: string | null
  start_time: string | null
  end_time: string | null
  hall: string | null
  session_name: string | null
}

// Maps a template field key to how it should prefill from the speaker's
// first faculty_assignments row, if one exists. Only keys present in a
// given template's field schema are ever looked up, so this map can safely
// list every mapping every template might use.
function prefillFromAssignment(assignment: FacultyAssignment | undefined): Record<string, string> {
  if (!assignment) return {}
  const timeRange = assignment.start_time
    ? `${assignment.start_time}${assignment.end_time ? ` - ${assignment.end_time}` : ""}`
    : ""
  return {
    facultyRole: assignment.role ? assignment.role.charAt(0).toUpperCase() + assignment.role.slice(1) : "",
    trackSession: assignment.session_name || "",
    presentationTopic: assignment.topic_title || "",
    sessionTitle: assignment.session_name || "",
    sessionDate: assignment.session_date || "",
    sessionTime: timeRange,
    hall: assignment.hall || "",
  }
}

export function LetterComposerSheet({
  eventId,
  speaker,
  assignments,
  open,
  onOpenChange,
}: {
  eventId: string
  speaker: Speaker | null
  assignments: FacultyAssignment[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [templateKey, setTemplateKey] = useState<string>("initial_invitation")
  const [values, setValues] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)

  const template = LETTER_TEMPLATES[templateKey]

  // Reset the form each time the sheet opens for a (possibly new) speaker,
  // prefilling from their first assignment where the template has a
  // matching field.
  useEffect(() => {
    if (!open) return
    const prefill = prefillFromAssignment(assignments[0])
    const next: Record<string, string> = {}
    for (const f of template.fields) {
      next[f.key] = prefill[f.key] || ""
    }
    setValues(next)
  }, [open, templateKey, assignments, template.fields])

  const missingRequired = useMemo(
    () => template.fields.filter((f) => !values[f.key]?.trim()),
    [template.fields, values]
  )

  const handleGenerate = async () => {
    if (!speaker) return
    if (missingRequired.length > 0) {
      toast.error(`Fill in: ${missingRequired.map((f) => f.label).join(", ")}`)
      return
    }
    setGenerating(true)
    try {
      const res = await fetch(`/api/events/${eventId}/faculty-letter-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey,
          registration_id: speaker.id,
          fields: values,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to generate letter")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${template.label.replace(/[^a-zA-Z0-9]/g, "_")}-${speaker.attendee_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Letter generated")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate letter")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ResizableSheetContent side="right" defaultWidth={480} storageKey="letter-composer-width">
        {speaker && (
          <div className="p-4 space-y-6">
            <SheetHeader>
              <SheetTitle>Generate Letter</SheetTitle>
              <SheetDescription>{speaker.attendee_name}</SheetDescription>
            </SheetHeader>

            <div>
              <label className="text-sm font-medium text-foreground">Template</label>
              <Select value={templateKey} onValueChange={setTemplateKey}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(LETTER_TEMPLATES).map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {template.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-sm font-medium text-foreground">{f.label}</label>
                  {f.type === "textarea" ? (
                    <Textarea
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={3}
                      className="mt-1.5"
                    />
                  ) : (
                    <Input
                      type={f.type === "date" ? "date" : "text"}
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="mt-1.5"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
              {generating ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        )}
      </ResizableSheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Wire it into the Speakers/Invitations page**

In `src/app/events/[eventId]/speakers/invitations/page.tsx`:

Add the import near the other local imports:
```ts
import { LetterComposerSheet } from "./letter-composer-sheet"
```

Add state near the other `useState` calls (next to `selectedSpeaker`):
```ts
  const [showLetterComposer, setShowLetterComposer] = useState(false)
```

In the "Quick Actions" block inside the speaker detail `Sheet` (the `<div className="space-y-3 pt-2 border-t">` block containing the existing "Resend Email" / "Send WhatsApp" buttons), add a new button above the existing "Resend Email" button:

```tsx
                  <Button
                    variant="outline"
                    onClick={() => setShowLetterComposer(true)}
                    className="w-full"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Generate Letter
                  </Button>
```

Add `FileDown` to the existing `lucide-react` import list at the top of the file (alongside `Send, Loader2, Search, ...`).

Immediately after the existing speaker detail `<Sheet>` block's closing tag (right before the final closing `</div>` of the component), render the composer:
```tsx
      <LetterComposerSheet
        eventId={eventId}
        speaker={selectedSpeaker}
        assignments={speakerAssignments || []}
        open={showLetterComposer}
        onOpenChange={setShowLetterComposer}
      />
```

This reuses the `speakerAssignments` query the page already runs for `selectedSpeaker` (`src/app/events/[eventId]/speakers/invitations/page.tsx:163-178`) — no new data fetching is introduced.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -i "letter-composer\|invitations/page"`
Expected: no output.

Run: `npx eslint "src/app/events/[eventId]/speakers/invitations/letter-composer-sheet.tsx" "src/app/events/[eventId]/speakers/invitations/page.tsx"`
Expected: no new errors (compare against a pre-change run if the file already had pre-existing warnings).

- [ ] **Step 4: Manual verification**

1. Run `npm run dev`, open `/events/<eventId>/speakers/invitations`.
2. Click a speaker row to open the detail Sheet, click **Generate Letter**.
3. Confirm the composer Sheet opens with the "Initial Invitation to Join Faculty" template selected and its fields empty (or prefilled from an assignment if that speaker has one — check `trackSession`/`hall`/`sessionDate` populate when applicable).
4. Switch the template dropdown to each of the other 5 templates; confirm the field list changes to match that template's schema every time.
5. Leave a required field empty and click **Generate PDF** — confirm a toast lists the missing field(s) and no request is sent (check Network tab).
6. Fill every field for "Visa Support Letter" and click **Generate PDF** — confirm a PDF downloads and opens correctly, addressed to the embassy rather than the speaker.
7. Repeat for at least one more template end-to-end (fill all fields, generate, confirm the PDF downloads and looks correct).

- [ ] **Step 5: Commit**

```bash
git add "src/app/events/[eventId]/speakers/invitations/letter-composer-sheet.tsx" "src/app/events/[eventId]/speakers/invitations/page.tsx"
git commit -m "feat(letters): add letter composer UI to Speakers/Invitations page"
```

---

## Task 5: Full end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS, including the 7 tests added in Task 1.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: succeeds with no type errors (this also runs `db:check` per the existing `build` script — confirm that step doesn't fail for unrelated reasons before treating any failure as caused by this feature).

- [ ] **Step 3: Generate one real PDF per template**

Using the composer UI (not curl, this time) against a real ESSURG 2026 speaker registration: generate and visually check all 6 templates — Initial Invitation, Assignment Confirmation, Chairperson/Moderator, Workshop Faculty, Live/Operative Video Faculty, Visa Support. For each, confirm against the source docx (`~/Downloads/2026 Faculty Invitation Letter Pack (1).docx` or wherever the user has it):
- Header band renders without the tagline/edition overlap (same fix pattern as `invitation-pdf`).
- No literal `undefined`, `None`, or `[object Object]` text anywhere.
- Both configured chairman signatures appear side by side (assuming Task 2's fields were filled and saved for the ESSURG event) — or a single signature if only one was configured, or none if neither was configured (test all three states at least once by toggling the settings from Task 2).
- The Visa Support letter is addressed to the embassy, not the speaker, and uses "Dear Sir/Madam,".
- Wording and structure match the corresponding docx template (allowing for the two known, deliberate simplifications: salutation is `Dear <full name>,` rather than `Dear Professor/Dr. [SURNAME],`, and the closing "welcoming you to X" uses city only, not "city, country" — both documented in the approved spec/plan, not defects).

- [ ] **Step 4: Confirm against the design spec's non-goals**

- Confirm no new database migration was created anywhere in this work (`git diff main --stat | grep -i migration` should be empty).
- Confirm the existing `GET /api/events/[eventId]/invitation-pdf` route was not modified by this plan (only by the earlier, separate bug-fix PR #114) — `git log --oneline -- "src/app/api/events/[eventId]/invitation-pdf/route.ts"` should show no new commits from this plan's tasks.
- Confirm no email-sending code was touched — this feature is download-only.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

If verification surfaced only doc/comment fixes, commit them; if it surfaced a real bug, stop and fix it as a proper task (write/adjust a test first if the bug is in `faculty-letter-templates.ts`, otherwise fix directly in the route/UI and re-run the relevant manual steps above) rather than patching silently.
