// Theme types
export type ThemeMode = "light" | "dark" | "system"
export type ThemeColor = "violet" | "blue" | "green" | "rose" | "amber" | "cyan" | "orange"

export interface ThemeConfig {
  mode: ThemeMode
  color: ThemeColor
}

// User & Auth types
export interface User {
  id: string
  email: string
  full_name: string
  avatar_url?: string
  platform_role: PlatformRole
  created_at: string
  updated_at: string
}

export type PlatformRole = "super_admin" | "admin" | "coordinator" | "user"

export type EventRole = "event_admin" | "committee_member" | "registration_desk" | "viewer"

// Event types
export type EventType = "conference" | "course" | "workshop" | "webinar" | "meeting"
export type EventStatus = "draft" | "setup" | "planning" | "active" | "completed" | "archived"

export interface Event {
  id: string
  code: string
  name: string
  type: EventType
  status: EventStatus
  start_date: string
  end_date: string
  venue: string
  city: string
  state: string
  country: string
  description?: string
  banner_url?: string
  settings: EventSettings
  created_at: string
  updated_at: string
}

export interface EventSettings {
  enable_logistics: boolean
  enable_honorarium: boolean
  enable_certificates: boolean
  enable_badges: boolean
  enable_faculty_portal: boolean
  enable_whatsapp: boolean
}

export interface EventStats {
  faculty: {
    total: number
    confirmed: number
    pending: number
    declined: number
  }
  delegates: {
    total: number
    checkedIn: number
    badgesPrinted: number
  }
  sessions: {
    total: number
    completed: number
  }
  sponsors: {
    total: number
    paid: number
  }
  travel: {
    total: number
    booked: number
    pending: number
  }
  tickets: {
    open: number
    urgent: number
  }
}

// Faculty types
export interface Faculty {
  id: string
  title: string
  full_name: string
  email_primary: string
  email_secondary?: string
  mobile_primary: string
  mobile_whatsapp?: string
  designation?: string
  institution?: string
  department?: string
  city?: string
  state?: string
  country: string
  specializations: string[]
  bio?: string
  photo_url?: string
  amasi_member_id?: string
  pan_number?: string
  bank_name?: string
  account_number?: string
  ifsc_code?: string
  total_events: number
  created_at: string
  updated_at: string
}

// Session types
export type SessionType = "plenary" | "panel" | "workshop" | "live_surgery" | "hands_on" | "symposium" | "keynote"

export interface Session {
  id: string
  event_id: string
  name: string
  type: SessionType
  day_number: number
  session_date: string
  start_time: string
  end_time: string
  hall: string
  description?: string
  max_faculty: number
  created_at: string
  updated_at: string
}

// Commitment types
export type CommitmentRole = "speaker" | "chairperson" | "moderator" | "panelist" | "coordinator" | "demonstrator"
export type CommitmentStatus = "pending" | "accepted" | "rejected" | "modified"
export type InvitationStatus = "not_invited" | "invited" | "reminded" | "confirmed" | "declined"

export interface Commitment {
  id: string
  event_id: string
  faculty_id: string
  session_id: string
  role: CommitmentRole
  topic_title?: string
  topic_description?: string
  duration?: number
  status: CommitmentStatus
  invitation_status: InvitationStatus
  response_date?: string
  rejection_reason?: string
  priority: "high" | "normal" | "low"
  vip_flag: boolean
  internal_notes?: string
  created_at: string
  updated_at: string
}

// Delegate types
export type DelegateCategory = "faculty" | "delegate" | "student" | "organizer" | "sponsor" | "vip" | "media" | "exhibitor"

export interface Delegate {
  id: string
  event_id: string
  registration_id: string
  category: DelegateCategory
  title?: string
  full_name: string
  email: string
  mobile?: string
  designation?: string
  institution?: string
  city?: string
  state?: string
  country: string
  checked_in: boolean
  checked_in_at?: string
  badge_printed: boolean
  badge_printed_at?: string
  created_at: string
  updated_at: string
}

// Certificate types
export type CertificateType = "speaker" | "faculty" | "participation" | "course_completion" | "combined"

export interface Certificate {
  id: string
  event_id: string
  faculty_id?: string
  delegate_id?: string
  certificate_type: CertificateType
  certificate_number: string
  name_on_certificate: string
  roles_listed?: string[]
  topics_listed?: string[]
  generated_at?: string
  downloaded: boolean
  downloaded_at?: string
  certificate_url?: string
  created_at: string
  updated_at: string
}

