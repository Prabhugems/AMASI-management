import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Create admin client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).trim()
)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
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
        payment_methods_enabled: payment_methods_enabled || {
          razorpay: true,
          bank_transfer: false,
          cash: false,
          free: true,
        },
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
