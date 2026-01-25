/**
 * Password Strength Utilities
 *
 * Password validation and strength checking
 */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong"
  color: string
  feedback: string[]
}

export interface PasswordRequirement {
  id: string
  label: string
  test: (password: string) => boolean
}

/**
 * Default password requirements
 */
export const defaultRequirements: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (p) => p.length >= 8,
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: "number",
    label: "At least one number",
    test: (p) => /\d/.test(p),
  },
  {
    id: "special",
    label: "At least one special character",
    test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
]

/**
 * Check password against requirements
 */
export function checkRequirements(
  password: string,
  requirements: PasswordRequirement[] = defaultRequirements
): { passed: string[]; failed: string[] } {
  const passed: string[] = []
  const failed: string[] = []

  for (const req of requirements) {
    if (req.test(password)) {
      passed.push(req.id)
    } else {
      failed.push(req.id)
    }
  }

  return { passed, failed }
}

/**
 * Calculate password strength
 */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      label: "Very Weak",
      color: "bg-gray-200",
      feedback: ["Enter a password"],
    }
  }

  const feedback: string[] = []
  let score = 0

  // Length checks
  if (password.length >= 8) score++
  else feedback.push("Use at least 8 characters")

  if (password.length >= 12) score++
  if (password.length >= 16) score++

  // Character variety
  if (/[a-z]/.test(password)) score += 0.5
  else feedback.push("Add lowercase letters")

  if (/[A-Z]/.test(password)) score += 0.5
  else feedback.push("Add uppercase letters")

  if (/\d/.test(password)) score += 0.5
  else feedback.push("Add numbers")

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 0.5
  else feedback.push("Add special characters")

  // Penalty for common patterns
  if (/^[a-z]+$/i.test(password)) {
    score -= 1
    feedback.push("Avoid using only letters")
  }

  if (/^[0-9]+$/.test(password)) {
    score -= 1
    feedback.push("Avoid using only numbers")
  }

  if (/(.)\1{2,}/.test(password)) {
    score -= 1
    feedback.push("Avoid repeating characters")
  }

  // Common passwords penalty
  const commonPasswords = [
    "password",
    "123456",
    "qwerty",
    "abc123",
    "password123",
    "admin",
    "letmein",
    "welcome",
  ]
  if (commonPasswords.includes(password.toLowerCase())) {
    score = 0
    feedback.push("This is a commonly used password")
  }

  // Normalize score to 0-4
  const normalizedScore = Math.max(0, Math.min(4, Math.round(score))) as 0 | 1 | 2 | 3 | 4

  const labels: Record<number, "Very Weak" | "Weak" | "Fair" | "Strong" | "Very Strong"> = {
    0: "Very Weak",
    1: "Weak",
    2: "Fair",
    3: "Strong",
    4: "Very Strong",
  }

  const colors: Record<number, string> = {
    0: "bg-red-500",
    1: "bg-orange-500",
    2: "bg-yellow-500",
    3: "bg-lime-500",
    4: "bg-green-500",
  }

  return {
    score: normalizedScore,
    label: labels[normalizedScore],
    color: colors[normalizedScore],
    feedback: feedback.slice(0, 3), // Max 3 feedback items
  }
}

/**
 * Validate password against requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirement[] = defaultRequirements
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const req of requirements) {
    if (!req.test(password)) {
      errors.push(req.label)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Generate a random strong password
 */
export function generatePassword(length: number = 16): string {
  const lowercase = "abcdefghijklmnopqrstuvwxyz"
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const special = "!@#$%^&*"

  const allChars = lowercase + uppercase + numbers + special

  // Ensure at least one of each type
  let password = ""
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += special[Math.floor(Math.random() * special.length)]

  // Fill the rest
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }

  // Shuffle
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("")
}

/**
 * Check if passwords match
 */
export function passwordsMatch(
  password: string,
  confirmPassword: string
): { match: boolean; error?: string } {
  if (!confirmPassword) {
    return { match: false, error: "Please confirm your password" }
  }

  if (password !== confirmPassword) {
    return { match: false, error: "Passwords do not match" }
  }

  return { match: true }
}

/**
 * Estimate time to crack password (simplified)
 */
export function estimateCrackTime(password: string): string {
  const { score } = getPasswordStrength(password)

  const estimates: Record<number, string> = {
    0: "Instantly",
    1: "A few minutes",
    2: "A few hours",
    3: "Several years",
    4: "Centuries",
  }

  return estimates[score] || "Unknown"
}