// Activity & Logs
export interface ActivityLog {
  id: string
  type: string
  message: string
  event_id?: string
  event_name?: string
  user_id?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// Alert types
export type AlertType = "error" | "warning" | "success" | "info"

export interface Alert {
  id: string
  type: AlertType
  message: string
  event_id?: string
  event_name?: string
  created_at: string
}

// Quick Stats
export interface QuickStats {
  totalMembers: number
  totalFaculty: number
  activeEvents: number
  upcomingEvents: number
  certificatesIssued: number
  pendingTickets: number
}

// API Response types
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// =====================================================
// PAYMENT & REGISTRATION TYPES
// =====================================================

// Ticket Types
export type TicketStatus = "draft" | "active" | "paused" | "sold_out" | "expired"

export interface TicketType {
  id: string
  event_id: string
  name: string
  description?: string
  price: number
  currency: string
  quantity_total?: number
  quantity_sold: number
  min_per_order: number
  max_per_order: number
  sale_start_date?: string
  sale_end_date?: string
  status: TicketStatus
  is_hidden: boolean
  requires_approval: boolean
  tax_percentage: number
  sort_order: number
  metadata?: Record<string, unknown>
  form_id?: string  // Link to a form for this ticket
  form?: Form       // Populated form data
  exclusivity_group?: string  // Tickets in same group: only ONE can be selected
  created_at: string
  updated_at: string
}

// Registration Types
export type RegistrationStatus = "pending" | "confirmed" | "cancelled" | "refunded" | "waitlisted"

export interface Registration {
  id: string
  event_id: string
  ticket_type_id: string
  registration_number: string
  salutation?: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  whatsapp?: string
  designation?: string
  institution?: string
  department?: string
  city?: string
  state?: string
  country: string
  quantity: number
  unit_price: number
  tax_amount: number
  discount_amount: number
  total_amount: number
  currency: string
  status: RegistrationStatus
  payment_id?: string
  discount_code?: string
  dietary_preference?: string
  tshirt_size?: string
  special_requirements?: string
  how_heard_about_us?: string
  metadata?: Record<string, unknown>
  checked_in: boolean
  checked_in_at?: string
  checked_in_by?: string
  badge_printed: boolean
  badge_printed_at?: string
  confirmed_at?: string
  cancelled_at?: string
  refunded_at?: string
  created_at: string
  updated_at: string
  // Relations
  ticket_type?: TicketType
  payment?: Payment
}

// Payment Types
export type PaymentType = "registration" | "membership" | "sponsorship" | "other"
export type PaymentMethod = "razorpay" | "bank_transfer" | "cash" | "cheque" | "complimentary"
export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded" | "partially_refunded"

export interface Payment {
  id: string
  payment_number: string
  payment_type: PaymentType
  payment_method: PaymentMethod
  payer_name: string
  payer_email: string
  payer_phone?: string
  amount: number
  currency: string
  tax_amount: number
  discount_amount: number
  net_amount: number
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  refund_amount: number
  refund_reason?: string
  razorpay_refund_id?: string
  refunded_at?: string
  refunded_by?: string
  status: PaymentStatus
  event_id?: string
  metadata?: Record<string, unknown>
  notes?: string
  completed_at?: string
  failed_at?: string
  created_at: string
  updated_at: string
}

// Membership Types
export type MembershipType = "annual" | "lifetime" | "student" | "senior" | "international"
export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled" | "grace_period"

export interface MembershipPlan {
  id: string
  name: string
  type: MembershipType
  description?: string
  price: number
  currency: string
  duration_months?: number
  benefits: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MemberSubscription {
  id: string
  member_id: string
  plan_id: string
  payment_id?: string
  start_date: string
  end_date?: string
  status: SubscriptionStatus
  auto_renew: boolean
  notes?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  // Relations
  plan?: MembershipPlan
  payment?: Payment
}

// Discount Code Types
export type DiscountType = "percentage" | "fixed"

export interface DiscountCode {
  id: string
  code: string
  description?: string
  discount_type: DiscountType
  discount_value: number
  max_uses?: number
  times_used: number
  min_order_amount?: number
  max_discount_amount?: number
  valid_from?: string
  valid_until?: string
  event_id?: string
  ticket_type_ids?: string[]
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

// Razorpay Types
export interface RazorpayOrder {
  id: string
  entity: string
  amount: number
  amount_paid: number
  amount_due: number
  currency: string
  receipt: string
  status: string
  attempts: number
  created_at: number
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface CreateOrderInput {
  amount: number
  currency?: string
  receipt: string
  notes?: Record<string, string>
}

export interface VerifyPaymentInput {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
  registration_id?: string
  subscription_id?: string
}

// Cart Types (for checkout)
export interface CartItem {
  ticket_type_id: string
  ticket_name: string
  quantity: number
  unit_price: number
  tax_amount: number
  total: number
}

export interface Cart {
  event_id: string
  event_name: string
  items: CartItem[]
  subtotal: number
  tax_total: number
  discount_amount: number
  discount_code?: string
  grand_total: number
}

// Registration Form Types
export interface RegistrationFormData {
  salutation: string
  first_name: string
  last_name: string
  email: string
  phone: string
  whatsapp?: string
  designation?: string
  institution?: string
  department?: string
  city?: string
  state?: string
  country: string
  dietary_preference?: string
  tshirt_size?: string
  special_requirements?: string
  how_heard_about_us?: string
}

// =====================================================
// FORM MANAGEMENT TYPES (Fillout-style)
// =====================================================

// Form Types
export type FormType = "standalone" | "event_registration" | "feedback" | "survey" | "application" | "contact"
export type FormStatus = "draft" | "published" | "archived"

export interface Form {
  id: string
  name: string
  description?: string
  slug?: string
  form_type: FormType
  event_id?: string
  status: FormStatus

