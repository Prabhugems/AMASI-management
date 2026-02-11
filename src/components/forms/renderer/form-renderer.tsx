"use client"

import { useState, useMemo, useCallback } from "react"
import { Form, FormField, ConditionalLogic } from "@/lib/types"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import {
  Star,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarIcon,
  Check,
  X,
  ChevronRight,
  ShieldAlert,
  ExternalLink,
  BadgeCheck,
  User,
  Mail,
  Hash,
  Crown,
  Info,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface FormRendererProps {
  form: Form
  fields: FormField[]
  onSubmit: (responses: Record<string, unknown>, verifiedEmails?: Record<string, string>) => void
  isSubmitting?: boolean
  requireEmailVerification?: boolean
  initialValues?: Record<string, unknown>
  preVerifiedEmail?: string
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(email)
}

export function FormRenderer({ form, fields, onSubmit, isSubmitting, requireEmailVerification = true, initialValues, preVerifiedEmail }: FormRendererProps) {
  const [responses, setResponses] = useState<Record<string, unknown>>(initialValues || {})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({})
  const [fileNames, setFileNames] = useState<Record<string, string>>({})

  const [emailVerificationState, setEmailVerificationState] = useState<Record<string, {
    status: 'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'
    otp: string
    token?: string
    error?: string
    memberFound?: boolean
    memberData?: Record<string, unknown>
  }>>(() => {
    if (!preVerifiedEmail) return {}
    const emailField = fields.find(f => f.field_type === 'email')
    if (!emailField) return {}
    return { [emailField.id]: { status: 'verified' as const, otp: '', token: 'pre-verified' } }
  })

  const updateResponse = useCallback((fieldId: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
    if (emailVerificationState[fieldId]?.status === 'verified') {
      if (value !== responses[fieldId]) {
        setEmailVerificationState((prev) => ({
          ...prev,
          [fieldId]: { status: 'idle', otp: '' }
        }))
      }
    }
  }, [errors, emailVerificationState, responses])

  const sendEmailOTP = async (fieldId: string, email: string) => {
    if (!isValidEmail(email)) {
      setErrors((prev) => ({ ...prev, [fieldId]: "Please enter a valid email address" }))
      return
    }

    setEmailVerificationState((prev) => ({
      ...prev,
      [fieldId]: { status: 'sending', otp: '' }
    }))

    try {
      const response = await fetch('/api/email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, form_id: form.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setEmailVerificationState((prev) => ({
          ...prev,
          [fieldId]: { status: 'error', otp: '', error: data.error }
        }))
        toast.error(data.error)
        return
      }

      setEmailVerificationState((prev) => ({
        ...prev,
        [fieldId]: { status: 'sent', otp: '' }
      }))
      toast.success("Verification code sent to your email")

      if (data.dev_otp) {
        console.log(`[DEV] OTP: ${data.dev_otp}`)
        toast.info(`Dev OTP: ${data.dev_otp}`, { duration: 30000 })
      }
    } catch {
      setEmailVerificationState((prev) => ({
        ...prev,
        [fieldId]: { status: 'error', otp: '', error: 'Failed to send verification code' }
      }))
      toast.error("Failed to send verification code")
    }
  }

  const verifyEmailOTP = async (fieldId: string, email: string, otp: string) => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code")
      return
    }

    setEmailVerificationState((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], status: 'verifying' }
    }))

    try {
      const response = await fetch('/api/email/verify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, form_id: form.id })
      })

      const data = await response.json()

      if (!response.ok) {
        setEmailVerificationState((prev) => ({
          ...prev,
          [fieldId]: { ...prev[fieldId], status: 'sent', error: data.error }
        }))
        toast.error(data.error)
        return
      }

      setEmailVerificationState((prev) => ({
        ...prev,
        [fieldId]: { status: 'verified', otp: '', token: data.token }
      }))

      // Clear any error for this field
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })

      toast.success("Email verified successfully!")

      const emailField = fields.find(f => f.id === fieldId)
      console.log("[Email Verified] Field ID:", fieldId)
      console.log("[Email Verified] Email field settings:", emailField?.settings)
      console.log("[Email Verified] member_lookup enabled:", emailField?.settings?.member_lookup)

      // Always run member lookup for email fields (if settings exist or not)
      await lookupMember(email, fieldId)
    } catch {
      setEmailVerificationState((prev) => ({
        ...prev,
        [fieldId]: { ...prev[fieldId], status: 'sent', error: 'Failed to verify code' }
      }))
      toast.error("Failed to verify code")
    }
  }

  const lookupMember = async (email: string, emailFieldId: string) => {
    try {
      const response = await fetch(`/api/members/lookup?email=${encodeURIComponent(email)}`)
      if (!response.ok) {
        console.error("Member lookup API error:", response.status)
        return
      }
      const data = await response.json()

      // Find the "Are you member" field to auto-set it
      const memberQuestionField = fields.find(f => {
        const label = (f.label || "").toLowerCase()
        return label.includes("member of amasi") || label.includes("are you member") || label.includes("amasi member")
      })

      if (data.found && data.member) {
        const member = data.member

        // Store member data in verification state
        setEmailVerificationState(prev => ({
          ...prev,
          [emailFieldId]: {
            ...prev[emailFieldId],
            memberFound: true,
            memberData: member
          }
        }))

        // Auto-set "Are you member" to Yes (use lowercase to match option value)
        if (memberQuestionField) {
          // Find the "yes" option value (could be "Yes", "yes", "YES", etc.)
          const yesOption = memberQuestionField.options?.find(
            (opt: { value: string; label: string }) => (opt.value || "").toLowerCase() === 'yes' || (opt.label || "").toLowerCase() === 'yes'
          )
          const yesValue = yesOption?.value || 'yes'
          setResponses(prev => ({ ...prev, [memberQuestionField.id]: yesValue }))
        }

        // Order matters! More specific patterns should come first
        const fieldMappings: [string, string[]][] = [
          // Most specific first
          ["amasi_number", ["amasi membership number", "amasi number", "amasi membership", "membership number", "member id", "amasi id"]],
          ["membership_type", ["membership type", "member type"]],
          ["phone", ["phone number", "mobile number", "contact number", "phone", "mobile"]],
          // Name should be last since it's most generic
          ["name", ["full name", "your name", "member name", "name"]],
        ]

        let autoFilledCount = 0

        console.log("[Member Lookup] Member data:", member)
        console.log("[Member Lookup] Fields to match:", fields.map(f => f.label))

        fields.forEach(field => {
          const fieldLabel = (field.label || "").toLowerCase().trim()

          for (const [memberKey, matchLabels] of fieldMappings) {
            // Check if field label matches any of the patterns
            const isMatch = matchLabels.some(label => {
              // Exact match
              if (fieldLabel === label) {
                console.log(`[Match] "${fieldLabel}" === "${label}" for ${memberKey}`)
                return true
              }
              // Check if label appears as complete words (not in middle of another word)
              // For "amasi membership number" to match "membership number"
              if (fieldLabel.includes(label)) {
                console.log(`[Match] "${fieldLabel}" includes "${label}" for ${memberKey}`)
                return true
              }
              return false
            })

            if (isMatch) {
              const value = member[memberKey as keyof typeof member]
              console.log(`[AutoFill] Field "${field.label}" -> ${memberKey} = ${value}`)
              if (value !== undefined && value !== null) {
                setResponses(prev => ({ ...prev, [field.id]: String(value) }))
                autoFilledCount++
              }
              break
            }
          }
        })

        if (autoFilledCount > 0) {
          toast.success(`Member verified! ${autoFilledCount} field(s) auto-filled`, {
            description: `Welcome, ${member.name} (AMASI #${member.amasi_number})`,
            duration: 5000
          })
        } else {
          toast.success(`Member verified: ${member.name}`, {
            description: `AMASI #${member.amasi_number} - ${member.membership_type} Member`,
            duration: 5000
          })
        }

        if (!data.is_active) {
          toast.warning("Your membership status is not active", {
            description: "Please contact AMASI for membership renewal",
            duration: 8000
          })
        }
      } else {
        // Member NOT found in local database - don't auto-block
        // The member may exist in the main AMASI system but not yet synced
        setEmailVerificationState(prev => ({
          ...prev,
          [emailFieldId]: {
            ...prev[emailFieldId],
            memberFound: false,
            memberData: undefined
          }
        }))

        // Don't auto-set "Are you member" to No — let the user choose
        // They may be a member whose data isn't synced to this database yet
        toast.info("We couldn't automatically verify your membership", {
          description: "If you're an AMASI member, please select 'Yes' and enter your details manually",
          duration: 8000
        })
      }
    } catch (error) {
      console.error("Member lookup error:", error)
    }
  }

  const updateOTP = (fieldId: string, otp: string) => {
    const cleanOtp = otp.replace(/\D/g, '').slice(0, 6)
    setEmailVerificationState((prev) => ({
      ...prev,
      [fieldId]: { ...prev[fieldId], otp: cleanOtp }
    }))
  }

  const evaluateCondition = useCallback((logic: ConditionalLogic | undefined): boolean => {
    if (!logic || !logic.rules || logic.rules.length === 0) return true

    const results = logic.rules.map((rule) => {
      const fieldValue = responses[rule.field_id]

      switch (rule.operator) {
        case "equals":
          return fieldValue === rule.value
        case "not_equals":
          return fieldValue !== rule.value
        case "contains":
          return String(fieldValue || "").includes(String(rule.value))
        case "not_contains":
          return !String(fieldValue || "").includes(String(rule.value))
        case "is_empty":
          return !fieldValue || fieldValue === ""
        case "is_not_empty":
          return !!fieldValue && fieldValue !== ""
        case "greater_than":
          return Number(fieldValue) > Number(rule.value)
        case "less_than":
          return Number(fieldValue) < Number(rule.value)
        default:
          return true
      }
    })

    const match = logic.logic === "all" ? results.every((r) => r) : results.some((r) => r)
    return logic.action === "show" ? match : !match
  }, [responses])

  const visibleFields = useMemo(() => {
    return fields
      .sort((a, b) => a.sort_order - b.sort_order)
      .filter((field) => evaluateCondition(field.conditional_logic))
  }, [fields, evaluateCondition])

  const inputFields = useMemo(() => {
    return visibleFields.filter(f => !["heading", "paragraph", "divider"].includes(f.field_type))
  }, [visibleFields])

  // Check if this form requires AMASI membership
  const isMembershipRequired = useMemo(() => {
    // Use the is_member_form setting if set
    if (form.is_member_form !== undefined) {
      return form.is_member_form
    }
    // Fallback: check form name for backwards compatibility
    const formName = form.name?.toLowerCase() || ""
    return formName.includes("exam") || formName.includes("fmas skill") || formName.includes("skill course")
  }, [form.is_member_form, form.name])

  // Find the membership question field and check its value
  const membershipStatus = useMemo(() => {
    const memberQuestionField = fields.find(f => {
      const label = (f.label || "").toLowerCase()
      return label.includes("member of amasi") || label.includes("are you member") || label.includes("amasi member")
    })

    if (!memberQuestionField) return { fieldId: null, isNonMember: false }

    const value = String(responses[memberQuestionField.id] || "").toLowerCase()
    const isNonMember = value === "no"

    // Check if email verification found no member in local DB
    const emailVerified = Object.values(emailVerificationState).find(s => s.status === 'verified')
    const memberNotFound = emailVerified?.memberFound === false

    // Only block if user explicitly selected "No" for membership question
    // Don't block just because the member isn't in the local database —
    // they may exist in the main AMASI system but not be synced yet
    return {
      fieldId: memberQuestionField.id,
      isNonMember: isNonMember,
      memberNotFound
    }
  }, [fields, responses, emailVerificationState])

  // Check if strict membership mode is enabled (default true for backwards compat)
  const isStrictMembershipRequired = form.membership_required_strict !== false

  // Show membership required blocker only in strict mode
  const showMembershipBlocker = isMembershipRequired && isStrictMembershipRequired && membershipStatus.isNonMember

  // Show non-member notice (for non-strict mode like AMASICON where members get discounts)
  const showNonMemberNotice = isMembershipRequired && !isStrictMembershipRequired && membershipStatus.isNonMember

  // Check if email has been verified (for membership-required forms)
  const isEmailVerified = useMemo(() => {
    return Object.values(emailVerificationState).some(s => s.status === 'verified')
  }, [emailVerificationState])

  // For membership-required forms, only show email field until verified
  const showOnlyEmailFirst = isMembershipRequired && !isEmailVerified && !showMembershipBlocker

  // Get the verified email for display in blocker
  const verifiedEmail = useMemo(() => {
    const emailField = fields.find(f => f.field_type === 'email')
    if (emailField) {
      return String(responses[emailField.id] || "")
    }
    return ""
  }, [fields, responses])

  // Get verified member data and field IDs to hide (not just lock)
  const verifiedMember = useMemo(() => {
    const verifiedState = Object.values(emailVerificationState).find(
      s => s.status === 'verified' && s.memberFound === true && s.memberData
    )
    if (!verifiedState?.memberData) return null

    const member = verifiedState.memberData as {
      name?: string
      email?: string
      amasi_number?: string
      membership_type?: string
      phone?: string
    }

    // Find field IDs that should be HIDDEN (data comes from membership)
    const hiddenFieldIds: string[] = []

    fields.forEach(field => {
      const label = (field.label || "").toLowerCase().trim()

      // Hide "Are you member" question
      if (label.includes("member of amasi") || label.includes("are you member") || label.includes("amasi member")) {
        hiddenFieldIds.push(field.id)
      }
      // Hide email field
      if (field.field_type === 'email') {
        hiddenFieldIds.push(field.id)
      }
      // Hide name field
      if (label.includes("name") && !label.includes("bank") && !label.includes("account") && !label.includes("file")) {
        hiddenFieldIds.push(field.id)
      }
      // Hide phone field
      if (field.field_type === 'phone' || label.includes("phone") || label.includes("mobile")) {
        hiddenFieldIds.push(field.id)
      }
      // Hide AMASI membership number field
      if ((label.includes("amasi") && label.includes("number")) || label.includes("membership number")) {
        hiddenFieldIds.push(field.id)
      }
      // Hide membership type field
      if (label.includes("membership type")) {
        hiddenFieldIds.push(field.id)
      }
    })

    return {
      ...member,
      hiddenFieldIds
    }
  }, [emailVerificationState, fields])

  // Exclude hidden fields (member data fields) from progress count
  const displayedInputFields = useMemo(() => {
    // If showing only email first, only count email field
    if (isMembershipRequired && !Object.values(emailVerificationState).some(s => s.status === 'verified')) {
      return inputFields.filter(f => f.field_type === 'email')
    }
    if (!verifiedMember?.hiddenFieldIds) return inputFields
    return inputFields.filter(f => !verifiedMember.hiddenFieldIds.includes(f.id))
  }, [inputFields, verifiedMember, isMembershipRequired, emailVerificationState])

  const completedFields = useMemo(() => {
    return displayedInputFields.filter(field => {
      const value = responses[field.id]
      if (Array.isArray(value)) return value.length > 0
      return value !== undefined && value !== "" && value !== null
    }).length
  }, [displayedInputFields, responses])

  // Check if all required fields are completed (for button color)
  const isFormComplete = useMemo(() => {
    const requiredFields = displayedInputFields.filter(f => f.is_required)
    return requiredFields.every(field => {
      const value = responses[field.id]
      if (Array.isArray(value)) return value.length > 0
      if (value === undefined || value === "" || value === null) return false
      // Check email verification for required email fields
      if (field.field_type === 'email' && requireEmailVerification) {
        const verificationState = emailVerificationState[field.id]
        if (!verificationState || verificationState.status !== 'verified') return false
      }
      return true
    })
  }, [displayedInputFields, responses, emailVerificationState, requireEmailVerification])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    visibleFields.forEach((field) => {
      if (["heading", "paragraph", "divider"].includes(field.field_type)) return

      // Skip fields hidden by verified member data (they are auto-filled)
      if (verifiedMember?.hiddenFieldIds?.includes(field.id)) return

      const value = responses[field.id]
      const strValue = String(value || "")

      if (field.is_required && (!value || strValue.trim() === "")) {
        newErrors[field.id] = "This field is required"
        return
      }

      if (value) {
        if (field.min_length && strValue.length < field.min_length) {
          newErrors[field.id] = `Minimum ${field.min_length} characters required`
        }
        if (field.max_length && strValue.length > field.max_length) {
          newErrors[field.id] = `Maximum ${field.max_length} characters allowed`
        }
        if (field.min_value !== undefined && field.min_value !== null && Number(value) < field.min_value) {
          newErrors[field.id] = `Minimum value is ${field.min_value}`
        }
        if (field.max_value !== undefined && field.max_value !== null && Number(value) > field.max_value) {
          newErrors[field.id] = `Maximum value is ${field.max_value}`
        }
        if (field.pattern && !new RegExp(field.pattern).test(strValue)) {
          newErrors[field.id] = "Invalid format"
        }
        if (field.field_type === "email") {
          if (!isValidEmail(strValue)) {
            newErrors[field.id] = "Invalid email address"
          } else if (requireEmailVerification && field.is_required) {
            const verificationState = emailVerificationState[field.id]
            if (!verificationState || verificationState.status !== 'verified') {
              newErrors[field.id] = "Please verify your email address"
            }
          }
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      const verifiedEmails: Record<string, string> = {}
      Object.entries(emailVerificationState).forEach(([fieldId, state]) => {
        if (state.status === 'verified' && state.token) {
          verifiedEmails[fieldId] = state.token
        }
      })
      onSubmit(responses, verifiedEmails)
    }
  }

  const _primaryColor = form.primary_color || "#8B5CF6"

  const renderField = (field: FormField) => {
    const value = responses[field.id]
    const error = errors[field.id]
    const hasValue = value !== undefined && value !== "" && value !== null

    const inputClasses = cn(
      "h-12 px-4 border rounded-lg text-base transition-all",
      "focus:outline-none focus:ring-2 focus:ring-offset-0",
      "placeholder:text-gray-400",
      error
        ? "border-red-300 focus:border-red-500 focus:ring-red-100"
        : "border-gray-200 focus:border-emerald-500 focus:ring-emerald-100"
    )

    // Inline style to ensure white background and dark text
    const inputStyle: React.CSSProperties = {
      color: "#111827",
      backgroundColor: "#ffffff",
    }

    switch (field.field_type) {
      case "text":
        return (
          <Input
            type="text"
            placeholder={field.placeholder || "Enter your answer"}
            value={String(value || "")}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            className={inputClasses}
            style={inputStyle}
          />
        )

      case "phone":
        const showCountry = field.settings?.show_country
        const countryCode = field.settings?.default_country || "IN"
        const countryCodes: Record<string, { flag: string; code: string }> = {
          IN: { flag: "🇮🇳", code: "+91" },
          US: { flag: "🇺🇸", code: "+1" },
          GB: { flag: "🇬🇧", code: "+44" },
          AE: { flag: "🇦🇪", code: "+971" },
          SG: { flag: "🇸🇬", code: "+65" },
          AU: { flag: "🇦🇺", code: "+61" },
          CA: { flag: "🇨🇦", code: "+1" },
        }
        const selectedCountry = countryCodes[countryCode] || countryCodes.IN

        return (
          <div className="relative">
            {showCountry && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-gray-600 text-sm font-medium">
                <span>{selectedCountry.flag}</span>
                <span>{selectedCountry.code}</span>
              </div>
            )}
            <Input
              type="tel"
              placeholder={field.placeholder || "Phone number"}
              value={String(value || "")}
              onChange={(e) => updateResponse(field.id, e.target.value)}
              className={cn(inputClasses, showCountry && "pl-20")}
              style={inputStyle}
            />
          </div>
        )

      case "email":
        const emailValue = String(value || "")
        const emailState = emailVerificationState[field.id] || { status: 'idle', otp: '' }
        const isVerified = emailState.status === 'verified'
        const showOtpInput = emailState.status === 'sent' || emailState.status === 'verifying'
        const canSendOtp = emailValue && isValidEmail(emailValue) && !isVerified && emailState.status !== 'sending'

        return (
          <div className="space-y-3">
            <div className="relative">
              <Input
                type="email"
                placeholder={field.placeholder || "email@example.com"}
                value={emailValue}
                onChange={(e) => updateResponse(field.id, e.target.value)}
                className={cn(inputClasses, isVerified && "border-green-300 pr-10")}
                style={{ ...inputStyle, backgroundColor: isVerified ? "#f0fdf4" : "#ffffff" }}
                disabled={isVerified}
              />
              {isVerified && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              )}
            </div>

            {isVerified ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Email verified</span>
                </div>
                <button
                  type="button"
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                  onClick={() => {
                    setEmailVerificationState((prev) => ({
                      ...prev,
                      [field.id]: { status: 'idle', otp: '' }
                    }))
                    updateResponse(field.id, '')
                  }}
                >
                  Change
                </button>
              </div>
            ) : showOtpInput ? (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <p className="text-sm text-gray-600">
                  Enter the 6-digit code sent to <span className="font-medium">{emailValue}</span>
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={emailState.otp}
                    onChange={(e) => updateOTP(field.id, e.target.value)}
                    className="text-center tracking-widest font-mono text-lg h-12 flex-1 border-gray-200 focus:border-emerald-500 focus:ring-emerald-100"
                    style={{ backgroundColor: "#ffffff", color: "#111827" }}
                    maxLength={6}
                  />
                  <Button
                    type="button"
                    onClick={() => verifyEmailOTP(field.id, emailValue, emailState.otp)}
                    disabled={emailState.otp.length !== 6 || emailState.status === 'verifying'}
                    className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {emailState.status === 'verifying' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </div>
                <button
                  type="button"
                  className="text-sm text-gray-500 hover:text-gray-700"
                  onClick={() => sendEmailOTP(field.id, emailValue)}
                >
                  Didn&apos;t receive code? <span className="font-medium underline">Resend</span>
                </button>
              </div>
            ) : requireEmailVerification && field.is_required && emailValue ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => sendEmailOTP(field.id, emailValue)}
                disabled={!canSendOtp || emailState.status === 'sending'}
                className="w-full h-10 text-sm font-medium"
              >
                {emailState.status === 'sending' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Verify email
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            ) : null}

            {emailState.error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {emailState.error}
              </p>
            )}
          </div>
        )

      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder || "0"}
            value={value !== undefined ? String(value) : ""}
            onChange={(e) => updateResponse(field.id, e.target.value ? Number(e.target.value) : "")}
            min={field.min_value}
            max={field.max_value}
            className={inputClasses}
            style={inputStyle}
          />
        )

      case "textarea":
        return (
          <Textarea
            placeholder={field.placeholder || "Enter your answer"}
            value={String(value || "")}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            rows={4}
            className={cn(
              "px-4 py-3 border rounded-lg placeholder:text-gray-400 text-base transition-all resize-none",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "border-gray-200 focus:border-emerald-500 focus:ring-emerald-100"
            )}
            style={inputStyle}
          />
        )

      case "select":
        // Check if this is a "member" question field and if email has been verified
        const isMemberQuestion = (field.label || "").toLowerCase().includes("member of amasi") ||
                                  (field.label || "").toLowerCase().includes("are you member") ||
                                  (field.label || "").toLowerCase().includes("amasi member")
        const hasVerifiedEmail = Object.values(emailVerificationState).some(
          state => state.status === 'verified' && state.memberFound !== undefined
        )
        const isFieldLocked = isMemberQuestion && hasVerifiedEmail

        return (
          <div className="space-y-2">
            <Select
              value={String(value || "")}
              onValueChange={(v) => updateResponse(field.id, v)}
              disabled={isFieldLocked}
            >
              <SelectTrigger
                className={cn(inputClasses, "pr-10", isFieldLocked && "opacity-70 cursor-not-allowed")}
                style={{ ...inputStyle, backgroundColor: isFieldLocked ? "#f0fdf4" : "#ffffff" }}
              >
                <SelectValue placeholder={field.placeholder || "Select an option"} />
              </SelectTrigger>
              <SelectContent className="rounded-lg border border-gray-200 shadow-lg">
                {field.options?.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="py-2.5 px-3 cursor-pointer hover:bg-gray-50"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFieldLocked && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified from your email
              </p>
            )}
          </div>
        )

      case "multiselect":
      case "checkboxes":
        const selectedValues = Array.isArray(value) ? value : []
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => {
              const isSelected = selectedValues.includes(opt.value)
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    if (isSelected) {
                      updateResponse(field.id, selectedValues.filter((v: string) => v !== opt.value))
                    } else {
                      updateResponse(field.id, [...selectedValues, opt.value])
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "border-gray-400 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0",
                    isSelected ? "border-gray-800 bg-gray-800" : "border-gray-300"
                  )}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-gray-800">{opt.label}</span>
                </div>
              )
            })}
          </div>
        )

      case "checkbox":
        const isChecked = Boolean(value)
        return (
          <div
            onClick={() => updateResponse(field.id, !isChecked)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
              isChecked
                ? "border-gray-400 bg-gray-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0",
              isChecked ? "border-gray-800 bg-gray-800" : "border-gray-300"
            )}>
              {isChecked && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-gray-800">{field.placeholder || field.label}</span>
          </div>
        )

      case "radio":
        return (
          <div className="space-y-2">
            {field.options?.map((opt) => {
              const isSelected = String(value || "") === opt.value
              return (
                <div
                  key={opt.value}
                  onClick={() => updateResponse(field.id, opt.value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    isSelected
                      ? "border-gray-400 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0",
                    isSelected ? "border-gray-800" : "border-gray-300"
                  )}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />}
                  </div>
                  <span className="text-gray-800">{opt.label}</span>
                </div>
              )
            })}
          </div>
        )

      case "date":
        const dateValue = value ? new Date(value as string) : undefined
        return (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  inputClasses,
                  "w-full flex items-center justify-between"
                )}
                style={{ ...inputStyle, color: hasValue ? "#111827" : "#9ca3af" }}
              >
                <span>{dateValue ? format(dateValue, "MMMM d, yyyy") : "Select a date"}</span>
                <CalendarIcon className="w-4 h-4 text-gray-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-lg border border-gray-200 shadow-lg" align="start">
              <CalendarComponent
                mode="single"
                selected={dateValue}
                onSelect={(date) => {
                  if (date) {
                    updateResponse(field.id, format(date, "yyyy-MM-dd"))
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )

      case "time":
        return (
          <Input
            type="time"
            value={String(value || "")}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            className={inputClasses}
            style={inputStyle}
          />
        )

      case "datetime":
        const datetimeValue = value ? new Date(value as string) : undefined
        return (
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    inputClasses,
                    "flex-1 flex items-center justify-between"
                  )}
                  style={{ ...inputStyle, color: hasValue ? "#111827" : "#9ca3af" }}
                >
                  <span>{datetimeValue ? format(datetimeValue, "MMM d, yyyy") : "Select date"}</span>
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-lg border border-gray-200 shadow-lg" align="start">
                <CalendarComponent
                  mode="single"
                  selected={datetimeValue}
                  onSelect={(date) => {
                    if (date) {
                      const currentTime = datetimeValue ? format(datetimeValue, "HH:mm") : "12:00"
                      const [hours, minutes] = currentTime.split(":")
                      date.setHours(parseInt(hours), parseInt(minutes))
                      updateResponse(field.id, format(date, "yyyy-MM-dd'T'HH:mm"))
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={datetimeValue ? format(datetimeValue, "HH:mm") : ""}
              onChange={(e) => {
                const [hours, minutes] = e.target.value.split(":")
                const newDate = datetimeValue ? new Date(datetimeValue) : new Date()
                newDate.setHours(parseInt(hours), parseInt(minutes))
                updateResponse(field.id, format(newDate, "yyyy-MM-dd'T'HH:mm"))
              }}
              className={cn(inputClasses, "w-32")}
              style={inputStyle}
            />
          </div>
        )

      case "file":
        const allowMultiple = field.settings?.allow_multiple || false
        const maxFiles = field.settings?.max_files || 5
        const uploadedFiles = Array.isArray(value) ? value as { url: string; name: string }[] : value ? [{ url: value as string, name: fileNames[field.id] || 'File' }] : []
        const isUploading = uploadingFiles[field.id]
        const canUploadMore = allowMultiple ? uploadedFiles.length < maxFiles : uploadedFiles.length === 0

        return (
          <div className="space-y-3">
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file, idx) => {
                  const fileName = file.name || 'File'
                  return (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{fileName}</p>
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Uploaded
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (allowMultiple) {
                            const newFiles = uploadedFiles.filter((_, i) => i !== idx)
                            updateResponse(field.id, newFiles.length > 0 ? newFiles : null)
                          } else {
                            updateResponse(field.id, null)
                            setFileNames(prev => {
                              const newNames = { ...prev }
                              delete newNames[field.id]
                              return newNames
                            })
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {canUploadMore && (
              <div className="relative">
                <input
                  type="file"
                  id={`file-${field.id}`}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  accept={field.settings?.allowed_file_types?.map(t => `.${t}`).join(",")}
                  disabled={isUploading}
                  multiple={allowMultiple}
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return

                    const maxSize = field.settings?.max_file_size || 10
                    const filesToUpload = Array.from(files).slice(0, maxFiles - uploadedFiles.length)

                    setUploadingFiles(prev => ({ ...prev, [field.id]: true }))

                    const newlyUploaded: { url: string; name: string }[] = []

                    for (const file of filesToUpload) {
                      if (file.size > maxSize * 1024 * 1024) {
                        toast.error(`${file.name} is too large. Max size is ${maxSize}MB`)
                        continue
                      }

                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('form_id', form.id)
                        formData.append('field_id', field.id)

                        const response = await fetch('/api/forms/upload', {
                          method: 'POST',
                          body: formData,
                        })

                        if (!response.ok) {
                          const errorData = await response.json()
                          throw new Error(errorData.error || 'Failed to upload')
                        }

                        const data = await response.json()
                        newlyUploaded.push({ url: data.url, name: file.name })
                        toast.success(`${file.name} uploaded!`)
                      } catch {
                        toast.error(`Failed to upload ${file.name}`)
                      }
                    }

                    if (newlyUploaded.length > 0) {
                      if (allowMultiple) {
                        updateResponse(field.id, [...uploadedFiles, ...newlyUploaded])
                      } else {
                        updateResponse(field.id, newlyUploaded[0].url)
                        setFileNames(prev => ({ ...prev, [field.id]: newlyUploaded[0].name }))
                      }
                    }

                    setUploadingFiles(prev => ({ ...prev, [field.id]: false }))
                    e.target.value = ''
                  }}
                />
                <div className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isUploading ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                )}>
                  {isUploading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-600">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {uploadedFiles.length > 0 ? 'Add more files' : 'Click to upload'}
                      </span>
                      {allowMultiple && (
                        <span className="text-xs text-gray-400">{uploadedFiles.length}/{maxFiles} files</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      case "rating":
        const maxRating = field.settings?.max_rating || 5
        const currentRating = Number(value) || 0
        return (
          <div className="flex gap-1">
            {[...Array(maxRating)].map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => updateResponse(field.id, i + 1)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={cn(
                    "w-8 h-8 transition-colors",
                    i < currentRating ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"
                  )}
                />
              </button>
            ))}
          </div>
        )

      case "scale":
        const min = field.settings?.scale_min ?? 1
        const max = field.settings?.scale_max ?? 10
        const currentScale = Number(value) || null
        return (
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-gray-500">
              <span>{field.settings?.scale_min_label || min}</span>
              <span>{field.settings?.scale_max_label || max}</span>
            </div>
            <div className="flex gap-1">
              {[...Array(max - min + 1)].map((_, i) => {
                const scaleValue = min + i
                const isSelected = currentScale === scaleValue
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => updateResponse(field.id, scaleValue)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-medium rounded-md border transition-all",
                      isSelected
                        ? "border-gray-800 bg-gray-800 text-white"
                        : "border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                    )}
                  >
                    {scaleValue}
                  </button>
                )
              })}
            </div>
          </div>
        )

      case "heading":
        const HeadingTag = (field.settings?.heading_size || "h2") as keyof JSX.IntrinsicElements
        const headingSizeClasses: Record<string, string> = {
          h1: "text-2xl font-bold",
          h2: "text-xl font-semibold",
          h3: "text-lg font-medium",
        }
        return (
          <HeadingTag
            className={headingSizeClasses[field.settings?.heading_size || "h2"]}
            style={{
              color: field.settings?.label_color || "#111827",
              textAlign: field.settings?.label_alignment || "left",
              fontWeight: field.settings?.label_bold ? "800" : undefined,
              fontStyle: field.settings?.label_italic ? "italic" : undefined,
              textDecoration: field.settings?.label_underline ? "underline" : undefined,
            }}
          >
            {field.label}
          </HeadingTag>
        )

      case "paragraph":
        return (
          <p className="text-gray-600 leading-relaxed">{field.label}</p>
        )

      case "divider":
        const dividerColor = field.settings?.divider_color || "#e5e7eb"
        const dividerStyle = field.settings?.divider_style || "solid"
        const dividerThickness = field.settings?.divider_thickness || "thin"
        const thicknessMap = { thin: "1px", medium: "2px", thick: "4px" }

        return (
          <div className="py-2">
            <div
              className="w-full"
              style={{
                height: dividerStyle === "solid" ? thicknessMap[dividerThickness] : 0,
                backgroundColor: dividerStyle === "solid" ? dividerColor : "transparent",
                borderStyle: dividerStyle === "solid" ? "none" : dividerStyle,
                borderWidth: dividerStyle !== "solid" ? thicknessMap[dividerThickness] : 0,
                borderColor: dividerColor
              }}
            />
          </div>
        )

      default:
        return (
          <Input
            placeholder={field.placeholder || "Enter value"}
            value={String(value || "")}
            onChange={(e) => updateResponse(field.id, e.target.value)}
            className={inputClasses}
            style={inputStyle}
          />
        )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress - Hide when membership blocker is shown or when only showing email */}
      {!showMembershipBlocker && !showOnlyEmailFirst && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progress</span>
            <span className="text-gray-700 font-medium">{completedFields}/{displayedInputFields.length}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${displayedInputFields.length > 0 ? (completedFields / displayedInputFields.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Membership verification message - show when only email is visible */}
      {showOnlyEmailFirst && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Step 1:</strong> Please verify your email to confirm your AMASI membership.
            Only AMASI members can register for this exam.
          </p>
        </div>
      )}

      {/* Membership Required Blocker - Shows when non-member tries to register for exam */}
      {showMembershipBlocker && (
        <div className="p-6 bg-amber-50 border-2 border-amber-200 rounded-xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800">AMASI Membership Required</h3>
              <p className="text-amber-700 mt-1">
                AMASI membership is mandatory for FMAS Skill Course Exam registration.
              </p>
            </div>
          </div>

          {verifiedEmail && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">Email Verified: {verifiedEmail}</p>
                <p className="text-xs text-emerald-600">Your interest has been recorded. We'll notify you about membership updates.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-700">
              To register for this exam, you need to be an active AMASI member. Please apply for membership first and then return to complete your registration.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="https://application.amasi.org/application/user-member-application-list"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-colors shadow-lg"
              >
                Apply for AMASI Membership
                <ExternalLink className="w-4 h-4" />
              </a>
              <a
                href="https://amasi.org/skill-course/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                View Course Details
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Already a member?</strong> Make sure you verify with the same email registered with your AMASI membership. If you need help, contact <a href="mailto:support@amasi.org" className="underline">support@amasi.org</a>
            </p>
          </div>

          <a
            href="https://application.amasi.org/application/user-member-application-not-found"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-800 underline"
          >
            Know Your Membership Number
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Non-Member Notice - Shows for non-strict mode (e.g., AMASICON where members get discounts) */}
      {showNonMemberNotice && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-blue-800">Not an AMASI Member?</h3>
              <p className="text-sm text-blue-700 mt-1">
                You can still proceed with registration. However, AMASI members get special discounts on tickets!
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
            <p className="text-sm text-gray-600">
              Already a member? Verify with your registered email to get member pricing.
            </p>
            <a
              href="https://application.amasi.org/application/user-member-application-not-found"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 underline whitespace-nowrap"
            >
              Know Your Membership Number
            </a>
          </div>

          <a
            href="https://application.amasi.org/application/user-member-application-list"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Join AMASI to get member discounts
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Verified Member Card */}
      {verifiedMember && !showMembershipBlocker && (
        <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <BadgeCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-800">AMASI Member Verified</h3>
                <p className="text-sm text-emerald-600">Your membership has been confirmed</p>
              </div>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="font-semibold text-gray-900 truncate">{verifiedMember.name || "-"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Hash className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">AMASI Number</p>
                  <p className="font-mono font-bold text-emerald-700">{verifiedMember.amasi_number || "-"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="font-medium text-gray-900 truncate">{verifiedMember.email || "-"}</p>
                </div>
              </div>

              {verifiedMember.phone && (
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{verifiedMember.phone}</p>
                  </div>
                </div>
              )}

              {verifiedMember.membership_type && (
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Membership Type</p>
                    <p className="font-medium text-gray-900">{verifiedMember.membership_type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Details from your membership record
            </p>
            <a
              href="https://application.amasi.org/application/user-member-application-not-found"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 hover:text-emerald-800 underline"
            >
              Update my details
            </a>
          </div>
        </div>
      )}

      {/* Fields - Only show if membership is not required OR if member is verified */}
      {!showMembershipBlocker && visibleFields.map((field) => {
        // Hide fields that are populated from member data
        const isHiddenByMember = verifiedMember?.hiddenFieldIds?.includes(field.id)
        if (isHiddenByMember) return null

        // For membership-required forms, show only email field until verified
        if (showOnlyEmailFirst && field.field_type !== 'email') return null

        const isLayoutField = ["heading", "paragraph", "divider"].includes(field.field_type)

        if (isLayoutField) {
          return (
            <div key={field.id}>
              {renderField(field)}
            </div>
          )
        }

        return (
          <div key={field.id} className="space-y-2">
            <Label
              className="text-sm font-medium text-gray-700 flex items-center gap-1"
              style={{
                fontWeight: field.settings?.label_bold ? "700" : "500",
                fontStyle: field.settings?.label_italic ? "italic" : "normal",
                textDecoration: field.settings?.label_underline ? "underline" : "none",
                color: field.settings?.label_color || undefined
              }}
            >
              {field.label}
              {field.is_required && <span className="text-red-500">*</span>}
            </Label>
            {renderField(field)}
            {field.help_text && (
              <p className="text-sm text-gray-500">{field.help_text}</p>
            )}
            {errors[field.id] && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors[field.id]}
              </p>
            )}
          </div>
        )
      })}

      {/* Submit - Only show if not blocked by membership requirement and email is verified */}
      {!showMembershipBlocker && !showOnlyEmailFirst && (
        <div className="pt-4 space-y-3">
          <Button
            type="submit"
            disabled={isSubmitting || !isFormComplete}
            className={cn(
              "w-full h-12 text-base font-semibold text-white rounded-lg transition-all shadow-lg",
              isFormComplete
                ? "bg-emerald-600 hover:bg-emerald-700 hover:shadow-xl"
                : "bg-red-400 hover:bg-red-500 cursor-not-allowed opacity-90"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              form.submit_button_text || "Submit"
            )}
          </Button>

          {/* Status message */}
          {isFormComplete ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                Form completed! Ready to submit.
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-red-600">
                Please complete all required fields marked with *
              </span>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
