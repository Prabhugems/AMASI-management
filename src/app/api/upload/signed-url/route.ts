import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const BUCKET_NAME = "uploads"

async function ensureBucketExists(adminClient: any) {
  const { data: buckets } = await adminClient.storage.listBuckets()
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME)

  if (!exists) {
    const { error } = await adminClient.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 500 * 1024 * 1024, // 500MB for videos
    })
    if (error && !error.message?.includes("already exists")) {
      throw new Error(`Failed to create storage bucket: ${error.message}`)
    }
  }
}

// POST /api/upload/signed-url - Get a signed upload URL for direct client upload
// This bypasses Vercel's 50MB API limit by having the client upload directly to Supabase Storage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_id, file_name, content_type, type } = body

    if (!event_id) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }
    if (!file_name) {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 })
    }

    // Authentication: require either a logged-in user or a valid event_id
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // For unauthenticated uploads (abstract submissions), verify the event exists
      const adminCheck = await createAdminClient()
      const { data: event } = await adminCheck
        .from("events")
        .select("id")
        .eq("id", event_id)
        .maybeSingle()
      if (!event) {
        return NextResponse.json({ error: "Invalid event" }, { status: 403 })
      }
    }

    // Validate content type
    const allowedTypes = [
      "application/pdf",
      "video/mp4",
      "video/quicktime",
      "image/jpeg",
      "image/png",
    ]
    if (content_type && !allowedTypes.includes(content_type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, MP4, MOV, JPEG, PNG" },
        { status: 400 }
      )
    }

    const adminClient = await createAdminClient()
    await ensureBucketExists(adminClient)

    // Generate unique file path
    const timestamp = Date.now()
    const sanitizedName = file_name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filePath = `${event_id}/${type || "abstract"}/${timestamp}_${sanitizedName}`

    // Create signed upload URL (valid for 10 minutes)
    const { data, error } = await (adminClient as any).storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error("Error creating signed URL:", error)
      return NextResponse.json(
        { error: "Failed to create upload URL" },
        { status: 500 }
      )
    }

    // Also get the public URL for after upload completes
    const { data: urlData } = (adminClient as any).storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path: filePath,
      publicUrl: urlData.publicUrl,
    })
  } catch (error: any) {
    console.error("Error in POST /api/upload/signed-url:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
