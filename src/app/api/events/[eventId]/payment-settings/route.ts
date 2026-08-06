import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireEventAccess } from "@/lib/auth/api-auth"
import { DEFAULT_PAYMENT_METHODS_ENABLED } from "@/lib/types/payment-methods"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabaseClient = await createAdminClient()
    const supabase = supabaseClient as any
    const body = await request.json()
    const {
      // Razorpay credentials
      razorpay_key_id,
      razorpay_key_secret,
      razorpay_webhook_secret,
      // Payment methods enabled
      payment_methods_enabled,
      // Bank transfer details
      bank_account_name,
      bank_account_number,
      bank_ifsc_code,
      bank_name,
      bank_branch,
      bank_upi_id,
    } = body

    // Update event with all payment settings
    const { error } = await supabase
      .from("events")
      .update({
        razorpay_key_id: razorpay_key_id || null,
        razorpay_key_secret: razorpay_key_secret || null,
        razorpay_webhook_secret: razorpay_webhook_secret || null,
        payment_methods_enabled: payment_methods_enabled || DEFAULT_PAYMENT_METHODS_ENABLED,
        bank_account_name: bank_account_name || null,
        bank_account_number: bank_account_number || null,
        bank_ifsc_code: bank_ifsc_code || null,
        bank_name: bank_name || null,
        bank_branch: bank_branch || null,
        bank_upi_id: bank_upi_id || null,
      } as any)
      .eq("id", eventId)

    if (error) {
      console.error("Failed to update payment settings:", error)
      return NextResponse.json(
        { error: "Failed to update payment settings" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Payment settings update error:", error)
    return NextResponse.json(
      { error: "Failed to update payment settings" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    const { error: authError } = await requireEventAccess(eventId)
    if (authError) return authError

    const supabaseClient = await createAdminClient()
    const supabase = supabaseClient as any

    const { data, error } = await supabase
      .from("events")
      .select(`
        razorpay_key_id,
        razorpay_key_secret,
        razorpay_webhook_secret,
        payment_methods_enabled,
        bank_account_name,
        bank_account_number,
        bank_ifsc_code,
        bank_name,
        bank_branch,
        bank_upi_id
      `)
      .eq("id", eventId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch payment settings" },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Payment settings fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment settings" },
      { status: 500 }
    )
  }
}
