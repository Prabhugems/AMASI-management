// Shared team constants - extracted from /team and /events/[eventId]/team pages
// Icon names are strings so this module stays free of React/lucide imports.

export type TeamMember = {
  id: string
  email: string
  name: string
  phone?: string | null
  role: string
  notes?: string | null
  event_ids?: string[] | null
  permissions?: string[] | null
  is_active: boolean
  created_at: string
  last_login_at?: string | null
  last_active_at?: string | null
  logged_out_at?: string | null
  login_count?: number
}

export type PermissionDef = {
  value: string
  label: string
  icon: string
  color: string
  bg: string
  bgLight: string
  description: string
  access: string[]
  path: string
}

export type RolePreset = {
  value: string
  label: string
  icon: string
  description: string
  role: string
  permissions: string[]
  allEvents: boolean
  allPermissions: boolean
  gradient: string
  borderColor: string
  bgLight: string
}

export type RoleConfig = {
  label: string
  color: string
  bg: string
  textColor: string
  icon: string
  gradient: string
  borderColor: string
  bgLight: string
  description: string
  capabilities: string[]
  recommended: string
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const TRAVEL_PERMISSIONS: PermissionDef[] = [
  {
    value: "flights",
    label: "Flights",
    icon: "Plane",
    color: "text-sky-500",
    bg: "bg-sky-500",
    bgLight: "bg-sky-50 border-sky-200",
    description: "Manage flight bookings for faculty",
    access: [
      "View all flight bookings",
      "Create new flight bookings",
      "Edit existing bookings",
      "Cancel/delete bookings",
      "Export flight data",
    ],
    path: "/travel-dashboard → Flights",
  },
  {
    value: "hotels",
    label: "Hotels",
    icon: "Hotel",
    color: "text-amber-500",
    bg: "bg-amber-500",
    bgLight: "bg-amber-50 border-amber-200",
    description: "Manage hotel accommodations",
    access: [
      "View all hotel bookings",
      "Create new reservations",
      "Edit booking details",
      "Cancel reservations",
      "Export hotel data",
    ],
    path: "/travel-dashboard → Hotels",
  },
  {
    value: "transfers",
    label: "Transfers",
    icon: "Car",
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    bgLight: "bg-emerald-50 border-emerald-200",
    description: "Manage ground transportation",
    access: [
      "View all transfer requests",
      "Schedule pickups/drops",
      "Assign vehicles",
      "Track transfer status",
      "Export transfer data",
    ],
    path: "/travel-dashboard → Transfers",
  },
  {
    value: "trains",
    label: "Trains",
    icon: "Train",
    color: "text-orange-500",
    bg: "bg-orange-500",
    bgLight: "bg-orange-50 border-orange-200",
    description: "Manage train reservations",
    access: [
      "View all train bookings",
      "Create new bookings",
      "Edit booking details",
      "Cancel bookings",
      "Export train data",
    ],
    path: "/travel-dashboard → Trains",
  },
]

export const EVENT_PERMISSIONS: PermissionDef[] = [
  {
    value: "speakers",
    label: "Speakers",
    icon: "Users",
    color: "text-cyan-500",
    bg: "bg-cyan-500",
    bgLight: "bg-cyan-50 border-cyan-200",
    description: "Manage event speakers/faculty",
    access: [
      "View all speakers list",
      "Add new speakers",
      "Edit speaker profiles",
      "Remove speakers",
      "Send communications",
      "Export speaker data",
    ],
    path: "/events/[id]/speakers",
  },
  {
    value: "program",
    label: "Program",
    icon: "Calendar",
    color: "text-indigo-500",
    bg: "bg-indigo-500",
    bgLight: "bg-indigo-50 border-indigo-200",
    description: "Manage event program/schedule",
    access: [
      "View full program schedule",
      "Create sessions",
      "Edit session details",
      "Assign speakers to sessions",
      "Manage session timings",
      "Send confirmations",
    ],
    path: "/events/[id]/program",
  },
  {
    value: "checkin",
    label: "Check-in",
    icon: "CheckCircle",
    color: "text-green-500",
    bg: "bg-green-500",
    bgLight: "bg-green-50 border-green-200",
    description: "Handle attendee check-ins",
    access: [
      "Access check-in scanner",
      "Manual check-in attendees",
      "View check-in statistics",
      "Search attendees",
      "Print badges on-site",
    ],
    path: "/events/[id]/checkin",
  },
  {
    value: "badges",
    label: "Badges",
    icon: "Award",
    color: "text-pink-500",
    bg: "bg-pink-500",
    bgLight: "bg-pink-50 border-pink-200",
    description: "Design and print badges",
    access: [
      "Access badge designer",
      "Create badge templates",
      "Generate badges",
      "Print badges (bulk/individual)",
      "Export badge PDFs",
    ],
    path: "/events/[id]/badges",
  },
  {
    value: "certificates",
    label: "Certificates",
    icon: "FileText",
    color: "text-violet-500",
    bg: "bg-violet-500",
    bgLight: "bg-violet-50 border-violet-200",
    description: "Design and send certificates",
    access: [
      "Access certificate designer",
      "Create certificate templates",
      "Generate certificates",
      "Send certificates via email",
      "Verify certificates",
    ],
    path: "/events/[id]/certificates",
  },
  {
    value: "registrations",
    label: "Registrations",
    icon: "ClipboardList",
    color: "text-teal-500",
    bg: "bg-teal-500",
    bgLight: "bg-teal-50 border-teal-200",
    description: "Manage event registrations",
    access: [
      "View all registrations",
      "Add/edit registrations",
      "Import registrations (CSV)",
      "Export registration data",
      "Send communications",
      "View reports & analytics",
    ],
    path: "/events/[id]/registrations",
  },
  {
    value: "abstracts",
    label: "Abstracts",
    icon: "BookOpen",
    color: "text-orange-500",
    bg: "bg-orange-500",
    bgLight: "bg-orange-50 border-orange-200",
    description: "Manage abstract submissions & reviews",
    access: [
      "View all abstract submissions",
      "Review & score abstracts",
      "Accept/reject abstracts",
      "Configure abstract settings",
      "Manage abstract categories",
      "Export abstract data",
    ],
    path: "/events/[id]/abstracts",
  },
]

export const PERMISSIONS: PermissionDef[] = [
  ...TRAVEL_PERMISSIONS,
  ...EVENT_PERMISSIONS,
]

// ---------------------------------------------------------------------------
// Category-based permission groups (5 categories, 22 modules)
// ---------------------------------------------------------------------------

export type PermissionCategoryItem = {
  value: string
  label: string
  icon: string
  description: string
}

export type PermissionCategory = {
  key: string
  label: string
  description: string
  icon: string
  color: string
  bg: string
  bgLight: string
  permissions: PermissionCategoryItem[]
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'event_operations',
    label: 'Event Operations',
    description: 'Manage speakers, program, check-in, badges, certificates',
    icon: 'Calendar',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500',
    bgLight: 'bg-indigo-50 border-indigo-200',
    permissions: [
      { value: 'speakers', label: 'Speakers', icon: 'Users', description: 'Manage speakers, invitations, portal & accommodation' },
      { value: 'program', label: 'Program', icon: 'Calendar', description: 'Build event schedule with sessions & tracks' },
      { value: 'checkin', label: 'Check-in Hub', icon: 'CheckCircle', description: 'QR scanning, session tracking & attendance' },
      { value: 'badges', label: 'Badges', icon: 'Award', description: 'Design and print attendee badges' },
      { value: 'certificates', label: 'Certificates', icon: 'FileText', description: 'Generate and email certificates' },
      { value: 'print_station', label: 'Print Station', icon: 'Palette', description: 'Kiosk mode for on-site badge printing' },
    ],
  },
  {
    key: 'registration_forms',
    label: 'Registration & Forms',
    description: 'Registrations, addons, waitlist, forms, delegate portal',
    icon: 'ClipboardList',
    color: 'text-teal-500',
    bg: 'bg-teal-500',
    bgLight: 'bg-teal-50 border-teal-200',
    permissions: [
      { value: 'registrations', label: 'Registrations', icon: 'ClipboardList', description: 'Manage event registrations' },
      { value: 'addons', label: 'Addons', icon: 'Settings', description: 'Configure add-on items for registration' },
      { value: 'waitlist', label: 'Waitlist', icon: 'Clock', description: 'Manage waitlist when tickets sold out' },
      { value: 'forms', label: 'Forms', icon: 'FileText', description: 'Custom form builder for collecting data' },
      { value: 'delegate_portal', label: 'Delegate Portal', icon: 'Users', description: 'Self-service portal for attendees' },
      { value: 'surveys', label: 'Surveys', icon: 'BookOpen', description: 'Post-event feedback and surveys' },
      { value: 'leads', label: 'Leads', icon: 'MapPin', description: 'Capture and manage potential attendee leads' },
    ],
  },
  {
    key: 'travel_logistics',
    label: 'Travel & Logistics',
    description: 'Flights, hotels, meals, visa letters',
    icon: 'Plane',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500',
    bgLight: 'bg-cyan-50 border-cyan-200',
    permissions: [
      { value: 'flights', label: 'Travel (Flights)', icon: 'Plane', description: 'Manage flight bookings and transfers' },
      { value: 'hotels', label: 'Accommodation', icon: 'Hotel', description: 'Manage hotel bookings and room allocations' },
      { value: 'meals', label: 'Meals', icon: 'Settings', description: 'Meal preferences, dietary requirements' },
      { value: 'transfers', label: 'Transfers', icon: 'Car', description: 'Ground transportation management' },
      { value: 'visa_letters', label: 'Visa Letters', icon: 'FileText', description: 'Generate visa invitation letters' },
    ],
  },
  {
    key: 'finance_sponsors',
    label: 'Finance & Sponsors',
    description: 'Sponsors, budget, payments',
    icon: 'Shield',
    color: 'text-amber-500',
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-50 border-amber-200',
    permissions: [
      { value: 'sponsors', label: 'Sponsors', icon: 'Shield', description: 'Manage event sponsors and sponsorship packages' },
      { value: 'budget', label: 'Budget', icon: 'Settings', description: 'Track event budget, expenses, and reports' },
    ],
  },
  {
    key: 'advanced',
    label: 'Advanced Modules',
    description: 'Abstracts, examination',
    icon: 'BookOpen',
    color: 'text-purple-500',
    bg: 'bg-purple-500',
    bgLight: 'bg-purple-50 border-purple-200',
    permissions: [
      { value: 'abstracts', label: 'Abstract Management', icon: 'BookOpen', description: 'Abstract submission, review workflow & decisions' },
      { value: 'examination', label: 'Examination', icon: 'FileText', description: 'FMAS/MMAS theory examination and scoring' },
    ],
  },
]