  // Settings
  is_public: boolean
  requires_auth: boolean
  allow_multiple_submissions: boolean
  is_member_form?: boolean // AMASI membership verification enabled
  membership_required_strict?: boolean // Block non-members from submitting (default true for exams, false for discounts)
  release_certificate_on_submission?: boolean
  auto_email_certificate?: boolean
  require_check_in_for_submission?: boolean
  submit_button_text: string
  success_message: string
  redirect_url?: string

  // Branding
  logo_url?: string
  header_image_url?: string
  primary_color: string
  background_color?: string

  // Notifications
  notify_on_submission: boolean
  notification_emails: string[]

  // Limits
  max_submissions?: number
  submission_deadline?: string

  // Metadata
  created_by?: string
  created_at: string
  updated_at: string

  // Relations (optional, populated when joined)
  fields?: FormField[]
  sections?: FormSection[]
  event?: Event
  _count?: {
    fields: number
    submissions: number
  }
}

// Field Types
export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "multiselect"
  | "checkbox"
  | "checkboxes"
  | "radio"
  | "textarea"
  | "date"
  | "time"
  | "datetime"
  | "file"
  | "signature"
  | "rating"
  | "scale"
  | "heading"
  | "paragraph"
  | "divider"
  | "payment"

export type FieldWidth = "full" | "half" | "third"

export interface FieldOption {
  value: string
  label: string
}

export interface ConditionalRule {
  field_id: string
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "is_empty" | "is_not_empty"
  value: string | number | boolean
}

export interface ConditionalLogic {
  action: "show" | "hide" | "require"
  logic: "all" | "any" // AND / OR
  rules: ConditionalRule[]
}

export interface FieldSettings {
  // File upload settings
  allowed_file_types?: string[]
  max_file_size?: number // in MB
  allow_multiple?: boolean
  max_files?: number

  // Rating settings
  max_rating?: number
  rating_icon?: "star" | "heart" | "thumb"

  // Scale settings
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string

  // Heading settings
  heading_size?: "h1" | "h2" | "h3"

  // Divider settings
  divider_color?: string
  divider_style?: "solid" | "dashed" | "dotted"
  divider_thickness?: "thin" | "medium" | "thick"

  // Date settings
  date_format?: string
  min_date?: string
  max_date?: string

  // Number settings
  decimal_places?: number

  // Select settings
  allow_other?: boolean
  searchable?: boolean

  // Phone settings
  default_country?: string
  show_country?: boolean
  phone_verification?: boolean

  // Layout settings
  label_position?: "top" | "left"
  spacing?: "compact" | "normal" | "relaxed"
  hide_label?: boolean
  help_position?: "below" | "tooltip"

  // Email settings - Member lookup
  member_lookup?: boolean

  // Label formatting
  label_bold?: boolean
  label_italic?: boolean
  label_underline?: boolean
  label_color?: string
  label_alignment?: "left" | "center" | "right"
}

export interface FormField {
  id: string
  form_id: string

  // Field config
  field_type: FieldType
  label: string
  placeholder?: string
  help_text?: string

  // Validation
  is_required: boolean
  min_length?: number
  max_length?: number
  min_value?: number
  max_value?: number
  pattern?: string

  // Options (for select, radio, checkbox)
  options?: FieldOption[]

  // Conditional logic
  conditional_logic?: ConditionalLogic

  // Layout
  sort_order: number
  width: FieldWidth
  section_id?: string

