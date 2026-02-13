"use client"

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useTheme } from "next-themes"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import Script from "next/script"
import {
  ArrowLeft,
  User,
  Mail,
  Building,
  MapPin,
  Shield,
  Loader2,
  CheckCircle,
  Tag,
  Wallet,
  Building2,
  Banknote,
  Gift,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react"
import { FormRenderer } from "@/components/forms/renderer/form-renderer"
import { Form, FormField } from "@/lib/types"
import { usePageTracking } from "@/hooks/usePageTracking"

declare global {
  interface Window {
    Razorpay: any
  }
}

interface SelectedAddon {
  addonId: string
  variantId?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface CheckoutData {
  selection: { ticketId: string; quantity: number }[]
  addonsSelection?: SelectedAddon[]
  totals: { subtotal: number; tax: number; total: number; count: number; addonsTotal?: number }
}

type PaymentMethod = "razorpay" | "bank_transfer" | "cash" | "free"

interface PaymentMethodsEnabled {
  razorpay: boolean
  bank_transfer: boolean
  cash: boolean
  free: boolean
}

interface TicketType {
  id: string
  name: string
  price: number
  tax_percentage: number
  description?: string
  form_id?: string
}

export default function CheckoutPage() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [discountCode, setDiscountCode] = useState("")
  const [isValidatingDiscount, setIsValidatingDiscount] = useState(false)
  const [discountApplied, setDiscountApplied] = useState<{
    id: string
    amount: number
    code: string
  } | null>(null)
  const [discountError, setDiscountError] = useState("")
  const [error, setError] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  // Duplicate email state
  const [duplicateEmailInfo, setDuplicateEmailInfo] = useState<{
    hasExisting: boolean
    registrations: any[]
    allowDuplicate: boolean
    showWarning: boolean
  } | null>(null)
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const router = useRouter()
  const params = useParams()
  const eventSlug = params.eventSlug as string

  // Form state
  const [formData, setFormData] = useState({
    salutation: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    designation: "",
    institution: "",
    city: "",
    state: "",
    country: "India",
    dietary_preference: "",
    tshirt_size: "",
    special_requirements: "",
  })

  // Custom form responses (for ticket-specific forms)
  const [customFormResponses, setCustomFormResponses] = useState<Record<string, unknown>>({})
  const [customFormVerifiedEmails, setCustomFormVerifiedEmails] = useState<Record<string, string>>({})
  const [isCustomFormValid, setIsCustomFormValid] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const _isDark = mounted ? resolvedTheme === "dark" : false
  const supabase = createClient()

  // Get checkout data from session storage
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`checkout_${eventSlug}`)
    if (!stored) {
      router.push(`/register/${eventSlug}`)
      return
    }
    const data = JSON.parse(stored)
    setCheckoutData(data)
  }, [eventSlug, router])

  // Fetch event details
  const { data: event, isLoading } = useQuery({
    queryKey: ["checkout-event", eventSlug],
    queryFn: async () => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventSlug)

      let query = supabase
        .from("events")
        .select(`*, ticket_types (*)`)

      if (isUuid) {
        query = query.eq("id", eventSlug)
      } else {
        query = query.eq("slug", eventSlug)
      }

      const { data, error } = await query.maybeSingle()
      if (error) throw error

      return data as any
    },
    enabled: !!eventSlug,
  })

  // Track page view for analytics
  usePageTracking({ eventId: event?.id || "", pageType: "checkout" })

  // Fetch addons data for display
  const { data: addons } = useQuery({
    queryKey: ["checkout-addons", event?.id],
    queryFn: async () => {
      if (!event?.id) return []

      const { data, error } = await (supabase as any)
        .from("addons")
        .select(`
          *,
          variants:addon_variants(*)
        `)
        .eq("event_id", event.id)

      if (error) {
        console.error("Failed to fetch addons:", error)
        return []
      }

      return data || []
    },
    enabled: !!event?.id && (checkoutData?.addonsSelection?.length || 0) > 0,
  })

  // Calculate selected tickets with details
  const selectedTicketsDetails = useMemo(() => {
    if (!checkoutData || !event?.ticket_types) return []

    return checkoutData.selection
      .map((item) => {
        const ticket = event.ticket_types.find((t: TicketType) => t.id === item.ticketId)
        if (!ticket) return null
        const taxAmount = (ticket.price * ticket.tax_percentage) / 100
        return {
          ...ticket,
          quantity: item.quantity,
          subtotal: ticket.price * item.quantity,
          tax: taxAmount * item.quantity,
          total: (ticket.price + taxAmount) * item.quantity,
        }
      })
      .filter(Boolean)
  }, [checkoutData, event?.ticket_types])

  // Get first ticket's form_id (primary ticket)
  const primaryTicketFormId = useMemo(() => {
    if (!selectedTicketsDetails.length) return null
    return selectedTicketsDetails[0]?.form_id || null
  }, [selectedTicketsDetails])

  // Fetch ticket's custom form and fields
  const { data: ticketForm, isLoading: isLoadingForm } = useQuery({
    queryKey: ["ticket-form", primaryTicketFormId],
    queryFn: async () => {
      if (!primaryTicketFormId) return null

      // Fetch form
      const { data: form, error: formError } = await supabase
        .from("forms")
        .select("*")
        .eq("id", primaryTicketFormId)
        .eq("status", "published")
        .maybeSingle()

      if (formError || !form) return null

      // Fetch form fields
      const { data: fields, error: fieldsError } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", primaryTicketFormId)
        .order("sort_order")

      if (fieldsError) return null

      return {
        form: form as Form,
        fields: fields as FormField[],
      }
    },
    enabled: !!primaryTicketFormId,
  })

  const hasCustomForm = !!ticketForm?.form && !!ticketForm?.fields?.length

  // Get success redirect URL - use form's redirect_url if set, otherwise default success page
  const getSuccessUrl = (registrationNumber: string, email: string, method?: string) => {
    // Check if form has a custom redirect URL
    if (ticketForm?.form?.redirect_url) {
      const redirectUrl = new URL(ticketForm.form.redirect_url)
      // Optionally append registration info as query params
      redirectUrl.searchParams.set('reg', registrationNumber)
      redirectUrl.searchParams.set('email', email)
      if (method) redirectUrl.searchParams.set('method', method)
      return redirectUrl.toString()
    }
    // Default success page
    const baseUrl = `/register/success?reg=${registrationNumber}&email=${email}`
    return method ? `${baseUrl}&method=${method}` : baseUrl
  }

  // Calculate totals including addons with GST
  const totals = useMemo(() => {
    const subtotal = selectedTicketsDetails.reduce((acc, t) => acc + (t?.subtotal || 0), 0)
    const tax = selectedTicketsDetails.reduce((acc, t) => acc + (t?.tax || 0), 0)
    const discount = discountApplied?.amount || 0
    const addonsTotal = checkoutData?.addonsSelection?.reduce((acc, a) => acc + a.totalPrice, 0) || 0

    // Get tax percentage from first ticket (default 18%)
    const taxPercentage = selectedTicketsDetails[0]?.tax_percentage || 18
    const addonsTax = (addonsTotal * taxPercentage) / 100

    return {
      subtotal,
      tax,
      discount,
      addonsTotal,
      addonsTax,
      total: Math.max(0, subtotal + tax + addonsTotal + addonsTax - discount),
    }
  }, [selectedTicketsDetails, discountApplied, checkoutData?.addonsSelection])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Check for duplicate email registrations
  const checkDuplicateEmail = async (email: string) => {
    if (!email || !event?.id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDuplicateEmailInfo(null)
      return
    }

    setIsCheckingEmail(true)
    try {
      const res = await fetch("/api/registrations/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, event_id: event.id }),
      })
      const data = await res.json()

      if (res.ok) {
        setDuplicateEmailInfo({
          hasExisting: data.has_existing,
          registrations: data.registrations || [],
          allowDuplicate: data.allow_duplicate,
          showWarning: data.show_warning,
        })
      }
    } catch (err) {
      console.error("Error checking email:", err)
    } finally {
      setIsCheckingEmail(false)
    }
  }

  // Get enabled payment methods from event
  const paymentMethods = useMemo(() => {
    const defaultMethods: PaymentMethodsEnabled = { razorpay: true, bank_transfer: false, cash: false, free: true }
    return event?.payment_methods_enabled || defaultMethods
  }, [event])

  // Get available payment methods based on total
  const availablePaymentMethods = useMemo(() => {
    const methods: { key: PaymentMethod; label: string; icon: any; description: string }[] = []

    if (totals.total === 0) {
      if (paymentMethods.free) {
        methods.push({ key: "free", label: "Free Registration", icon: Gift, description: "No payment required" })
      }
      return methods
    }

    if (paymentMethods.razorpay) {
      methods.push({ key: "razorpay", label: "Pay Online", icon: Wallet, description: "Cards, UPI, Wallets, Net Banking" })
    }
    if (paymentMethods.bank_transfer) {
      methods.push({ key: "bank_transfer", label: "Bank Transfer", icon: Building2, description: "NEFT, IMPS, RTGS" })
    }
    if (paymentMethods.cash) {
      methods.push({ key: "cash", label: "Pay at Venue", icon: Banknote, description: "Cash payment on arrival" })
    }

    return methods
  }, [paymentMethods, totals.total])

  // Auto-select first payment method when available methods change
  useEffect(() => {
    if (availablePaymentMethods.length > 0) {
      // Reset selection if current selection is not in available methods
      const currentMethodAvailable = availablePaymentMethods.some(m => m.key === selectedPaymentMethod)
      if (!currentMethodAvailable) {
        setSelectedPaymentMethod(availablePaymentMethods[0].key)
      }
    }
  }, [availablePaymentMethods, selectedPaymentMethod])

  // Validate discount code
  const validateDiscountCode = async () => {
    if (!discountCode.trim()) return

    setIsValidatingDiscount(true)
    setDiscountError("")

    try {
      const response = await fetch("/api/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: discountCode,
          event_id: event?.id,
          ticket_type_id: selectedTicketsDetails[0]?.id,
          order_amount: totals.subtotal + totals.tax,
        }),
      })

      const data = await response.json()

      if (data.valid) {
        setDiscountApplied({
          id: data.discount.id,
          code: data.discount.code,
          amount: data.discount.calculated_discount,
        })
        setDiscountError("")
      } else {
        setDiscountError(data.error || "Invalid discount code")
        setDiscountApplied(null)
      }
    } catch (_err) {
      setDiscountError("Failed to validate discount code")
    } finally {
      setIsValidatingDiscount(false)
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const validateForm = (): boolean => {
    // If using custom form, check if form is valid
    if (hasCustomForm) {
      if (!isCustomFormValid) {
        setError("Please complete and submit the registration form above")
        return false
      }
      // Extract required info from custom form if not already set
      if (!formData.email.trim()) {
        setError("Email is required for registration")
        return false
      }
      // Check duplicate email restriction
      if (duplicateEmailInfo?.hasExisting && !duplicateEmailInfo.allowDuplicate) {
        setError("This email already has a registration. Please use the Delegate Portal to manage your existing registration or purchase add-ons.")
        return false
      }
      setError("")
      return true
    }

    // Default form validation
    if (!formData.first_name.trim()) {
      setError("First name is required")
      return false
    }
    if (!formData.last_name.trim()) {
      setError("Last name is required")
      return false
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Valid email is required")
      return false
    }
    if (!formData.phone.trim() || formData.phone.length < 10) {
      setError("Valid phone number is required")
      return false
    }
    // Check duplicate email restriction
    if (duplicateEmailInfo?.hasExisting && !duplicateEmailInfo.allowDuplicate) {
      setError("This email already has a registration. Please use the Delegate Portal to manage your existing registration or purchase add-ons.")
      return false
    }
    setError("")
    return true
  }

  // Create registrations for ALL selected tickets
  const createRegistration = async (paymentMethod: string, paymentId?: string) => {
    const attendeeName = formData.salutation
      ? `${formData.salutation} ${formData.first_name} ${formData.last_name}`
      : `${formData.first_name} ${formData.last_name}`

    // Prepare custom fields - include form responses if using custom form
    const customFields = hasCustomForm
      ? {
          ...customFormResponses,
          form_id: primaryTicketFormId,
          verified_emails: customFormVerifiedEmails,
        }
      : {
          salutation: formData.salutation,
          first_name: formData.first_name,
          last_name: formData.last_name,
          dietary_preference: formData.dietary_preference,
          tshirt_size: formData.tshirt_size,
          special_requirements: formData.special_requirements,
        }

    // Generate a common order ID to link all registrations
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Create a registration for EACH selected ticket type
    const registrations: any[] = []
    for (const ticket of selectedTicketsDetails) {
      const regResponse = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: event!.id,
          ticket_type_id: ticket?.id,
          attendee_name: attendeeName || formData.email.split('@')[0],
          attendee_email: formData.email,
          attendee_phone: formData.phone,
          attendee_institution: formData.institution,
          attendee_designation: formData.designation,
          attendee_city: formData.city,
          attendee_state: formData.state,
          attendee_country: formData.country,
          quantity: ticket?.quantity || 1,
          discount_code: registrations.length === 0 ? discountApplied?.code : null, // Apply discount only to first ticket
          payment_method: paymentMethod,
          payment_id: paymentId,
          // Pass selected addons only for the first ticket registration
          addons: registrations.length === 0 ? checkoutData?.addonsSelection : undefined,
          custom_fields: {
            ...customFields,
            order_id: orderId, // Link all registrations with same order ID
            ticket_index: registrations.length + 1,
            total_tickets_in_order: selectedTicketsDetails.length,
          },
        }),
      })

      const data = await regResponse.json()

      if (!regResponse.ok) {
        throw new Error(data.error || `Failed to create registration for ${ticket?.name}`)
      }

      registrations.push(data.data)
    }

    // Return the first registration (for success page), but all are created
    return registrations[0]
  }

  const handlePayment = async () => {
    if (!validateForm()) return
    if (!event) return
    if (!selectedPaymentMethod) {
      setError("Please select a payment method")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      // Handle FREE registration
      if (selectedPaymentMethod === "free" || totals.total === 0) {
        const registration = await createRegistration("free")
        sessionStorage.removeItem(`checkout_${eventSlug}`)
        router.push(getSuccessUrl(registration.registration_number, formData.email))
        return
      }

      // Handle CASH (Pay at Venue)
      if (selectedPaymentMethod === "cash") {
        const registration = await createRegistration("cash")
        sessionStorage.removeItem(`checkout_${eventSlug}`)
        router.push(getSuccessUrl(registration.registration_number, formData.email, "cash"))
        return
      }

      // Handle BANK TRANSFER
      if (selectedPaymentMethod === "bank_transfer") {
        const registration = await createRegistration("bank_transfer")
        sessionStorage.removeItem(`checkout_${eventSlug}`)
        router.push(getSuccessUrl(registration.registration_number, formData.email, "bank_transfer"))
        return
      }

      // Handle RAZORPAY
      const orderResponse = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totals.total, // Server will recalculate and validate
          currency: "INR",
          payment_type: "registration",
          event_id: event.id,
          payer_name: `${formData.first_name} ${formData.last_name}`,
          payer_email: formData.email,
          payer_phone: formData.phone,
          // Send tickets for server-side price validation
          tickets: selectedTicketsDetails.map(t => ({
            id: t.id,
            quantity: t.quantity,
          })),
          // Send addons for server-side price calculation
          addons: checkoutData?.addonsSelection,
          discount_code: discountApplied?.code,
          metadata: {
            tickets: selectedTicketsDetails,
            addons: checkoutData?.addonsSelection,
            totals,
          },
        }),
      })

      const orderData = await orderResponse.json()

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order")
      }

      // Initialize Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AMASI",
        description: `Registration for ${event.name}`,
        order_id: orderData.order_id,
        prefill: {
          name: `${formData.first_name} ${formData.last_name}`,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#8B5CF6",
        },
        handler: async (response: any) => {
          // Verify payment
          const verifyResponse = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })

          const verifyData = await verifyResponse.json()

          if (verifyData.success) {
            // Create registration after successful payment
            const registration = await createRegistration("razorpay", verifyData.payment_id)

            // Update registration with confirmed status
            await fetch(`/api/registrations/${registration.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: "confirmed",
                payment_status: "completed",
              }),
            })

            sessionStorage.removeItem(`checkout_${eventSlug}`)
            router.push(getSuccessUrl(registration.registration_number, formData.email))
          } else {
            setError("Payment verification failed. Please contact support.")
          }
        },
        modal: {
          ondismiss: () => {
            setIsSubmitting(false)
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err: any) {
      console.error("Payment error:", err)
      setError(err.message || "Payment failed. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (isLoading || !checkoutData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-1/3 rounded bg-secondary" />
            <div className="h-64 rounded-xl bg-secondary" />
          </div>
        </div>
      </div>
    )
  }

  // Check if registration is closed
  if (event?.registration_open === false) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration Closed</h1>
            <p className="text-gray-600 mb-6">
              Registration for this event is currently closed. Please check back later or contact the organizers for more information.
            </p>
            <Link
              href={`/register/${eventSlug}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Event
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputClassName = `
    w-full px-4 py-3 rounded-lg border transition-all duration-300
    bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-emerald-500
    focus:outline-none focus:ring-2 focus:ring-emerald-100
  `

  const labelClassName = "block text-sm font-medium mb-2 text-gray-700"

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          href={`/register/${eventSlug}`}
          className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-gray-600 transition-colors hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to event
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h1 className="text-2xl font-bold mb-6 text-gray-900">
                Complete Registration
              </h1>

              {error && (
                <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Custom Form from Ticket */}
              {isLoadingForm && primaryTicketFormId && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )}

              {hasCustomForm && ticketForm ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-gray-900">{ticketForm.form.name}</p>
                      <p className="text-sm text-gray-600">Please complete the form below</p>
                    </div>
                  </div>

                  <FormRenderer
                    form={ticketForm.form}
                    fields={ticketForm.fields}
                    onSubmit={(responses, verifiedEmails) => {
                      setCustomFormResponses(responses)
                      setCustomFormVerifiedEmails(verifiedEmails || {})
                      setIsCustomFormValid(true)
                      // Extract email and name from responses if available
                      const emailField = ticketForm.fields.find(f => f.field_type === 'email')
                      const nameField = ticketForm.fields.find(f => (f.label || "").toLowerCase().includes('name'))
                      const phoneField = ticketForm.fields.find(f => f.field_type === 'phone')

                      if (emailField && responses[emailField.id]) {
                        setFormData(prev => ({ ...prev, email: String(responses[emailField.id]) }))
                      }
                      if (nameField && responses[nameField.id]) {
                        const name = String(responses[nameField.id]).split(' ')
                        setFormData(prev => ({
                          ...prev,
                          first_name: name[0] || '',
                          last_name: name.slice(1).join(' ') || '',
                        }))
                      }
                      if (phoneField && responses[phoneField.id]) {
                        setFormData(prev => ({ ...prev, phone: String(responses[phoneField.id]) }))
                      }
                    }}
                    isSubmitting={false}
                    requireEmailVerification={true}
                  />

                  {isCustomFormValid && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium">Form completed! Proceed to payment below.</span>
                    </div>
                  )}
                </div>
              ) : !isLoadingForm && (
                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                    <User className="w-5 h-5 text-emerald-600" />
                    Personal Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClassName}>Salutation</label>
                      <select
                        name="salutation"
                        value={formData.salutation}
                        onChange={handleInputChange}
                        className={inputClassName}
                      >
                        <option value="">Select</option>
                        <option value="Dr.">Dr.</option>
                        <option value="Prof.">Prof.</option>
                        <option value="Mr.">Mr.</option>
                        <option value="Mrs.">Mrs.</option>
                        <option value="Ms.">Ms.</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClassName}>First Name *</label>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        placeholder="John"
                        className={inputClassName}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>Last Name *</label>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        placeholder="Doe"
                        className={inputClassName}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                    <Mail className="w-5 h-5 text-emerald-600" />
                    Contact Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassName}>Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        onBlur={(e) => checkDuplicateEmail(e.target.value)}
                        placeholder="john@example.com"
                        className={inputClassName}
                        required
                      />
                      {isCheckingEmail && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Checking...
                        </p>
                      )}
                      {duplicateEmailInfo?.hasExisting && duplicateEmailInfo.showWarning && (
                        <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-sm text-amber-800 font-medium mb-1">
                            You already have {duplicateEmailInfo.registrations.length} registration(s) for this event
                          </p>
                          {duplicateEmailInfo.allowDuplicate ? (
                            <p className="text-xs text-amber-700">
                              You can still register again, or{" "}
                              <a href="/my" className="underline font-medium">visit the Delegate Portal</a>{" "}
                              to manage your existing registration or purchase add-ons.
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs text-amber-700 mb-2">
                                Multiple registrations with the same email are not allowed for this event.
                              </p>
                              <a
                                href="/my"
                                className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 underline"
                              >
                                Go to Delegate Portal to manage your registration
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className={labelClassName}>Phone *</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+91 98765 43210"
                        className={inputClassName}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Professional Information */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                    <Building className="w-5 h-5 text-emerald-600" />
                    Professional Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassName}>Designation</label>
                      <input
                        type="text"
                        name="designation"
                        value={formData.designation}
                        onChange={handleInputChange}
                        placeholder="Senior Surgeon"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>Institution</label>
                      <input
                        type="text"
                        name="institution"
                        value={formData.institution}
                        onChange={handleInputChange}
                        placeholder="AIIMS Delhi"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    Location
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClassName}>City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="New Delhi"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>State</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        placeholder="Delhi"
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className={labelClassName}>Country</label>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        placeholder="India"
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900">
                    Additional Information
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClassName}>Dietary Preference</label>
                      <select
                        name="dietary_preference"
                        value={formData.dietary_preference}
                        onChange={handleInputChange}
                        className={inputClassName}
                      >
                        <option value="">Select</option>
                        <option value="vegetarian">Vegetarian</option>
                        <option value="non-vegetarian">Non-Vegetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="jain">Jain</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClassName}>T-Shirt Size</label>
                      <select
                        name="tshirt_size"
                        value={formData.tshirt_size}
                        onChange={handleInputChange}
                        className={inputClassName}
                      >
                        <option value="">Select</option>
                        <option value="S">Small (S)</option>
                        <option value="M">Medium (M)</option>
                        <option value="L">Large (L)</option>
                        <option value="XL">Extra Large (XL)</option>
                        <option value="XXL">XXL</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={labelClassName}>Special Requirements</label>
                    <textarea
                      name="special_requirements"
                      value={formData.special_requirements}
                      onChange={handleInputChange}
                      placeholder="Any special requirements or notes..."
                      rows={3}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </form>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm sticky top-24 overflow-hidden">
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">
                  Order Summary
                </h3>
                <p className="text-sm text-gray-600">
                  {event?.name}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Selected Tickets */}
                {selectedTicketsDetails.map((ticket: any) => (
                  <div key={ticket.id} className="flex justify-between text-sm">
                    <div>
                      <p className="text-gray-900">
                        {ticket.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        ₹{ticket.price.toLocaleString()} × {ticket.quantity}
                      </p>
                    </div>
                    <span className="font-medium text-gray-900">
                      ₹{ticket.subtotal.toLocaleString()}
                    </span>
                  </div>
                ))}

                {/* Selected Addons */}
                {checkoutData?.addonsSelection && checkoutData.addonsSelection.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Add-ons</p>
                    </div>
                    {checkoutData.addonsSelection.map((addon, idx) => {
                      const addonData = addons?.find((a: any) => a.id === addon.addonId)
                      const variant = addonData?.variants?.find((v: any) => v.id === addon.variantId)
                      return (
                        <div key={idx} className="flex justify-between text-sm">
                          <div>
                            <p className="text-gray-900">
                              {addonData?.name || "Add-on"}
                              {variant && ` (${variant.name})`}
                            </p>
                            <p className="text-xs text-gray-500">
                              ₹{addon.unitPrice.toLocaleString()} × {addon.quantity}
                            </p>
                          </div>
                          <span className="font-medium text-gray-900">
                            ₹{addon.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Discount Code - Only show when enabled in event settings */}
                {event?.discount_enabled && (
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Discount code"
                          value={discountCode}
                          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                          className="w-full pl-10 pr-4 py-2 rounded-lg text-sm bg-white border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500"
                        />
                      </div>
                      <button
                        onClick={validateDiscountCode}
                        disabled={isValidatingDiscount || !discountCode.trim()}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:bg-gray-300"
                      >
                        {isValidatingDiscount ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </button>
                    </div>
                    {discountApplied && (
                      <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Discount applied: -₹{discountApplied.amount.toLocaleString()}
                      </p>
                    )}
                    {discountError && (
                      <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {discountError}
                      </p>
                    )}
                  </div>
                )}

                {/* Totals */}
                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tickets Subtotal</span>
                    <span className="text-gray-900">
                      ₹{totals.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tickets GST</span>
                    <span className="text-gray-900">
                      ₹{totals.tax.toLocaleString()}
                    </span>
                  </div>
                  {totals.addonsTotal > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Add-ons Subtotal</span>
                        <span className="text-gray-900">
                          ₹{totals.addonsTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Add-ons GST</span>
                        <span className="text-gray-900">
                          ₹{totals.addonsTax.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">Discount</span>
                      <span className="text-green-600">-₹{totals.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200">
                    <span className="text-gray-900">Total</span>
                    <span className="text-emerald-600">₹{totals.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              {availablePaymentMethods.length > 1 && (
                <div className="p-5 border-t border-gray-200">
                  <h4 className="text-sm font-medium mb-3 text-gray-900">
                    Payment Method
                  </h4>
                  <div className="space-y-2">
                    {availablePaymentMethods.map((method) => (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.key)}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all
                          ${selectedPaymentMethod === method.key
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 hover:border-gray-300"
                          }
                        `}
                      >
                        <method.icon className={`w-5 h-5 ${selectedPaymentMethod === method.key ? "text-emerald-600" : "text-gray-400"}`} />
                        <div className="text-left flex-1">
                          <p className={`text-sm font-medium ${selectedPaymentMethod === method.key ? "text-emerald-700" : "text-gray-900"}`}>
                            {method.label}
                          </p>
                          <p className="text-xs text-gray-500">
                            {method.description}
                          </p>
                        </div>
                        {selectedPaymentMethod === method.key && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Transfer Details */}
              {selectedPaymentMethod === "bank_transfer" && event?.bank_account_number && (
                <div className="p-5 border-t border-gray-200 bg-gray-50">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-gray-900">
                    <Building2 className="w-4 h-4" />
                    Bank Transfer Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    {event?.bank_account_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Account Name</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{event.bank_account_name}</span>
                          <button onClick={() => copyToClipboard(event.bank_account_name, "name")} className="text-emerald-600 hover:text-emerald-700">
                            {copiedField === "name" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Account No.</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900">{event.bank_account_number}</span>
                        <button onClick={() => copyToClipboard(event.bank_account_number, "account")} className="text-emerald-600 hover:text-emerald-700">
                          {copiedField === "account" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {event?.bank_ifsc_code && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">IFSC Code</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-gray-900">{event.bank_ifsc_code}</span>
                          <button onClick={() => copyToClipboard(event.bank_ifsc_code, "ifsc")} className="text-emerald-600 hover:text-emerald-700">
                            {copiedField === "ifsc" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {event?.bank_name && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Bank</span>
                        <span className="font-medium text-gray-900">{event.bank_name}</span>
                      </div>
                    )}
                    {event?.bank_upi_id && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">UPI ID</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-gray-900">{event.bank_upi_id}</span>
                          <button onClick={() => copyToClipboard(event.bank_upi_id, "upi")} className="text-emerald-600 hover:text-emerald-700">
                            {copiedField === "upi" ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs mt-3 text-gray-500">
                    After transfer, your registration will be confirmed within 24-48 hours
                  </p>
                </div>
              )}

              {/* Pay Button */}
              <div className="p-5 pt-0">
                {/* Button only active after form is complete */}
                {(() => {
                  const isFormComplete = hasCustomForm ? isCustomFormValid : (formData.email && formData.first_name && formData.last_name)
                  const isButtonDisabled = isSubmitting || !selectedPaymentMethod || !isFormComplete
                  return (
                <button
                  onClick={handlePayment}
                  disabled={isButtonDisabled}
                  className={`
                    w-full py-4 rounded-xl font-bold text-white
                    flex items-center justify-center gap-2
                    transition-all duration-300
                    ${isButtonDisabled
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    }
                  `}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : selectedPaymentMethod === "free" || totals.total === 0 ? (
                    <>
                      <Gift className="w-5 h-5" />
                      Complete Free Registration
                    </>
                  ) : selectedPaymentMethod === "cash" ? (
                    <>
                      <Banknote className="w-5 h-5" />
                      Reserve Spot (Pay at Venue)
                    </>
                  ) : selectedPaymentMethod === "bank_transfer" ? (
                    <>
                      <Building2 className="w-5 h-5" />
                      Register & Pay via Bank Transfer
                    </>
                  ) : (
                    <>
                      <Shield className="w-5 h-5" />
                      Pay ₹{totals.total.toLocaleString()}
                    </>
                  )}
                </button>
                  )
                })()}
                {(() => {
                  const isFormComplete = hasCustomForm ? isCustomFormValid : (formData.email && formData.first_name && formData.last_name)
                  if (!isFormComplete) {
                    return (
                      <p className="text-center text-xs mt-3 text-amber-600 font-medium">
                        Please complete the form above to proceed
                      </p>
                    )
                  }
                  return (
                    <p className="text-center text-xs mt-3 text-gray-500">
                      {selectedPaymentMethod === "razorpay" && "Secure payment powered by Razorpay"}
                      {selectedPaymentMethod === "bank_transfer" && "Transfer amount shown above to complete registration"}
                      {selectedPaymentMethod === "cash" && "Payment will be collected at the venue"}
                      {(selectedPaymentMethod === "free" || totals.total === 0) && "No payment required for this registration"}
                    </p>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