// Helper: get all permission values from all categories
export const ALL_PERMISSION_VALUES = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.value))

// Helper: get category for a permission value
export function getCategoryForPermission(permValue: string): PermissionCategory | null {
  return PERMISSION_CATEGORIES.find(c => c.permissions.some(p => p.value === permValue)) || null
}

// Helper: get all permission values for a category
export function getCategoryPermissions(categoryKey: string): string[] {
  const cat = PERMISSION_CATEGORIES.find(c => c.key === categoryKey)
  return cat ? cat.permissions.map(p => p.value) : []
}

// ---------------------------------------------------------------------------
// Role config (metadata per role value)
// ---------------------------------------------------------------------------

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  admin: {
    label: "Administrator",
    color: "text-rose-700",
    bg: "bg-rose-100",
    textColor: "text-purple-600",
    icon: "Shield",
    gradient: "from-purple-500 to-pink-500",
    borderColor: "border-purple-300",
    bgLight: "bg-gradient-to-br from-purple-50 to-pink-50",
    description: "Full system access with all privileges",
    capabilities: [
      "Access to ALL modules without restrictions",
      "Manage team members (add/edit/remove)",
      "Assign permissions to other users",
      "Access all events (past, present, future)",
      "View system-wide reports & analytics",
      "Configure system settings",
    ],
    recommended: "For organization owners and senior managers",
  },
  coordinator: {
    label: "Event Coordinator",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    textColor: "text-blue-600",
    icon: "UserCog",
    gradient: "from-blue-500 to-indigo-500",
    borderColor: "border-blue-300",
    bgLight: "bg-gradient-to-br from-blue-50 to-indigo-50",
    description: "Manages events and attendees",
    capabilities: [
      "Access based on assigned permissions",
      "Can only see assigned events",
      "Cannot manage team members",
      "Cannot change system settings",
      "Limited to their module access",
    ],
    recommended: "For event managers and on-ground coordinators",
  },
  travel: {
    label: "Travel Coordinator",
    color: "text-sky-700",
    bg: "bg-sky-100",
    textColor: "text-cyan-600",
    icon: "Plane",
    gradient: "from-cyan-500 to-blue-500",
    borderColor: "border-cyan-300",
    bgLight: "bg-gradient-to-br from-cyan-50 to-blue-50",
    description: "Manages travel and logistics",
    capabilities: [
      "Access based on assigned permissions",
      "Focused on travel-related modules",
      "Can only see assigned events",
      "Cannot manage team members",
      "Cannot change system settings",
    ],
    recommended: "For travel desk and logistics staff",
  },
}

