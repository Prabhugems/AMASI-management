"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Banknote,
  Wallet,
  Gift,
  Building2,
  ChevronLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function PaymentSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Payment settings state
  const [showSecrets, setShowSecrets] = useState(false)
  const [showBankDetails, setShowBankDetails] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState({
    // Razorpay credentials
    razorpay_key_id: "",
    razorpay_key_secret: "",
    razorpay_webhook_secret: "",
    // Payment methods enabled
    payment_methods_enabled: {
      razorpay: true,
      bank_transfer: false,
      cash: false,
      free: true,
    },
    // Bank transfer details
    bank_account_name: "",
    bank_account_number: "",
    bank_ifsc_code: "",
    bank_name: "",
    bank_branch: "",
    bank_upi_id: "",
  })
  const [paymentSettingsLoaded, setPaymentSettingsLoaded] = useState(false)

  type EventData = {
    id: string
    name: string
    short_name: string | null
    razorpay_key_id: string | null
    razorpay_key_secret: string | null
    razorpay_webhook_secret: string | null
    payment_methods_enabled: any
    bank_account_name: string | null
    bank_account_number: string | null
    bank_ifsc_code: string | null
    bank_name: string | null
    bank_branch: string | null
    bank_upi_id: string | null
  }

  // Fetch event details for payment settings
  const { data: event, isLoading } = useQuery({
    queryKey: ["event-payment-settings", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, short_name, razorpay_key_id, razorpay_key_secret, razorpay_webhook_secret, payment_methods_enabled, bank_account_name, bank_account_number, bank_ifsc_code, bank_name, bank_branch, bank_upi_id")
        .eq("id", eventId)
        .maybeSingle()

      if (error) throw error

      // Load payment settings into state (only once)
      if (data && !paymentSettingsLoaded) {
        const eventData = data as EventData
        const defaultMethods = { razorpay: true, bank_transfer: false, cash: false, free: true }
        setPaymentSettings({
          razorpay_key_id: eventData.razorpay_key_id || "",
          razorpay_key_secret: eventData.razorpay_key_secret || "",
          razorpay_webhook_secret: eventData.razorpay_webhook_secret || "",
          payment_methods_enabled: eventData.payment_methods_enabled || defaultMethods,
          bank_account_name: eventData.bank_account_name || "",
          bank_account_number: eventData.bank_account_number || "",
          bank_ifsc_code: eventData.bank_ifsc_code || "",
          bank_name: eventData.bank_name || "",
          bank_branch: eventData.bank_branch || "",
          bank_upi_id: eventData.bank_upi_id || "",
        })
        setShowBankDetails(eventData.payment_methods_enabled?.bank_transfer || false)
        setPaymentSettingsLoaded(true)
      }

      return (data ?? null) as EventData | null
    },
    enabled: !!eventId,
  })

  // Save payment settings mutation
  const savePaymentSettings = useMutation({
    mutationFn: async (settings: typeof paymentSettings) => {
      const response = await fetch(`/api/events/${eventId}/payment-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!response.ok) {
        throw new Error("Failed to save payment settings")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-payment-settings", eventId] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Payment Settings</h1>
        <p className="text-muted-foreground">
          Configure payment methods and credentials for {event?.name || "this event"}
        </p>
      </div>

      {/* Payment Settings Card */}
      <div className="paper-card card-animated">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h5 className="text-base font-semibold text-foreground">
                Payment Methods
              </h5>
              <p className="text-sm text-muted-foreground">
                Enable or disable payment options for attendees
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSecrets(!showSecrets)}
          >
            {showSecrets ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="p-5 space-y-6">
          {/* Payment Methods Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              Enabled Payment Methods
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Razorpay */}
              <button
                type="button"
                onClick={() =>
                  setPaymentSettings({
                    ...paymentSettings,
                    payment_methods_enabled: {
                      ...paymentSettings.payment_methods_enabled,
                      razorpay: !paymentSettings.payment_methods_enabled.razorpay,
                    },
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  paymentSettings.payment_methods_enabled.razorpay
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Wallet className={cn(
                  "h-6 w-6",
                  paymentSettings.payment_methods_enabled.razorpay ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  paymentSettings.payment_methods_enabled.razorpay ? "text-primary" : "text-muted-foreground"
                )}>
                  Razorpay
                </span>
                <span className="text-xs text-muted-foreground">Cards, UPI, Wallets</span>
              </button>

              {/* Bank Transfer */}
              <button
                type="button"
                onClick={() => {
                  const newValue = !paymentSettings.payment_methods_enabled.bank_transfer
                  setPaymentSettings({
                    ...paymentSettings,
                    payment_methods_enabled: {
                      ...paymentSettings.payment_methods_enabled,
                      bank_transfer: newValue,
                    },
                  })
                  setShowBankDetails(newValue)
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  paymentSettings.payment_methods_enabled.bank_transfer
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Building2 className={cn(
                  "h-6 w-6",
                  paymentSettings.payment_methods_enabled.bank_transfer ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  paymentSettings.payment_methods_enabled.bank_transfer ? "text-primary" : "text-muted-foreground"
                )}>
                  Bank Transfer
                </span>
                <span className="text-xs text-muted-foreground">NEFT, IMPS, RTGS</span>
              </button>

              {/* Cash */}
              <button
                type="button"
                onClick={() =>
                  setPaymentSettings({
                    ...paymentSettings,
                    payment_methods_enabled: {
                      ...paymentSettings.payment_methods_enabled,
                      cash: !paymentSettings.payment_methods_enabled.cash,
                    },
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  paymentSettings.payment_methods_enabled.cash
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Banknote className={cn(
                  "h-6 w-6",
                  paymentSettings.payment_methods_enabled.cash ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  paymentSettings.payment_methods_enabled.cash ? "text-primary" : "text-muted-foreground"
                )}>
                  Cash
                </span>
                <span className="text-xs text-muted-foreground">Pay at Venue</span>
              </button>

              {/* Free */}
              <button
                type="button"
                onClick={() =>
                  setPaymentSettings({
                    ...paymentSettings,
                    payment_methods_enabled: {
                      ...paymentSettings.payment_methods_enabled,
                      free: !paymentSettings.payment_methods_enabled.free,
                    },
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  paymentSettings.payment_methods_enabled.free
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <Gift className={cn(
                  "h-6 w-6",
                  paymentSettings.payment_methods_enabled.free ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-sm font-medium",
                  paymentSettings.payment_methods_enabled.free ? "text-primary" : "text-muted-foreground"
                )}>
                  Free
                </span>
                <span className="text-xs text-muted-foreground">No Payment</span>
              </button>
            </div>
          </div>

          {/* Bank Transfer Details (shown when enabled) */}
          {showBankDetails && (
            <div className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h6 className="font-medium text-foreground">Bank Transfer Details</h6>
              </div>
              <p className="text-sm text-muted-foreground">
                These details will be shown to attendees who choose bank transfer
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Account Holder Name</label>
                  <Input
                    placeholder="AMASI Conference Fund"
                    value={paymentSettings.bank_account_name}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Bank Name</label>
                  <Input
                    placeholder="State Bank of India"
                    value={paymentSettings.bank_name}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Account Number</label>
                  <Input
                    placeholder="1234567890123456"
                    value={paymentSettings.bank_account_number}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">IFSC Code</label>
                  <Input
                    placeholder="SBIN0001234"
                    value={paymentSettings.bank_ifsc_code}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_ifsc_code: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Branch</label>
                  <Input
                    placeholder="Chennai Main Branch"
                    value={paymentSettings.bank_branch}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_branch: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">UPI ID (Optional)</label>
                  <Input
                    placeholder="amasi@sbi"
                    value={paymentSettings.bank_upi_id}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_upi_id: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Razorpay Credentials (shown when Razorpay enabled) */}
          {paymentSettings.payment_methods_enabled.razorpay && (
            <div className="space-y-4 p-4 rounded-xl bg-secondary/30 border border-border">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h6 className="font-medium text-foreground">Razorpay Credentials</h6>
                <span className="text-xs text-muted-foreground">(Optional - uses default if empty)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Key ID</label>
                  <Input
                    type="text"
                    placeholder="rzp_live_xxxxxxxxxxxx"
                    value={paymentSettings.razorpay_key_id}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpay_key_id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Key Secret</label>
                  <Input
                    type={showSecrets ? "text" : "password"}
                    placeholder="••••••••••••••••"
                    value={paymentSettings.razorpay_key_secret}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpay_key_secret: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Webhook Secret</label>
                <Input
                  type={showSecrets ? "text" : "password"}
                  placeholder="••••••••••••••••"
                  value={paymentSettings.razorpay_webhook_secret}
                  onChange={(e) => setPaymentSettings({ ...paymentSettings, razorpay_webhook_secret: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => savePaymentSettings.mutate(paymentSettings)}
              disabled={savePaymentSettings.isPending}
            >
              {savePaymentSettings.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Payment Settings
                </>
              )}
            </Button>
          </div>

          {savePaymentSettings.isSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Payment settings saved successfully!</span>
            </div>
          )}

          {savePaymentSettings.isError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Failed to save settings. Please try again.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
