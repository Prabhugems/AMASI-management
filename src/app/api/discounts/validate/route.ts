import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST - Validate a discount code
export async function POST(request: NextRequest) {
  // Rate limit: strict tier to prevent code enumeration
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "strict")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    const supabase = await createServerSupabaseClient()
    const body = await request.json()

    const { code, event_id, ticket_type_id, order_amount } = body

    if (!code || !event_id) {
      return NextResponse.json(
        { error: "code and event_id are required" },
        { status: 400 }
      )
    }

    // Find the discount code
    const { data: discount, error } = await (supabase as any)
      .from("discount_codes")
      .select("*")
      .eq("event_id", event_id)
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .maybeSingle()

    if (error || !discount) {
      return NextResponse.json(
        { valid: false, error: "Invalid discount code" },
        { status: 200 }
      )
    }

    // Check validity period
    const now = new Date()
    if (discount.valid_from && new Date(discount.valid_from) > now) {
      return NextResponse.json(
        { valid: false, error: "Discount code is not yet active" },
        { status: 200 }
      )
    }

    if (discount.valid_until && new Date(discount.valid_until) < now) {
      return NextResponse.json(
        { valid: false, error: "Discount code has expired" },
        { status: 200 }
      )
    }

    // Check usage limit
    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      return NextResponse.json(
        { valid: false, error: "Discount code usage limit reached" },
        { status: 200 }
      )
    }

    // Check minimum order amount
    if (discount.min_order_amount && order_amount && order_amount < discount.min_order_amount) {
      return NextResponse.json(
        { valid: false, error: `Minimum order amount is ₹${discount.min_order_amount}` },
        { status: 200 }
      )
    }

    // Check if applies to specific tickets
    if (discount.applies_to_ticket_ids && discount.applies_to_ticket_ids.length > 0 && ticket_type_id) {
      if (!discount.applies_to_ticket_ids.includes(ticket_type_id)) {
        return NextResponse.json(
          { valid: false, error: "Discount code does not apply to this ticket" },
          { status: 200 }
        )
      }
    }

    // Calculate discount
    let discountAmount = 0
    if (order_amount) {
      if (discount.discount_type === "percentage") {
        discountAmount = (order_amount * discount.discount_value) / 100
      } else {
        discountAmount = discount.discount_value
      }

      // Cap at max discount amount
      if (discount.max_discount_amount && discountAmount > discount.max_discount_amount) {
        discountAmount = discount.max_discount_amount
      }
    }

    return NextResponse.json({
      valid: true,
      discount: {
        id: discount.id,
        code: discount.code,
        type: discount.discount_type,
        value: discount.discount_value,
        calculated_discount: discountAmount,
        description: discount.description,
      },
    })
  } catch (_error: any) {
    return NextResponse.json({ error: "Failed to validate discount" }, { status: 500 })
  }
}
