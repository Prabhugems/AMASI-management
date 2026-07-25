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
