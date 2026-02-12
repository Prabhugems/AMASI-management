"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Script from "next/script"
import {
  ArrowLeft,
  Package,
  Loader2,
  Plus,
  Minus,
  CheckCircle,
  AlertCircle,
  Shield,
  Ticket,
  MapPin,
} from "lucide-react"

interface Addon {
  id: string
  name: string
  description: string | null
  price: number
  max_quantity: number | null
  image_url: string | null
  has_variants: boolean
  variants?: AddonVariant[]
}

interface AddonVariant {
  id: string
  name: string
  price_adjustment: number
  is_available: boolean
}

interface SelectedAddon {
  addonId: string
  variantId?: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Registration {
  id: string
  registration_number: string
  attendee_name: string
  attendee_email: string
  ticket_type_id?: string
  ticket_type?: { id: string; name: string }
  event?: {
    id: string
    name: string
    short_name?: string
    start_date: string
    city?: string
  }
}

declare global {
  interface Window {
    Razorpay: any
  }
}

function PurchaseAddonsContent() {
  const searchParams = useSearchParams()
  const regNumber = searchParams.get("reg")
  const eventId = searchParams.get("event")

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedAddons, setSelectedAddons] = useState<Map<string, SelectedAddon>>(new Map())
  const [isProcessing, setIsProcessing] = useState(false)
  const [success, setSuccess] = useState(false)

  // Fetch registration and addons
  useEffect(() => {
    const fetchData = async () => {
      if (!regNumber || !eventId) {
        setError("Missing registration or event information")
        setLoading(false)
        return
      }

      try {
        // Fetch registration details
        const regRes = await fetch(`/api/my?q=${encodeURIComponent(regNumber)}`)
        const regData = await regRes.json()

        if (!regRes.ok || !regData.registrations?.length) {
          throw new Error("Registration not found")
        }

        const reg = regData.registrations.find((r: Registration) =>
          r.registration_number === regNumber && r.event?.id === eventId
        )

        if (!reg) {
          throw new Error("Registration not found for this event")
        }

        setRegistration(reg)

        // Fetch available addons (filtered by ticket type if applicable)
        const ticketTypeId = reg.ticket_type_id || reg.ticket_type?.id
        let addonsUrl = `/api/addons?event_id=${eventId}&active=true`
        if (ticketTypeId) {
          addonsUrl += `&ticket_type_id=${ticketTypeId}`
        }
        const addonsRes = await fetch(addonsUrl)
        const addonsData = await addonsRes.json()

        if (addonsRes.ok) {
          setAddons(addonsData.data || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [regNumber, eventId])

  const handleQuantityChange = (addon: Addon, delta: number, variantId?: string) => {
    const key = variantId ? `${addon.id}-${variantId}` : addon.id
    const newSelection = new Map(selectedAddons)

    const current = newSelection.get(key)
    const currentQty = current?.quantity || 0
    const newQty = Math.max(0, currentQty + delta)
    const maxQty = addon.max_quantity || 10

    if (newQty === 0) {
      newSelection.delete(key)
    } else if (newQty <= maxQty) {
      const variant = addon.variants?.find(v => v.id === variantId)
      const unitPrice = addon.price + (variant?.price_adjustment || 0)
      newSelection.set(key, {
        addonId: addon.id,
        variantId,
        quantity: newQty,
        unitPrice,
        totalPrice: unitPrice * newQty,
      })
    }

    setSelectedAddons(newSelection)
  }

  const totals = useMemo(() => {
    let subtotal = 0
    selectedAddons.forEach(addon => {
      subtotal += addon.totalPrice
    })
    const tax = Math.round(subtotal * 0.18) // 18% GST
    return {
      subtotal,
      tax,
      total: subtotal + tax,
      count: selectedAddons.size,
    }
  }, [selectedAddons])

  const handlePurchase = async () => {
    if (!registration || totals.count === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      // Convert selection to array
      const addonsArray: SelectedAddon[] = []
      selectedAddons.forEach(addon => addonsArray.push(addon))

      if (totals.total === 0) {
        // Free addons - add directly
        const res = await fetch(`/api/registrations/${registration.id}/addons`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addons: addonsArray }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to add addons")
        }

        setSuccess(true)
        return
      }

      // Create Razorpay order for paid addons
      const orderRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: totals.total,
          currency: "INR",
          payment_type: "addon_purchase",
          event_id: registration.event?.id,
          payer_name: registration.attendee_name,
          payer_email: registration.attendee_email,
          addons: addonsArray, // Must be at top level for API to read
          metadata: {
            registration_id: registration.id,
            registration_number: registration.registration_number,
          },
        }),
      })

      const orderData = await orderRes.json()

      if (!orderData.success) {
        throw new Error(orderData.error || "Failed to create order")
      }

      // Open Razorpay
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AMASI",
        description: `Add-ons for ${registration.registration_number}`,
        order_id: orderData.order_id,
        prefill: {
          name: registration.attendee_name,
          email: registration.attendee_email,
        },
        theme: { color: "#6366F1" },
        handler: async (response: any) => {
          // Verify payment - this also adds the addons automatically
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })

          const verifyData = await verifyRes.json()

          if (verifyData.success) {
            setSuccess(true)
          } else {
            setError(verifyData.error || "Payment verification failed. Please contact support.")
          }
          setIsProcessing(false)
        },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (err: any) {
      setError(err.message)
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  if (error && !registration) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href="/my"
            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Delegate Portal
          </a>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Add-ons Purchased!</h2>
          <p className="text-gray-600 mb-6">
            Your add-ons have been added to registration {registration?.registration_number}.
          </p>
          <a
            href="/my"
            className="inline-flex items-center justify-center gap-2 w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
          >
            Back to My Registrations
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-4 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Back Button */}
          <a
            href="/my"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Registrations
          </a>

