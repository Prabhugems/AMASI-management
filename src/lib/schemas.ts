/**
 * Zod Schemas for API Validation
 *
 * Centralized schema definitions for type-safe API validation
 */

import { z } from "zod"

// ==================== Common Schemas ====================

export const uuidSchema = z.string().uuid("Invalid UUID format")

export const emailSchema = z.string().email("Invalid email format").toLowerCase().trim()

export const phoneSchema = z.string().regex(/^\+?[\d\s-]{8,20}$/, "Invalid phone format").optional()

export const dateSchema = z.string().datetime({ offset: true }).or(z.date())

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

// ==================== Registration Schemas ====================

export const registrationCreateSchema = z.object({
  event_id: uuidSchema,
  ticket_type_id: uuidSchema,
  attendee_name: z.string().min(1, "Name is required").max(200).trim(),
  attendee_email: emailSchema,
  attendee_phone: phoneSchema,
  attendee_institution: z.string().max(300).optional(),
  attendee_designation: z.string().max(200).optional(),
  attendee_city: z.string().max(100).optional(),
  attendee_state: z.string().max(100).optional(),
  attendee_country: z.string().max(100).optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  discount_code: z.string().max(50).optional(),
  payment_method: z.enum(["free", "cash", "bank_transfer", "razorpay"]).default("free"),
  payment_id: uuidSchema.optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
  addons: z.array(z.object({
    addonId: uuidSchema,
    variantId: uuidSchema.optional(),
    quantity: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0),
    totalPrice: z.number().min(0),
  })).optional(),
})

export const registrationUpdateSchema = z.object({
  attendee_name: z.string().min(1).max(200).trim().optional(),
  attendee_email: emailSchema.optional(),
  attendee_phone: phoneSchema,
  attendee_institution: z.string().max(300).optional(),
  attendee_designation: z.string().max(200).optional(),
  status: z.enum(["pending", "confirmed", "cancelled", "refunded"]).optional(),
  payment_status: z.enum(["pending", "completed", "failed", "refunded"]).optional(),
  notes: z.string().max(2000).optional(),
})

// ==================== Check-in Schemas ====================

export const checkinSchema = z.object({
  event_id: uuidSchema,
  checkin_list_id: uuidSchema,
  registration_id: uuidSchema.optional(),
  registration_number: z.string().max(50).optional(),
  action: z.enum(["check_in", "check_out", "toggle"]).default("toggle"),
  user_id: uuidSchema.optional(),
}).refine(
  (data) => data.registration_id || data.registration_number,
  { message: "Either registration_id or registration_number is required" }
)

export const checkinListCreateSchema = z.object({
  event_id: uuidSchema,
  name: z.string().min(1, "Name is required").max(200).trim(),
  description: z.string().max(500).optional(),
  ticket_type_ids: z.array(uuidSchema).optional(),
  addon_ids: z.array(uuidSchema).optional(),
  starts_at: dateSchema.optional(),
  ends_at: dateSchema.optional(),
  allow_multiple_checkins: z.boolean().default(false),
})

// ==================== Form Schemas ====================

export const formSubmissionSchema = z.object({
  form_id: uuidSchema,
  responses: z.record(z.string(), z.any()),
  submitter_email: emailSchema.optional(),
  submitter_name: z.string().max(200).optional(),
  verified_emails: z.record(z.string(), z.boolean()).optional(),
})

// ==================== Import Schemas ====================

export const importRowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: emailSchema,
  phone: z.string().max(30).optional(),
  status: z.string().max(50).optional(),
  registered_on: z.string().optional(),
  total_amount: z.union([z.string(), z.number()]).optional(),
  ticket_name: z.string().optional(),
}).passthrough() // Allow additional fields

export const registrationImportSchema = z.object({
  event_id: uuidSchema,
  ticket_type_id: uuidSchema.optional(),
  rows: z.array(importRowSchema).min(1).max(10000),
  registration_prefix: z.string().max(20).optional(),
  fixed_amount: z.number().min(0).optional(),
})

export const facultyImportSchema = z.object({
  rows: z.array(z.object({
    name: z.string().min(1).max(200),
    email: emailSchema,
    phone: z.string().max(30).optional(),
    title: z.string().max(50).optional(),
    designation: z.string().max(200).optional(),
    department: z.string().max(200).optional(),
    institution: z.string().max(300).optional(),
    specialty: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
  }).passthrough()).min(1).max(5000),
})

// ==================== Badge Schemas ====================

export const badgeGenerateSchema = z.object({
  event_id: uuidSchema,
  template_id: uuidSchema,
  registration_ids: z.array(uuidSchema).optional(),
  single_registration_id: uuidSchema.optional(),
  badges_per_page: z.number().int().min(1).max(8).default(1),
  store_badges: z.boolean().default(false),
})

// ==================== Member Lookup Schema ====================

export const memberLookupSchema = z.object({
  email: emailSchema,
})

// ==================== Event Schemas ====================

export const eventCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(300).trim(),
  short_name: z.string().min(1).max(50).trim(),
  description: z.string().max(5000).optional(),
  start_date: dateSchema,
  end_date: dateSchema,
  venue: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).default("Asia/Kolkata"),
  registration_open: z.boolean().default(true),
})

// ==================== Ticket Schema ====================

export const ticketTypeSchema = z.object({
  event_id: uuidSchema,
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional(),
  price: z.number().min(0),
  quantity_total: z.number().int().min(0).optional(),
  status: z.enum(["active", "hidden", "soldout", "disabled"]).default("active"),
  sale_starts_at: dateSchema.optional(),
  sale_ends_at: dateSchema.optional(),
})

// ==================== Helper Functions ====================

/**
 * Validate request body against a schema
 * Returns parsed data or throws validation error
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T>> {
  const body = await request.json()
  return schema.parse(body)
}

/**
 * Safe validation - returns result object instead of throwing
 */
export async function safeValidateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: z.ZodError }> {
  const body = await request.json()
  const result = schema.safeParse(body)
  return result
}

/**
 * Format Zod errors for API response
 */
export function formatZodError(error: z.ZodError): { error: string; details: Record<string, string> } {
  const details: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".")
    details[path] = issue.message
  }
  return {
    error: "Validation failed",
    details,
  }
}
