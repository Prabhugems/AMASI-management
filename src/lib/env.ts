/**
 * Environment variable validation
 * Import this in your app's entry point to validate env vars at startup
 */

type EnvVar = {
  name: string
  required: boolean
  description: string
}

const envVars: EnvVar[] = [
  // Supabase
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, description: 'Supabase service role key (server only)' },

  // App
  { name: 'NEXT_PUBLIC_APP_URL', required: false, description: 'Public app URL for emails and redirects' },

  // Razorpay
  { name: 'RAZORPAY_KEY_ID', required: false, description: 'Razorpay API key ID' },
  { name: 'RAZORPAY_KEY_SECRET', required: false, description: 'Razorpay API key secret' },
  { name: 'RAZORPAY_WEBHOOK_SECRET', required: false, description: 'Razorpay webhook secret' },

  // Email - Blastable (preferred)
  { name: 'BLASTABLE_API_KEY', required: false, description: 'Blastable API key for sending emails' },
  { name: 'BLASTABLE_FROM_EMAIL', required: false, description: 'From email address for Blastable' },

  // OCR - OCR.space (for image ticket extraction)
  { name: 'OCR_SPACE_API_KEY', required: false, description: 'OCR.space API key for image text extraction' },

  // URL Shortener - Linkila
  { name: 'LINKILA_API_KEY', required: false, description: 'Linkila API key for URL shortening' },

  // Webhooks - Boost.space / Zapier / Make
  { name: 'BOOSTSPACE_WEBHOOK_URL', required: false, description: 'Boost.space webhook URL for automations' },
  { name: 'WEBHOOK_URLS', required: false, description: 'Comma-separated webhook URLs for external integrations' },

  // Email - Resend (fallback)
  { name: 'RESEND_API_KEY', required: false, description: 'Resend API key for sending emails' },
  { name: 'RESEND_FROM_EMAIL', required: false, description: 'From email address for Resend' },

  // Security
  { name: 'NEXTAUTH_SECRET', required: false, description: 'Secret for hashing/encryption' },
]

export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  for (const envVar of envVars) {
    const value = process.env[envVar.name]

    if (!value || value === '' || value.includes('placeholder')) {
      if (envVar.required) {
        errors.push(`Missing required environment variable: ${envVar.name} - ${envVar.description}`)
      } else {
        // Only warn for optional vars that are commonly needed
        if (['RAZORPAY_KEY_ID', 'RESEND_API_KEY', 'NEXTAUTH_SECRET'].includes(envVar.name)) {
          warnings.push(`Optional environment variable not set: ${envVar.name} - ${envVar.description}`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Get a required environment variable, throwing if not set
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value || value === '' || value.includes('placeholder')) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Get an optional environment variable with a default
 */
export function getOptionalEnv(name: string, defaultValue: string = ''): string {
  const value = process.env[name]?.trim()
  if (!value || value === '' || value.includes('placeholder')) {
    return defaultValue
  }
  return value
}

/**
 * Check if a feature is enabled based on its required env vars being set
 */
export function isFeatureEnabled(feature: 'razorpay' | 'email'): boolean {
  switch (feature) {
    case 'razorpay':
      return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    case 'email':
      // Check for Blastable first, then Resend
      return !!(
        (process.env.BLASTABLE_API_KEY && process.env.BLASTABLE_FROM_EMAIL) ||
        (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)
      )
    default:
      return false
  }
}