          {/* Header */}
          <div className="bg-white rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Purchase Add-ons</h1>
                <p className="text-gray-600 text-sm">Add extras to your registration</p>
              </div>
            </div>

            {/* Registration Info */}
            {registration && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {registration.attendee_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{registration.attendee_name}</p>
                    <p className="text-sm text-gray-500">{registration.registration_number}</p>
                  </div>
                </div>
                {registration.event && (
                  <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Ticket className="w-4 h-4" />
                      {registration.event.short_name || registration.event.name}
                    </span>
                    {registration.event.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {registration.event.city}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Available Addons */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Available Add-ons</h2>
            </div>

            {addons.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No add-ons available for this event</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {addons.map(addon => (
                  <div key={addon.id} className="p-4">
                    <div className="flex items-start gap-4">
                      {addon.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={addon.image_url}
                          alt={addon.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{addon.name}</h3>
                        {addon.description && (
                          <p className="text-sm text-gray-600 mt-1">{addon.description}</p>
                        )}
                        <p className="text-indigo-600 font-semibold mt-2">
                          Rs.{addon.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>

                    {/* Variants or Direct Quantity */}
                    {addon.has_variants && addon.variants?.length ? (
                      <div className="mt-4 space-y-2">
                        {addon.variants.filter(v => v.is_available).map(variant => {
                          const key = `${addon.id}-${variant.id}`
                          const selected = selectedAddons.get(key)
                          const finalPrice = addon.price + variant.price_adjustment

                          return (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div>
                                <span className="font-medium">{variant.name}</span>
                                <span className="text-sm text-gray-500 ml-2">
                                  Rs.{finalPrice.toLocaleString("en-IN")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleQuantityChange(addon, -1, variant.id)}
                                  className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                                  disabled={!selected?.quantity}
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="w-8 text-center font-semibold">
                                  {selected?.quantity || 0}
                                </span>
                                <button
                                  onClick={() => handleQuantityChange(addon, 1, variant.id)}
                                  className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleQuantityChange(addon, -1)}
                          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                          disabled={!selectedAddons.get(addon.id)?.quantity}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">
                          {selectedAddons.get(addon.id)?.quantity || 0}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(addon, 1)}
                          className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order Summary & Checkout */}
          {totals.count > 0 && (
            <div className="bg-white rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>

              <div className="space-y-2 mb-4">
                {Array.from(selectedAddons.entries()).map(([key, item]) => {
                  const addon = addons.find(a => a.id === item.addonId)
                  const variant = addon?.variants?.find(v => v.id === item.variantId)
                  return (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {addon?.name}
                        {variant && ` (${variant.name})`}
                        {item.quantity > 1 && ` x${item.quantity}`}
                      </span>
                      <span className="font-medium">
                        Rs.{item.totalPrice.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>Rs.{totals.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">GST (18%)</span>
                  <span>Rs.{totals.tax.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-indigo-600">
                    Rs.{totals.total.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePurchase}
                disabled={isProcessing}
                className="w-full mt-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Pay Rs.{totals.total.toLocaleString("en-IN")}
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-3">
                Secure payment powered by Razorpay
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function PurchaseAddonsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <PurchaseAddonsContent />
    </Suspense>
  )
}
