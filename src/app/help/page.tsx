"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Search,
  ChevronRight,
  Calendar,
  Users,
  Ticket,
  QrCode,
  Mail,
  FileText,
  Settings,
  CreditCard,
  Plane,
  Hotel,
  Award,
  MessageSquare,
  BarChart3,
  HelpCircle,
  BookOpen,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface HelpSection {
  id: string
  title: string
  icon: any
  color: string
  articles: HelpArticle[]
}

interface HelpArticle {
  id: string
  title: string
  description: string
  content: string[]
  tips?: string[]
  warnings?: string[]
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    color: "text-blue-500 bg-blue-100",
    articles: [
      {
        id: "create-event",
        title: "How to Create an Event",
        description: "Step-by-step guide to setting up your first event",
        content: [
          "Go to Dashboard and click 'Create Event' button",
          "Fill in basic details: Event Name, Date, Location",
          "Set up ticket types with pricing",
          "Configure registration settings",
          "Publish your event to start accepting registrations",
        ],
        tips: [
          "Use a short, memorable URL slug for easy sharing",
          "Set up at least one ticket type before publishing",
        ],
      },
      {
        id: "event-settings",
        title: "Understanding Event Settings",
        description: "All settings explained in detail",
        content: [
          "**Public Event**: When ON, anyone with the link can view and register. Turn OFF for invite-only events.",
          "**Registration Open**: Controls new registrations. Turn OFF to stop accepting new attendees.",
          "**Max Attendees**: Total capacity limit. Registration closes automatically when reached.",
        ],
        tips: [
          "You can close registration while keeping the event public (for viewing schedule, speakers, etc.)",
        ],
      },
    ],
  },
  {
    id: "registrations",
    title: "Registrations",
    icon: Users,
    color: "text-green-500 bg-green-100",
    articles: [
      {
        id: "manage-registrations",
        title: "Managing Registrations",
        description: "View, edit, and manage attendee registrations",
        content: [
          "Go to Event → Registrations to see all registered attendees",
          "Use filters to find specific registrations by status, ticket type, or search",
          "Click on any registration to view full details in the slide-over panel",
          "From the panel, you can: Edit details, Resend emails, Print badge, Check-in manually",
        ],
        tips: [
          "Use bulk selection to perform actions on multiple registrations at once",
          "Export to CSV for external reporting or mail merge",
        ],
      },
      {
        id: "registration-status",
        title: "Registration Status Explained",
        description: "What each status means",
        content: [
          "**Pending**: Registration created but payment not completed. Follow up with attendee.",
          "**Confirmed**: Payment successful. Attendee is registered and can attend.",
          "**Cancelled**: Registration was cancelled. Spot is freed up.",
          "**Refunded**: Payment was refunded to the attendee.",
        ],
        warnings: [
          "Only confirmed registrations can be checked in at the venue",
        ],
      },
      {
        id: "import-registrations",
        title: "Importing Registrations",
        description: "Bulk import attendees from spreadsheet",
        content: [
          "Go to Registrations → Import",
          "Download the CSV template",
          "Fill in attendee details (Name, Email, Phone, Ticket Type)",
          "Upload the completed CSV file",
          "Review the preview and confirm import",
        ],
        tips: [
          "Ticket type names must exactly match your configured ticket types",
          "Email addresses must be unique - duplicates will be skipped",
        ],
        warnings: [
          "Imported registrations are marked as 'confirmed' by default - they bypass payment",
        ],
      },
    ],
  },
  {
    id: "tickets",
    title: "Tickets & Pricing",
    icon: Ticket,
    color: "text-purple-500 bg-purple-100",
    articles: [
      {
        id: "create-tickets",
        title: "Creating Ticket Types",
        description: "Set up different ticket categories",
        content: [
          "Go to Event → Tickets",
          "Click 'Add Ticket Type'",
          "Set name, price, description, and quantity",
          "Configure availability dates if needed",
          "Save and the ticket will appear on registration page",
        ],
        tips: [
          "Use 'Exclusive Groups' to let attendees choose only one from a group of tickets",
          "Set quantity limits to control capacity per ticket type",
        ],
      },
      {
        id: "discount-codes",
        title: "Setting Up Discount Codes",
        description: "Create promotional codes for discounts",
        content: [
          "Go to Event → Tickets → Discount Codes tab",
          "Click 'Add Discount Code'",
          "Set: Code name, Discount percentage or amount, Usage limit",
          "Optionally restrict to specific ticket types",
          "Share the code with eligible attendees",
        ],
        tips: [
          "Use unique codes for tracking different promotional campaigns",
          "Set expiry dates for limited-time offers",
        ],
      },
    ],
  },
  {
    id: "checkin",
    title: "Check-in",
    icon: QrCode,
    color: "text-orange-500 bg-orange-100",
    articles: [
      {
        id: "checkin-methods",
        title: "Check-in Methods",
        description: "Different ways to check in attendees",
        content: [
          "**QR Scan**: Scan attendee's badge QR code using the scan page",
          "**Manual Search**: Search by name/email and click 'Check In'",
          "**Kiosk Mode**: Self-service check-in for attendees",
          "**Bulk Check-in**: Select multiple and check in at once",
        ],
        tips: [
          "Set up multiple check-in lists for different entry points or sessions",
          "Use access tokens to give check-in access to volunteers without full login",
        ],
      },
      {
        id: "checkin-lists",
        title: "Check-in Lists Explained",
        description: "Organize check-ins by location or session",
        content: [
          "Create separate lists for: Main entry, Workshop rooms, Lunch, etc.",
          "Each list tracks attendance independently",
          "Attendees can be checked into multiple lists",
          "Use for session-wise attendance tracking",
        ],
      },
    ],
  },
  {
    id: "badges",
    title: "Badges & Certificates",
    icon: Award,
    color: "text-amber-500 bg-amber-100",
    articles: [
      {
        id: "badge-templates",
        title: "Creating Badge Templates",
        description: "Design custom badges for your event",
        content: [
          "Go to Event → Badges → Templates",
          "Click 'Create Template'",
          "Use the visual designer to add: Name, QR Code, Photo, Custom fields",
          "Set one template as 'Default' for auto-generation",
          "Preview and save",
        ],
        tips: [
          "Include QR code for quick check-in scanning",
          "Use dynamic fields like {{attendee_name}} for personalization",
        ],
      },
      {
        id: "generate-badges",
        title: "Generating & Printing Badges",
        description: "Create badges for attendees",
        content: [
          "Go to Badges → Generate",
          "Select attendees (or use filters)",
          "Click 'Generate Badges'",
          "Download PDF or print directly",
        ],
        tips: [
          "Enable 'Auto-generate Badge' in settings for instant badge creation on registration",
          "Use 'Email Badge' to send download links to attendees before the event",
        ],
      },
      {
        id: "certificates",
        title: "Issuing Certificates",
        description: "Generate participation certificates",
        content: [
          "Go to Event → Certificates → Templates",
          "Create a certificate template with event details",
          "After event: Go to Certificates → Generate",
          "Select attendees who should receive certificates",
          "Generate and email certificates",
        ],
        warnings: [
          "Certificates are typically issued post-event. Don't enable auto-generate unless intended.",
        ],
      },
    ],
  },
  {
    id: "automation",
    title: "Automation",
    icon: Settings,
    color: "text-cyan-500 bg-cyan-100",
    articles: [
      {
        id: "auto-settings",
        title: "Automation Settings Guide",
        description: "What each automation option does",
        content: [
          "**Auto-send Receipt**: Sends confirmation email with registration details after payment (Recommended: ON)",
          "**Auto-generate Badge**: Creates badge PDF using default template (Requires: Default badge template)",
          "**Auto-email Badge**: Sends badge download link to attendee (Requires: Auto-generate enabled)",
          "**Auto-generate Certificate**: Creates certificate on registration (Usually OFF - enable post-event)",
          "**Auto-email Certificate**: Sends certificate to attendee (Requires: Auto-generate enabled)",
        ],
        tips: [
          "All automations trigger after successful payment",
          "Set up templates BEFORE enabling auto-generation",
        ],
      },
    ],
  },
  {
    id: "communications",
    title: "Communications",
    icon: Mail,
    color: "text-pink-500 bg-pink-100",
    articles: [
      {
        id: "email-types",
        title: "Email Types & When They're Sent",
        description: "Understanding the email system",
        content: [
          "**Registration Confirmation**: Sent after successful payment (if Auto-send Receipt is ON)",
          "**Badge Email**: Sent when badge is generated (if Auto-email Badge is ON)",
          "**Certificate Email**: Sent when certificate is generated",
          "**Bulk Communications**: Manual emails sent from Communications section",
        ],
      },
      {
        id: "email-tracking",
        title: "Email Tracking & Status",
        description: "Monitor email delivery",
        content: [
          "View email status in the registration detail panel under 'Communication'",
          "Status indicators: Sent → Delivered → Opened → Clicked",
          "Bounced emails are highlighted in red",
          "Open count shows how many times email was opened",
        ],
        tips: [
          "Low open rates? Check if emails are going to spam",
          "Use clear subject lines for better open rates",
        ],
      },
    ],
  },
  {
    id: "speakers",
    title: "Speakers & Program",
    icon: MessageSquare,
    color: "text-indigo-500 bg-indigo-100",
    articles: [
      {
        id: "speaker-management",
        title: "Managing Speakers",
        description: "Add and manage event speakers",
        content: [
          "Go to Event → Speakers",
          "Add speakers with their details",
          "Assign speakers to sessions in Program",
          "Send invitations and track confirmations",
        ],
      },
      {
        id: "program-setup",
        title: "Setting Up Program Schedule",
        description: "Create your event schedule",
        content: [
          "Go to Event → Program",
          "Create sessions with date, time, hall",
          "Assign speakers/chairpersons to each session",
          "Use the confirmation tracker to monitor speaker responses",
        ],
      },
    ],
  },
  {
    id: "travel",
    title: "Travel & Accommodation",
    icon: Plane,
    color: "text-sky-500 bg-sky-100",
    articles: [
      {
        id: "travel-overview",
        title: "Travel Management Overview",
        description: "Manage speaker travel arrangements",
        content: [
          "**Travel Guests**: View speakers who need travel arrangements",
          "**Bookings**: Enter flight/train booking details",
          "**Itineraries**: Send complete travel info to speakers",
          "**Hotels**: Manage accommodation assignments",
        ],
        tips: [
          "Use the Travel Dashboard for a quick overview of all arrangements",
          "Send itineraries with calendar attachments for easy scheduling",
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
    color: "text-emerald-500 bg-emerald-100",
    articles: [
      {
        id: "payment-status",
        title: "Payment Status Explained",
        description: "Understanding payment states",
        content: [
          "**Pending**: Payment initiated but not completed",
          "**Completed**: Payment successful - registration confirmed",
          "**Failed**: Payment attempt failed - attendee can retry",
          "**Refunded**: Payment was returned to attendee",
        ],
      },
      {
        id: "razorpay-setup",
        title: "Setting Up Razorpay",
        description: "Configure payment gateway",
        content: [
          "Get your Razorpay Key ID and Key Secret from Razorpay Dashboard",
          "Go to Event → Settings → Advanced",
          "Enter your Razorpay credentials",
          "Test with a small payment before going live",
        ],
        warnings: [
          "Never share your Key Secret publicly",
          "Use test keys for development, live keys for production",
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    icon: BarChart3,
    color: "text-violet-500 bg-violet-100",
    articles: [
      {
        id: "available-reports",
        title: "Available Reports",
        description: "Types of reports you can generate",
        content: [
          "**Registration Report**: All registrations with details",
          "**Revenue Report**: Payment breakdown by ticket type",
          "**Check-in Report**: Attendance statistics",
          "**Speaker Report**: Speaker confirmation status",
          "**Travel Report**: Travel arrangement status",
        ],
        tips: [
          "Export any report to CSV for further analysis",
          "Use date filters to compare different periods",
        ],
      },
    ],
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null)

  const filteredSections = helpSections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.articles.some(article =>
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  const renderContent = (content: string) => {
    // Handle bold text
    return content.split("**").map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Help Center</h1>
            <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
              Everything you need to know to manage your events successfully.
              Find answers, learn best practices, and become a pro admin.
            </p>
          </div>

          {/* Search */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for help articles..."
              className="pl-12 h-12 text-base"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {selectedArticle ? (
          // Article View
          <div>
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Back to Help Center
            </button>

            <div className="bg-card border rounded-xl p-8">
              <h2 className="text-2xl font-bold">{selectedArticle.title}</h2>
              <p className="text-muted-foreground mt-2">{selectedArticle.description}</p>

              <div className="mt-8 space-y-4">
                <h3 className="font-semibold text-lg">Steps</h3>
                <ol className="space-y-3">
                  {selectedArticle.content.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground">{renderContent(step)}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {selectedArticle.tips && selectedArticle.tips.length > 0 && (
                <div className="mt-8 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-800 dark:text-green-200">Pro Tips</h4>
                  </div>
                  <ul className="space-y-2">
                    {selectedArticle.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedArticle.warnings && selectedArticle.warnings.length > 0 && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200">Important</h4>
                  </div>
                  <ul className="space-y-2">
                    {selectedArticle.warnings.map((warning, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Section Grid
          <div className="grid gap-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/events"
                className="flex flex-col items-center gap-2 p-4 bg-card border rounded-xl hover:shadow-md transition-shadow"
              >
                <Calendar className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">My Events</span>
              </Link>
              <Link
                href="/members"
                className="flex flex-col items-center gap-2 p-4 bg-card border rounded-xl hover:shadow-md transition-shadow"
              >
                <Users className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Members</span>
              </Link>
              <Link
                href="/delegates"
                className="flex flex-col items-center gap-2 p-4 bg-card border rounded-xl hover:shadow-md transition-shadow"
              >
                <Users className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">All Attendees</span>
              </Link>
              <Link
                href="/forms"
                className="flex flex-col items-center gap-2 p-4 bg-card border rounded-xl hover:shadow-md transition-shadow"
              >
                <FileText className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Forms</span>
              </Link>
            </div>

            {/* Help Sections */}
            <div className="grid md:grid-cols-2 gap-4">
              {filteredSections.map((section) => {
                const Icon = section.icon
                return (
                  <div
                    key={section.id}
                    className="bg-card border rounded-xl overflow-hidden"
                  >
                    <div className="p-5 border-b bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", section.color)}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{section.title}</h3>
                          <p className="text-xs text-muted-foreground">{section.articles.length} articles</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      {section.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article)}
                          className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors text-left"
                        >
                          <div>
                            <p className="font-medium text-sm">{article.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{article.description}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Still Need Help */}
            <div className="mt-8 p-6 bg-primary/5 border border-primary/20 rounded-xl text-center">
              <h3 className="font-semibold text-lg">Still need help?</h3>
              <p className="text-muted-foreground mt-1">
                Can't find what you're looking for? Contact our support team.
              </p>
              <div className="mt-4 flex items-center justify-center gap-4">
                <a
                  href="mailto:support@amasi.org"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  <Mail className="w-4 h-4" />
                  Email Support
                </a>
                <a
                  href="https://wa.me/918056536384"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
