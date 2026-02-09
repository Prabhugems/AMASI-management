import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export async function POST(request: NextRequest) {
  try {
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

    // Validate file size (max 300MB)
    const maxSize = 300 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 300MB" },
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

    const adminClient: SupabaseClient = await createAdminClient()

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${eventId}/${type}/${timestamp}_${sanitizedName}`

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Supabase Storage
    const { data, error } = await adminClient.storage
      .from("uploads")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Upload error:", error)

      // If bucket doesn't exist, create it
      if (error.message?.includes("not found")) {
        // Try to create the bucket
        const { error: bucketError } = await adminClient.storage.createBucket("uploads", {
          public: true,
          fileSizeLimit: 300 * 1024 * 1024, // 300MB
        })

        if (bucketError && !bucketError.message?.includes("already exists")) {
          console.error("Bucket creation error:", bucketError)
          return NextResponse.json(
            { error: "Failed to initialize storage" },
            { status: 500 }
          )
        }

        // Retry upload
        const { data: retryData, error: retryError } = await adminClient.storage
          .from("uploads")
          .upload(fileName, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (retryError) {
          console.error("Retry upload error:", retryError)
          return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
          )
        }

        // Get public URL
        const { data: urlData } = adminClient.storage
          .from("uploads")
          .getPublicUrl(fileName)

        return NextResponse.json({
          url: urlData.publicUrl,
          fileName: file.name,
          fileSize: file.size,
          filePath: fileName,
        })
      }

      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from("uploads")
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName: file.name,
      fileSize: file.size,
      filePath: fileName,
    })
  } catch (error) {
    console.error("Error in POST /api/upload:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
