/**
 * Toast Notification Presets
 *
 * Consistent toast messages for common operations
 */

import { toast } from "sonner"

// ==================== Success Toasts ====================

export const successToast = {
  /**
   * Generic success
   */
  success: (message: string) => {
    toast.success(message)
  },

  /**
   * Item created
   */
  created: (itemType: string) => {
    toast.success(`${itemType} created successfully`)
  },

  /**
   * Item updated
   */
  updated: (itemType: string) => {
    toast.success(`${itemType} updated successfully`)
  },

  /**
   * Item deleted
   */
  deleted: (itemType: string) => {
    toast.success(`${itemType} deleted successfully`)
  },

  /**
   * Item saved
   */
  saved: (itemType?: string) => {
    toast.success(itemType ? `${itemType} saved successfully` : "Saved successfully")
  },

  /**
   * Data exported
   */
  exported: (format?: string) => {
    toast.success(format ? `Exported to ${format}` : "Export complete")
  },

  /**
   * Data imported
   */
  imported: (count?: number) => {
    toast.success(count ? `Imported ${count} items` : "Import complete")
  },

  /**
   * Email sent
   */
  emailSent: (count?: number) => {
    toast.success(count && count > 1 ? `${count} emails sent` : "Email sent successfully")
  },

  /**
   * Copied to clipboard
   */
  copied: (what?: string) => {
    toast.success(what ? `${what} copied to clipboard` : "Copied to clipboard")
  },

  /**
   * Check-in success
   */
  checkedIn: (name?: string) => {
    toast.success(name ? `${name} checked in` : "Check-in successful")
  },

  /**
   * Check-out success
   */
  checkedOut: (name?: string) => {
    toast.success(name ? `${name} checked out` : "Check-out successful")
  },

  /**
   * Registration confirmed
   */
  confirmed: (what?: string) => {
    toast.success(what ? `${what} confirmed` : "Confirmed successfully")
  },

  /**
   * Payment received
   */
  paymentReceived: () => {
    toast.success("Payment received successfully")
  },

  /**
   * Form submitted
   */
  formSubmitted: () => {
    toast.success("Form submitted successfully")
  },

  /**
   * Settings saved
   */
  settingsSaved: () => {
    toast.success("Settings saved")
  },

  /**
   * Profile updated
   */
  profileUpdated: () => {
    toast.success("Profile updated")
  },

  /**
   * Invitation sent
   */
  invitationSent: (count?: number) => {
    toast.success(count && count > 1 ? `${count} invitations sent` : "Invitation sent")
  },
}

// ==================== Error Toasts ====================

export const errorToast = {
  /**
   * Generic error
   */
  error: (message: string) => {
    toast.error(message)
  },

  /**
   * Operation failed
   */
  failed: (operation: string, error?: string) => {
    toast.error(`Failed to ${operation}${error ? `: ${error}` : ""}`)
  },

  /**
   * Network error
   */
  network: () => {
    toast.error("Network error. Please check your connection.")
  },

  /**
   * Unauthorized
   */
  unauthorized: () => {
    toast.error("You don't have permission to perform this action")
  },

  /**
   * Not found
   */
  notFound: (itemType: string) => {
    toast.error(`${itemType} not found`)
  },

  /**
   * Validation error
   */
  validation: (message?: string) => {
    toast.error(message || "Please check your input and try again")
  },

  /**
   * Server error
   */
  server: () => {
    toast.error("Server error. Please try again later.")
  },

  /**
   * File too large
   */
  fileTooLarge: (maxSize?: string) => {
    toast.error(maxSize ? `File exceeds maximum size of ${maxSize}` : "File is too large")
  },

  /**
   * Invalid file type
   */
  invalidFileType: (allowed?: string[]) => {
    toast.error(
      allowed
        ? `Invalid file type. Allowed: ${allowed.join(", ")}`
        : "Invalid file type"
    )
  },

  /**
   * Duplicate entry
   */
  duplicate: (what?: string) => {
    toast.error(what ? `${what} already exists` : "Duplicate entry")
  },

  /**
   * Required field
   */
  required: (field: string) => {
    toast.error(`${field} is required`)
  },

  /**
   * Payment failed
   */
  paymentFailed: (reason?: string) => {
    toast.error(reason ? `Payment failed: ${reason}` : "Payment failed. Please try again.")
  },

  /**
   * Session expired
   */
  sessionExpired: () => {
    toast.error("Your session has expired. Please log in again.")
  },

  /**
   * Rate limited
   */
  rateLimited: () => {
    toast.error("Too many requests. Please wait a moment and try again.")
  },
}

// ==================== Warning Toasts ====================

export const warningToast = {
  /**
   * Generic warning
   */
  warning: (message: string) => {
    toast.warning(message)
  },

  /**
   * Unsaved changes
   */
  unsavedChanges: () => {
    toast.warning("You have unsaved changes")
  },

  /**
   * Approaching limit
   */
  approachingLimit: (what: string, current: number, max: number) => {
    toast.warning(`${what}: ${current}/${max} (${Math.round((current / max) * 100)}% used)`)
  },

  /**
   * Low quantity
   */
  lowQuantity: (what: string, remaining: number) => {
    toast.warning(`Only ${remaining} ${what} remaining`)
  },

  /**
   * Expiring soon
   */
  expiringSoon: (what: string, when: string) => {
    toast.warning(`${what} expires ${when}`)
  },

  /**
   * Incomplete
   */
  incomplete: (what: string) => {
    toast.warning(`${what} is incomplete`)
  },
}

// ==================== Info Toasts ====================

export const infoToast = {
  /**
   * Generic info
   */
  info: (message: string) => {
    toast.info(message)
  },

  /**
   * Loading
   */
  loading: (message: string) => {
    return toast.loading(message)
  },

  /**
   * No changes
   */
  noChanges: () => {
    toast.info("No changes to save")
  },

  /**
   * No results
   */
  noResults: (what?: string) => {
    toast.info(what ? `No ${what} found` : "No results found")
  },

  /**
   * Syncing
   */
  syncing: () => {
    return toast.loading("Syncing...")
  },

  /**
   * Processing
   */
  processing: () => {
    return toast.loading("Processing...")
  },
}

// ==================== Promise Toast ====================

/**
 * Toast with promise handling
 *
 * Usage:
 * ```
 * promiseToast(
 *   saveData(),
 *   {
 *     loading: "Saving...",
 *     success: "Saved!",
 *     error: "Failed to save"
 *   }
 * )
 * ```
 */
export function promiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: Error) => string)
  }
): Promise<T> {
  toast.promise(promise, messages)
  return promise
}

// ==================== Action Toast ====================

/**
 * Toast with action button
 *
 * Usage:
 * ```
 * actionToast("Item deleted", {
 *   actionLabel: "Undo",
 *   onAction: () => restoreItem()
 * })
 * ```
 */
export function actionToast(
  message: string,
  options: {
    actionLabel: string
    onAction: () => void
    type?: "success" | "error" | "warning" | "info"
  }
) {
  const { actionLabel, onAction, type = "success" } = options

  const toastFn = {
    success: toast.success,
    error: toast.error,
    warning: toast.warning,
    info: toast.info,
  }[type]

  toastFn(message, {
    action: {
      label: actionLabel,
      onClick: onAction,
    },
  })
}

// ==================== Dismiss Toast ====================

/**
 * Dismiss a toast by ID
 */
export function dismissToast(toastId: string | number) {
  toast.dismiss(toastId)
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts() {
  toast.dismiss()
}
