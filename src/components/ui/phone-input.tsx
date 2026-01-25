"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Common country codes
const countryCodes = [
  { code: "+91", country: "IN", name: "India", flag: "🇮🇳" },
  { code: "+1", country: "US", name: "United States", flag: "🇺🇸" },
  { code: "+44", country: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+971", country: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "+65", country: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "+61", country: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "+49", country: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "FR", name: "France", flag: "🇫🇷" },
  { code: "+81", country: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "+86", country: "CN", name: "China", flag: "🇨🇳" },
]

interface PhoneInputProps {
  value?: string
  onChange?: (value: string) => void
  defaultCountry?: string
  placeholder?: string
  disabled?: boolean
  className?: string
}

/**
 * Phone Input Component
 *
 * Phone number input with country code selector
 *
 * Usage:
 * ```
 * <PhoneInput
 *   value={phone}
 *   onChange={setPhone}
 *   defaultCountry="IN"
 * />
 * ```
 */
export function PhoneInput({
  value = "",
  onChange,
  defaultCountry = "IN",
  placeholder = "Phone number",
  disabled = false,
  className,
}: PhoneInputProps) {
  const [countryCode, setCountryCode] = React.useState(() => {
    // Try to detect country code from value
    if (value) {
      for (const cc of countryCodes) {
        if (value.startsWith(cc.code)) {
          return cc.code
        }
      }
    }
    // Use default country
    const defaultCC = countryCodes.find((cc) => cc.country === defaultCountry)
    return defaultCC?.code || "+91"
  })

  const [phoneNumber, setPhoneNumber] = React.useState(() => {
    // Remove country code from value
    if (value) {
      for (const cc of countryCodes) {
        if (value.startsWith(cc.code)) {
          return value.slice(cc.code.length).trim()
        }
      }
    }
    return value
  })

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode)
    if (phoneNumber) {
      onChange?.(`${newCode}${phoneNumber}`)
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits and spaces
    const cleaned = e.target.value.replace(/[^\d\s]/g, "")
    setPhoneNumber(cleaned)
    onChange?.(`${countryCode}${cleaned.replace(/\s/g, "")}`)
  }

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, "")

    // Indian format: XXXXX XXXXX
    if (countryCode === "+91" && digits.length === 10) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`
    }

    // US format: (XXX) XXX-XXXX
    if (countryCode === "+1" && digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }

    return phone
  }

  const selectedCountry = countryCodes.find((cc) => cc.code === countryCode)

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        value={countryCode}
        onValueChange={handleCountryChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[90px] flex-shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1">
              <span>{selectedCountry?.flag}</span>
              <span className="text-xs">{countryCode}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countryCodes.map((cc) => (
            <SelectItem key={cc.code} value={cc.code}>
              <span className="flex items-center gap-2">
                <span>{cc.flag}</span>
                <span>{cc.name}</span>
                <span className="text-muted-foreground">{cc.code}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="tel"
        value={formatPhoneNumber(phoneNumber)}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  )
}

/**
 * Simple phone input (no country selector)
 */
export function SimplePhoneInput({
  value = "",
  onChange,
  placeholder = "Phone number",
  disabled = false,
  className,
}: {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const cleaned = e.target.value.replace(/\D/g, "")
    onChange?.(cleaned)
  }

  const formatDisplay = (phone: string): string => {
    const digits = phone.replace(/\D/g, "")

    // Format as XXXXX XXXXX for 10 digits
    if (digits.length === 10) {
      return `${digits.slice(0, 5)} ${digits.slice(5)}`
    }

    return digits
  }

  return (
    <Input
      type="tel"
      value={formatDisplay(value)}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  )
}

/**
 * Phone input with validation
 */
export function PhoneInputWithValidation({
  value = "",
  onChange,
  onValidChange,
  defaultCountry = "IN",
  required = false,
  disabled = false,
  className,
}: PhoneInputProps & {
  onValidChange?: (isValid: boolean) => void
  required?: boolean
}) {
  const [error, setError] = React.useState<string | null>(null)

  const validatePhone = (phone: string, countryCode: string): boolean => {
    const digits = phone.replace(/\D/g, "")

    // India: 10 digits
    if (countryCode === "+91") {
      return digits.length === 10
    }

    // US/Canada: 10 digits
    if (countryCode === "+1") {
      return digits.length === 10
    }

    // General: 7-15 digits
    return digits.length >= 7 && digits.length <= 15
  }

  const handleChange = (newValue: string) => {
    onChange?.(newValue)

    if (!newValue && !required) {
      setError(null)
      onValidChange?.(true)
      return
    }

    if (!newValue && required) {
      setError("Phone number is required")
      onValidChange?.(false)
      return
    }

    // Extract country code and number
    let countryCode = "+91"
    let phoneNumber = newValue

    for (const cc of countryCodes) {
      if (newValue.startsWith(cc.code)) {
        countryCode = cc.code
        phoneNumber = newValue.slice(cc.code.length)
        break
      }
    }

    if (validatePhone(phoneNumber, countryCode)) {
      setError(null)
      onValidChange?.(true)
    } else {
      setError("Invalid phone number")
      onValidChange?.(false)
    }
  }

  return (
    <div className={className}>
      <PhoneInput
        value={value}
        onChange={handleChange}
        defaultCountry={defaultCountry}
        disabled={disabled}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
