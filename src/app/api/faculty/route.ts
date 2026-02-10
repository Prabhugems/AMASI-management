import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { DEFAULTS } from '@/lib/config'

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please login to create faculty' },
        { status: 401 }
      )
    }

    // Use admin client for the operation (bypasses RLS)
    const supabase = await createAdminClient()

    const body = await request.json()

    const {
      title,
      name,
      email,
      phone,
      whatsapp,
      designation,
      department,
      institution,
      specialty,
      city,
      state,
      country,
      bio,
    } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Check if email already exists
    const { data: existing } = await (supabase as any)
      .from('faculty')
      .select('id, name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Faculty already exists with this email: ${(existing as any).name}` },
        { status: 409 }
      )
    }

    // Insert new faculty
    const { data, error } = await (supabase as any)
      .from('faculty')
      .insert({
        title: title || null,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || null,
        whatsapp: whatsapp || null,
        designation: designation || null,
        department: department || null,
        institution: institution || null,
        specialty: specialty || null,
        city: city || null,
        state: state || null,
        country: country || DEFAULTS.country,
        bio: bio || null,
        status: 'active',
        source: 'manual_add',
      })
      .select()
      .single()

    if (error) {
      console.error('Faculty insert error:', error)
      return NextResponse.json({ error: "Failed to create faculty" }, { status: 500 })
    }

    return NextResponse.json({ data, success: true })
  } catch (error) {
    console.error('Faculty API error:', error)
    return NextResponse.json(
      { error: 'Failed to create faculty' },
      { status: 500 }
    )
  }
}