  // Field-specific settings
  settings?: FieldSettings

  created_at: string
  updated_at: string
}

// Form Sections (for multi-step forms)
export interface FormSection {
  id: string
  form_id: string
  name: string
  description?: string
  sort_order: number
  created_at: string

  // Relations
  fields?: FormField[]
}

// Form Submissions
export type SubmissionStatus = "pending" | "reviewed" | "approved" | "rejected"

export interface FormSubmission {
  id: string
  form_id: string

  // Submitter info
  submitter_email?: string
  submitter_name?: string
  submitter_ip?: string
  user_agent?: string

  // Response data
  responses: Record<string, unknown>

  // Status
  status: SubmissionStatus

  // Metadata
  submitted_at: string
  reviewed_at?: string
  reviewed_by?: string

  // Relations
  form?: Form
}

// Form Templates
export type TemplateCategory = "registration" | "feedback" | "survey" | "application" | "contact" | "other"

export interface FormTemplate {
  id: string
  name: string
  description?: string
  category: TemplateCategory
  thumbnail_url?: string
  form_config: {
    name: string
    description?: string
    form_type: FormType
    settings: Partial<Form>
    fields: Partial<FormField>[]
  }
  is_system: boolean
  created_at: string
}

// Form Builder State
export interface FormBuilderState {
  form: Form | null
  fields: FormField[]
  sections: FormSection[]
  selectedFieldId: string | null
  isDirty: boolean
  isPreviewMode: boolean
}

// Field Palette Item (for drag-drop)
export interface FieldPaletteItem {
  type: FieldType
  label: string
  icon: string
  category: "basic" | "choice" | "advanced" | "layout"
  defaultSettings?: Partial<FormField>
}

// =====================================================
// ABSTRACT MANAGEMENT TYPES
// =====================================================

export type AbstractStatus = 'submitted' | 'under_review' | 'revision_requested' | 'accepted' | 'rejected' | 'withdrawn'
export type PresentationType = 'oral' | 'poster' | 'video' | 'either'
export type ReviewRecommendation = 'accept' | 'reject' | 'revise' | 'undecided'

export interface Abstract {
  id: string
  event_id: string
  registration_id: string | null
  category_id: string | null
  abstract_number: string
  title: string
  abstract_text: string
  keywords: string[] | null
  presentation_type: PresentationType
  presenting_author_name: string
  presenting_author_email: string
  presenting_author_affiliation: string | null
  presenting_author_phone: string | null
  status: AbstractStatus
  decision_date: string | null
  decision_notes: string | null
  accepted_as: string | null
  session_id: string | null
  session_date: string | null
  session_time: string | null
  session_location: string | null
  file_url: string | null
  file_name: string | null
  file_size: number | null
  submitted_at: string
  updated_at: string
  created_at: string
  // Relations
  category?: AbstractCategory
  authors?: AbstractAuthor[]
  reviews?: AbstractReview[]
}

export interface AbstractAuthor {
  id: string
  abstract_id: string
  author_order: number
  name: string
  email: string | null
  affiliation: string | null
  is_presenting: boolean
  created_at: string
}

export interface AbstractReview {
  id: string
  abstract_id: string
  reviewer_id: string | null
  reviewer_name: string | null
  reviewer_email: string | null
  score_originality: number | null
  score_methodology: number | null
  score_relevance: number | null
  score_clarity: number | null
  overall_score: number | null
  recommendation: ReviewRecommendation | null
  comments_to_author: string | null
  comments_private: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface AbstractSettings {
  event_id: string
  submission_opens_at: string | null
  submission_deadline: string | null
  revision_deadline: string | null
  notification_date: string | null
  max_submissions_per_person: number
  max_authors: number
  word_limit: number
  require_registration: boolean
  require_addon_id: string | null
  allowed_file_types: string[]
  max_file_size_mb: number
  presentation_types: string[]
  review_enabled: boolean
  reviewers_per_abstract: number
  blind_review: boolean
  submission_guidelines: string | null
  author_guidelines: string | null
  notify_on_submission: boolean
  notify_on_decision: boolean
}

export interface AbstractCategory {
  id: string
  event_id: string
  name: string
  description: string | null
  max_submissions: number | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AbstractFilters {
  event_id: string
  status?: AbstractStatus
  category_id?: string
  presentation_type?: PresentationType
  search?: string
  email?: string
}

export interface AbstractStats {
  total: number
  submitted: number
  under_review: number
  revision_requested: number
  accepted: number
  rejected: number
  withdrawn: number
  average_score: number | null
  with_reviews: number
}
