import { createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// POST /api/submit-abstract/[eventId]/upload - Upload abstract attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Rate limit check for public endpoint
    const ip = getClientIp(request)
    const rateLimitResult = checkRateLimit(ip, "public")
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult)

    const { eventId } = await params

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const email = formData.get("email") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Get settings to validate file
    const { data: settings } = await (supabase as any)
      .from("abstract_settings")
      .select("allowed_file_types, max_file_size_mb")
      .eq("event_id", eventId)
      .single()

    // Validate file type
    const allowedTypes = settings?.allowed_file_types || ["pdf"]
    const fileExtension = file.name.split(".").pop()?.toLowerCase()

    if (!fileExtension || !allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted: ${allowedTypes.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate file size
    const maxSizeMB = settings?.max_file_size_mb || 5
    const maxSizeBytes = maxSizeMB * 1024 * 1024

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `File size exceeds ${maxSizeMB}MB limit` },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, "_")
    const fileName = `${eventId}/${sanitizedEmail}_${timestamp}.${fileExtension}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("abstract-files")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Upload error:", uploadError)

      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes("Bucket not found")) {
        return NextResponse.json(
          { error: "Storage not configured. Please contact administrator." },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("abstract-files")
      .getPublicUrl(fileName)

    return NextResponse.json({
      success: true,
      file: {
        url: urlData.publicUrl,
        name: file.name,
        size: file.size,
        path: uploadData.path,
      },
    })
  } catch (error) {
    console.error("Error in file upload:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/submit-abstract/[eventId]/upload - Delete uploaded file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Rate limit check for public endpoint
    const ip = getClientIp(request)
    const rateLimitResult = checkRateLimit(ip, "public")
    if (!rateLimitResult.success) return rateLimitExceededResponse(rateLimitResult)

    const { eventId } = await params
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")

    if (!filePath) {
      return NextResponse.json({ error: "File path required" }, { status: 400 })
    }

    // Verify the file belongs to this event
    if (!filePath.startsWith(eventId)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 })
    }

    const supabase = await createAdminClient()

    const { error } = await supabase.storage
      .from("abstract-files")
      .remove([filePath])

    if (error) {
      console.error("Delete error:", error)
      return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
