/**
 * Application configuration constants
 * Centralized configuration to avoid hardcoded values throughout the codebase
 */

// Company/Organization branding
export const COMPANY_CONFIG = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "AMASI",
  fullName: process.env.NEXT_PUBLIC_COMPANY_FULL_NAME || "Association of Minimal Access Surgeons of India",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@amasi.org",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "https://amasi.org",
}

// Default values for data entry
export const DEFAULTS = {
  country: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || "India",
  timezone: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE || "Asia/Kolkata",
  currency: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || "INR",
  currencySymbol: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY_SYMBOL || "₹",
}

// Registration number configuration
export const REGISTRATION_CONFIG = {
  defaultPrefix: "REG",
  defaultFormat: "REG-YYYYMMDD-XXXX",
}

// Pagination defaults
export const PAGINATION = {
  defaultPageSize: 20,
  maxPageSize: 100,
}

// Rate limiting tiers (requests per minute)
export const RATE_LIMITS = {
  default: 60,
  auth: 20,
  bulk: 10,
}

// File upload limits
export const UPLOAD_LIMITS = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxImageSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  allowedDocTypes: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
}

// Supported timezones (common ones)
export const SUPPORTED_TIMEZONES = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "British Time (GMT/BST)" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)" },
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AET)" },
]

// Email footer configuration
export const EMAIL_CONFIG = {
  getFooter: (year = new Date().getFullYear()) =>
    `© ${year} ${COMPANY_CONFIG.name}. All rights reserved.`,
  unsubscribeText: "You received this email because you registered for an event.",
}

// API configuration
export const API_CONFIG = {
  getBaseUrl: (): string => {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`
    }
    if (process.env.NODE_ENV === "development") {
      return "http://localhost:3000"
    }
    // Production without config - return empty for relative paths
    console.warn("No NEXT_PUBLIC_APP_URL configured")
    return ""
  },
}
