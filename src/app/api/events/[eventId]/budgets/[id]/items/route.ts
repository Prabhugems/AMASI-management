import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/api-auth"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user: _user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("budget_items")
      .select("*")
      .eq("budget_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching budget items:", error)
      return NextResponse.json({ error: "Failed to fetch budget items" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin()
    if (authError) return authError

    const { id } = await params
    const body = await request.json()

    const {
      item_name, description, vendor, amount, quantity,
      receipt_url, invoice_number, paid_date, payment_method,
      status: itemStatus, notes,
    } = body

    if (!item_name) {
      return NextResponse.json({ error: "Item name is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data, error } = await db
      .from("budget_items")
      .insert({
        budget_id: id,
        item_name,
        description: description || null,
        vendor: vendor || null,
        amount: amount ?? 0,
        quantity: quantity ?? 1,
        receipt_url: receipt_url || null,
        invoice_number: invoice_number || null,
        paid_date: paid_date || null,
        payment_method: payment_method || null,
        status: itemStatus || "pending",
        notes: notes || null,
        created_by: user?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating budget item:", error)
      return NextResponse.json({ error: "Failed to create budget item" }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