// ---------------------------------------------------------------------------
// Role presets (quick-apply templates)
// ---------------------------------------------------------------------------

export const ROLE_PRESETS: RolePreset[] = [
  {
    value: "administrator",
    label: "Administrator",
    icon: "Shield",
    description: "Full system access",
    role: "admin",
    permissions: [],
    allEvents: true,
    allPermissions: true,
    gradient: "from-purple-500 to-pink-500",
    borderColor: "border-purple-300",
    bgLight: "bg-purple-50",
  },
  {
    value: "event-manager",
    label: "Event Manager",
    icon: "UserCog",
    description: "All event modules",
    role: "coordinator",
    permissions: ["speakers", "program", "checkin", "badges", "certificates", "print_station"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-blue-500 to-indigo-500",
    borderColor: "border-blue-300",
    bgLight: "bg-blue-50",
  },
  {
    value: "registration-manager",
    label: "Registration Mgr",
    icon: "ClipboardList",
    description: "Registrations only",
    role: "coordinator",
    permissions: ["registrations", "addons", "waitlist", "forms", "delegate_portal", "surveys", "leads"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-teal-500 to-emerald-500",
    borderColor: "border-teal-300",
    bgLight: "bg-teal-50",
  },
  {
    value: "program-coordinator",
    label: "Program Coord.",
    icon: "Calendar",
    description: "Speakers & program",
    role: "coordinator",
    permissions: ["speakers", "program"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-indigo-500 to-violet-500",
    borderColor: "border-indigo-300",
    bgLight: "bg-indigo-50",
  },
  {
    value: "checkin-staff",
    label: "Check-in Staff",
    icon: "CheckCircle",
    description: "Check-in & badges",
    role: "coordinator",
    permissions: ["checkin", "badges"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-green-500 to-emerald-500",
    borderColor: "border-green-300",
    bgLight: "bg-green-50",
  },
  {
    value: "badge-certificate",
    label: "Badge & Cert",
    icon: "Award",
    description: "Badges & certificates",
    role: "coordinator",
    permissions: ["badges", "certificates"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-pink-500 to-rose-500",
    borderColor: "border-pink-300",
    bgLight: "bg-pink-50",
  },
  {
    value: "travel-manager",
    label: "Travel Manager",
    icon: "MapPin",
    description: "All travel modules",
    role: "travel",
    permissions: ["flights", "hotels", "meals", "transfers", "visa_letters"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-cyan-500 to-blue-500",
    borderColor: "border-cyan-300",
    bgLight: "bg-cyan-50",
  },
  {
    value: "hotel-coordinator",
    label: "Hotel Coord.",
    icon: "Hotel",
    description: "Hotels only",
    role: "travel",
    permissions: ["hotels"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-amber-500 to-orange-500",
    borderColor: "border-amber-300",
    bgLight: "bg-amber-50",
  },
  {
    value: "flight-coordinator",
    label: "Flight Coord.",
    icon: "Plane",
    description: "Flights only",
    role: "travel",
    permissions: ["flights"],
    allEvents: false,
    allPermissions: false,
    gradient: "from-sky-500 to-blue-500",
    borderColor: "border-sky-300",
    bgLight: "bg-sky-50",
  },
  {
    value: "custom",
    label: "Custom",
    icon: "Settings",
    description: "Configure manually",
    role: "",
    permissions: [],
    allEvents: false,
    allPermissions: false,
    gradient: "from-slate-400 to-slate-500",
    borderColor: "border-slate-300",
    bgLight: "bg-slate-50",
  },
]

// ---------------------------------------------------------------------------
// Utility: detect which preset matches a given role + permissions combo
// ---------------------------------------------------------------------------

export function detectPreset(
  permissions: string[],
  role: string,
  options?: { allPermissions?: boolean; allEvents?: boolean }
): string {
  const allPermissions = options?.allPermissions ?? false
  const allEvents = options?.allEvents ?? false
  const sortedPerms = [...permissions].sort()

  for (const preset of ROLE_PRESETS) {
    if (preset.value === "custom") continue
    if (preset.role !== role) continue
    if (preset.allPermissions !== allPermissions) continue
    if (preset.allEvents !== allEvents) continue
    if (!preset.allPermissions) {
      const presetPerms = [...preset.permissions].sort()
      if (presetPerms.length !== sortedPerms.length) continue
      if (presetPerms.some((p, i) => p !== sortedPerms[i])) continue
    }
    return preset.value
  }
  return "custom"
}

/**
 * Detect preset for a TeamMember object directly.
 * Convenience wrapper around detectPreset().
 */
export function detectPresetForMember(member: TeamMember): RolePreset | null {
  const hasAllPerms = !member.permissions || member.permissions.length === 0
  const hasAllEvents = !member.event_ids || member.event_ids.length === 0
  const presetValue = detectPreset(member.permissions || [], member.role, {
    allPermissions: hasAllPerms,
    allEvents: hasAllEvents,
  })
  if (presetValue === "custom") return null
  return ROLE_PRESETS.find((p) => p.value === presetValue) ?? null
}

/**
 * Look up a role's config, with a sensible fallback for unknown roles.
 */
export function getRoleConfig(role: string): RoleConfig {
  return (
    ROLE_CONFIG[role] ?? {
      label: role,
      color: "text-gray-700",
      bg: "bg-gray-100",
      textColor: "text-gray-600",
      icon: "UserCog",
      gradient: "from-gray-400 to-gray-500",
      borderColor: "border-gray-300",
      bgLight: "bg-gray-50",
      description: role,
      capabilities: [],
      recommended: "",
    }
  )
}
