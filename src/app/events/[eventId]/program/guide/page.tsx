"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Upload,
  Sparkles,
  RefreshCw,
  Users,
  Mail,
  CheckCircle2,
  Globe,
  AlertTriangle,
  ArrowRight,
  FileSpreadsheet,
  Database,
  Link2,
  UserCheck,
  Send,
  Eye,
  Printer,
  BookOpen,
} from "lucide-react"

export default function ProgramGuidePage() {
  const params = useParams()
  const eventId = params.eventId as string
  const base = `/events/${eventId}/program`

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Program Setup Guide</h1>
        <p className="text-muted-foreground mt-1">
          Complete roadmap for importing your program, linking speakers, and managing confirmations.
        </p>
      </div>

      {/* STEP 1 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">1</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Prepare Your CSV
              </CardTitle>
              <CardDescription>Format your program schedule for import</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Required Columns</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2"><Badge variant="default">Date</Badge> DD/MM/YYYY or DD.MM.YYYY</div>
              <div className="flex items-center gap-2"><Badge variant="default">Time</Badge> HH:MM - HH:MM (range) or HH:MM</div>
              <div className="flex items-center gap-2"><Badge variant="default">Topic</Badge> Session/talk name</div>
              <div className="flex items-center gap-2"><Badge variant="outline">Hall</Badge> Venue name (optional)</div>
              <div className="flex items-center gap-2"><Badge variant="outline">Speaker</Badge> Faculty name</div>
              <div className="flex items-center gap-2"><Badge variant="outline">Role</Badge> Speaker/Chairperson/Moderator</div>
            </div>
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Tips for best results</p>
                <ul className="mt-1 text-amber-700 space-y-1 list-disc list-inside">
                  <li>Include email and phone in the CSV if available &mdash; this enables direct speaker matching</li>
                  <li>Use consistent name spelling across rows (e.g. always &quot;Dr Aditi Nadkarni&quot;, not sometimes &quot;Aditi&quot;)</li>
                  <li>Each row = one speaker in one session. A session with 3 speakers = 3 rows</li>
                  <li>Dates must be DD/MM/YYYY (Indian format). US format MM/DD/YYYY will be misparsed</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 2 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">2</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Import Program
              </CardTitle>
              <CardDescription>Upload your CSV to create sessions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <h4 className="font-medium">AI Import (Recommended)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                AI reads your CSV and intelligently maps columns, extracts speaker contact info,
                and creates sessions + faculty assignments in one step.
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Handles messy/non-standard CSVs</li>
                <li>Extracts emails & phones from any column</li>
                <li>Creates faculty assignments automatically</li>
                <li>Creates speaker registrations automatically</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium">Manual Import</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                You manually map CSV columns to fields. Gives you full control over the mapping.
                Speaker names go into the sessions but no contact details are extracted.
              </p>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                <li>Map each column yourself</li>
                <li>Names stored in sessions only</li>
                <li>Faculty assignments created on first visit to Speakers page</li>
                <li>No emails extracted &mdash; placeholder emails used later</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4" />
            <span>Go to</span>
            <Link href={`${base}/import`} className="text-primary hover:underline font-medium">Import Page</Link>
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-sm">
            <p className="text-blue-800">
              <strong>Re-importing?</strong> Check &quot;Clear existing sessions&quot; to replace all sessions.
              Without it, duplicate sessions may be skipped but faculty assignments will double up.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* STEP 3 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">3</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                How Data Flows After Import
              </CardTitle>
              <CardDescription>Understanding what gets created where</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <Badge className="shrink-0 mt-0.5" variant="outline">Sessions</Badge>
              <p>Each unique Date + Time + Hall + Topic combination creates one session. Speaker names are stored in the session&apos;s <code className="bg-muted px-1 rounded">speakers</code> column.</p>
            </div>
            <div className="flex gap-3 items-start">
              <Badge className="shrink-0 mt-0.5" variant="outline">Faculty Assignments</Badge>
              <p>A linking table that connects each speaker to each session with a role (Speaker, Chairperson, Moderator, Panelist). Created by AI Import automatically, or by auto-sync when you visit the Speakers page.</p>
            </div>
            <div className="flex gap-3 items-start">
              <Badge className="shrink-0 mt-0.5" variant="outline">Registrations</Badge>
              <p>Speaker registrations in the main registration system. Created via &quot;Import from Program&quot; button on the Speakers page, or automatically by AI Import.</p>
            </div>

            <div className="mt-4 rounded-md bg-muted/50 p-4 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-600">CSV File</span>
                <ArrowRight className="h-3 w-3" />
                <span className="text-green-600">Sessions Table</span>
                <span className="text-muted-foreground">(speakers column = names)</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <ArrowRight className="h-3 w-3" />
                <span className="text-purple-600">Faculty Assignments</span>
                <span className="text-muted-foreground">(session_id + name + email + role)</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <ArrowRight className="h-3 w-3" />
                <span className="text-orange-600">Registrations</span>
                <span className="text-muted-foreground">(attendee_name + email + ticket_type)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 4 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">4</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Speaker-Session Linking
              </CardTitle>
              <CardDescription>How speakers get matched to their sessions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The system uses multiple strategies to match speakers (registrations) to sessions, tried in order:
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <Badge className="bg-green-100 text-green-700 shrink-0">1. Email</Badge>
              <p>If the speaker&apos;s registration email matches an email in faculty_assignments or in the session text fields, it&apos;s a direct match. <strong>Most reliable.</strong></p>
            </div>
            <div className="flex gap-3 items-start">
              <Badge className="bg-yellow-100 text-yellow-700 shrink-0">2. Name</Badge>
              <p>If no email match, the system strips titles (Dr., Prof., Mr., etc.) and does a case-insensitive name match. &quot;Dr Aditi Nadkarni&quot; in the session matches &quot;Dr. Aditi Nadkarni&quot; in registrations.</p>
            </div>
            <div className="flex gap-3 items-start">
              <Badge className="bg-red-100 text-red-700 shrink-0">3. Text</Badge>
              <p>Emails are also extracted from <code className="bg-muted px-1 rounded">speakers_text</code> fields and session descriptions as a fallback.</p>
            </div>
          </div>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Why &quot;No sessions assigned&quot;?</p>
                <ul className="mt-1 text-amber-700 space-y-1 list-disc list-inside">
                  <li><strong>Faculty assignments not synced</strong> &mdash; Visit the Speakers page; auto-sync runs on first load. Or click &quot;Sync Assignments&quot; manually.</li>
                  <li><strong>Name mismatch</strong> &mdash; If the CSV has &quot;Aditi&quot; but the registration has &quot;Dr Aditi Nadkarni&quot;, name matching fails. Fix the name in either place.</li>
                  <li><strong>Sessions have no speaker columns</strong> &mdash; If the CSV didn&apos;t have a Speaker column mapped, sessions won&apos;t have names to match against.</li>
                  <li><strong>Placeholder emails</strong> &mdash; Emails like <code className="bg-muted px-1 rounded">name@placeholder.speaker</code> are auto-generated when no real email was in the CSV. They don&apos;t affect name matching but won&apos;t match by email.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STEP 5 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">5</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Speakers
              </CardTitle>
              <CardDescription>Review and manage your speaker list</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Sync Assignments</p>
                <p className="text-muted-foreground">Auto-runs on first visit if sessions have speaker data but no faculty assignments. You can also trigger it manually from the Speakers page.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <UserCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Import from Program</p>
                <p className="text-muted-foreground">Creates speaker registrations from session data. For speakers without email in the CSV, a placeholder email like <code className="bg-muted px-1 rounded">firstname.lastname@placeholder.speaker</code> is generated. Update these with real emails when available.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <Users className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Invite from Faculty Database</p>
                <p className="text-muted-foreground">Search your existing faculty database to invite speakers. Creates a registration with their real email and contact details.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4" />
            <span>Go to</span>
            <Link href={`/events/${eventId}/speakers`} className="text-primary hover:underline font-medium">All Speakers</Link>
          </div>
        </CardContent>
      </Card>

      {/* STEP 6 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">6</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Invitations & Confirmations
              </CardTitle>
              <CardDescription>Get speakers to confirm their sessions</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-start">
              <Mail className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email Invitations</p>
                <p className="text-muted-foreground">Send personalized emails to speakers with their session details and a unique portal link. Speakers can confirm, decline, or request changes from the portal.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Confirmation Statuses</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge className="bg-gray-100 text-gray-700">Not Invited</Badge>
                  <Badge className="bg-blue-100 text-blue-700">Invited</Badge>
                  <Badge className="bg-green-100 text-green-700">Confirmed</Badge>
                  <Badge className="bg-red-100 text-red-700">Declined</Badge>
                  <Badge className="bg-amber-100 text-amber-700">Change Requested</Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4" />
            <span>Go to</span>
            <Link href={`${base}/confirmations`} className="text-primary hover:underline font-medium">Confirmations</Link>
          </div>
        </CardContent>
      </Card>

      {/* STEP 7 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">7</div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Review & Publish
              </CardTitle>
              <CardDescription>Verify schedule and share with delegates</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <Link href={`${base}/schedule`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Eye className="h-4 w-4" />Schedule View
              </div>
              <p className="text-muted-foreground text-xs">Visual timeline of all sessions by hall and day</p>
            </Link>
            <Link href={`${base}/conflicts`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />Conflict Check
              </div>
              <p className="text-muted-foreground text-xs">Find overlapping sessions and double-booked speakers</p>
            </Link>
            <Link href={`${base}/public`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Globe className="h-4 w-4" />Public View
              </div>
              <p className="text-muted-foreground text-xs">Shareable program page for delegates and attendees</p>
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <Link href={`${base}/print`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Printer className="h-4 w-4" />Print
              </div>
              <p className="text-muted-foreground text-xs">Print-ready program booklet layout</p>
            </Link>
            <Link href={`${base}/delegate`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <BookOpen className="h-4 w-4" />Delegate View
              </div>
              <p className="text-muted-foreground text-xs">Interactive program for registered delegates</p>
            </Link>
            <Link href={`${base}/reports`} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 font-medium mb-1">
                <FileSpreadsheet className="h-4 w-4" />Reports
              </div>
              <p className="text-muted-foreground text-xs">Export program data and speaker reports</p>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* TROUBLESHOOTING */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-5 w-5" />
            Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-4">
            <div>
              <p className="font-medium">Speakers show &quot;No sessions assigned&quot;</p>
              <ol className="mt-1 text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Go to <Link href={`/events/${eventId}/speakers`} className="text-primary hover:underline">All Speakers</Link> page &mdash; auto-sync runs on first load</li>
                <li>If still empty, click the &quot;Sync Assignments&quot; button manually</li>
                <li>Check that session names in the CSV actually had speakers mapped</li>
                <li>Verify the speaker&apos;s name spelling matches between the registration and the session</li>
              </ol>
            </div>

            <div>
              <p className="font-medium">Placeholder emails like name@placeholder.speaker</p>
              <p className="text-muted-foreground mt-1">
                These are auto-generated when the CSV didn&apos;t have email addresses for speakers.
                They don&apos;t break anything &mdash; session linking uses name matching as fallback.
                Replace them with real emails before sending invitations.
              </p>
            </div>

            <div>
              <p className="font-medium">Duplicate sessions after re-import</p>
              <p className="text-muted-foreground mt-1">
                Always check &quot;Clear existing sessions&quot; when re-importing. Without it, the system tries to skip exact duplicates
                but faculty assignments will be doubled.
              </p>
            </div>

            <div>
              <p className="font-medium">Sessions missing from the schedule view</p>
              <p className="text-muted-foreground mt-1">
                Check that the Date and Time columns were parsed correctly. Go to <Link href={`${base}/sessions`} className="text-primary hover:underline">Sessions</Link> and verify
                session dates and times. Common issue: DD/MM vs MM/DD date format swaps.
              </p>
            </div>

            <div>
              <p className="font-medium">Want to start fresh?</p>
              <p className="text-muted-foreground mt-1">
                Re-import with &quot;Clear existing&quot; checked using AI Import. This deletes all sessions and recreates everything cleanly,
                including faculty assignments and speaker registrations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
