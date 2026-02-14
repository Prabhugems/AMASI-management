import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getApiUser } from "@/lib/auth/api-auth"

const BUCKET_NAME = "uploads"

async function ensureBucketExists(adminClient: any) {
  // Check if bucket already exists
  const { data: buckets } = await adminClient.storage.listBuckets()
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME)

  if (!exists) {
    console.log(`Bucket "${BUCKET_NAME}" not found, creating...`)
    const { error } = await adminClient.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 500 * 1024 * 1024, // 500MB (videos can be large)
    })
    if (error && !error.message?.includes("already exists")) {
      console.error("Bucket creation error:", error)
      throw new Error(`Failed to create storage bucket: ${error.message}`)
    }
    console.log(`Bucket "${BUCKET_NAME}" created successfully`)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const { user, error: authError } = await getApiUser()
    if (authError) return authError

    const formData = await request.formData()
    const file = formData.get("file") as File
    const eventId = formData.get("event_id") as string
    const type = formData.get("type") as string || "general"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!eventId) {
      return NextResponse.json({ error: "event_id is required" }, { status: 400 })
    }

    // Validate file size (max 50MB for Vercel serverless)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB" },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "video/mp4",
      "video/quicktime",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PDF, MP4, MOV, JPEG, PNG, GIF, WebP" },
        { status: 400 }
      )
    }

    const adminClient = await createAdminClient()

    // Ensure storage bucket exists before uploading
    await ensureBucketExists(adminClient)

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${eventId}/${type}/${timestamp}_${sanitizedName}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Supabase Storage
    const { error } = await (adminClient as any).storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = (adminClient as any).storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      filePath: fileName,
    })
  } catch (error: any) {
    console.error("Error in POST /api/upload:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
