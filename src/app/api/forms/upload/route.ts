import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { checkRateLimit, getClientIp, rateLimitExceededResponse } from "@/lib/rate-limit"

// Allowed file extensions for security
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.txt', '.csv', '.json', '.xml'
]

// Dangerous extensions to block
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.php',
  '.py', '.rb', '.pl', '.jar', '.dll', '.msi', '.app', '.dmg',
  '.html', '.htm', '.svg' // SVG can contain scripts
]

export async function POST(request: NextRequest) {
  // Rate limit: authenticated tier for file uploads
  const ip = getClientIp(request)
  const rateLimit = checkRateLimit(ip, "authenticated")
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit)
  }

  try {
    // Authentication check - require logged in user for file uploads
    const supabaseAuth = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - please login to upload files' },
        { status: 401 }
      )
    }

    // Use service role key for storage uploads (allows bypassing RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const formId = formData.get("form_id") as string
    const fieldId = formData.get("field_id") as string

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    if (!formId || !fieldId) {
      return NextResponse.json(
        { error: "form_id and field_id are required" },
        { status: 400 }
      )
    }

    // Validate file extension
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    if (BLOCKED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: "File type not allowed for security reasons" },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    if (file.size > 52428800) {
      return NextResponse.json(
        { error: "File size exceeds 50MB limit" },
        { status: 400 }
      )
    }

    // Generate unique file name
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const fileName = `${formId}/${fieldId}/${timestamp}_${sanitizedName}`

    // Convert File to ArrayBuffer then to Uint8Array
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("form-uploads")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("Storage upload error:", error)

      // If bucket doesn't exist, try to create it
      if (error.message?.includes("Bucket not found")) {
        // Create the bucket
        const { error: bucketError } = await supabase.storage.createBucket("form-uploads", {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        })

        if (bucketError && !bucketError.message?.includes("already exists")) {
          console.error("Bucket creation error:", bucketError)
          return NextResponse.json(
            { error: "Failed to create storage bucket" },
            { status: 500 }
          )
        }

        // Retry upload
        const { data: retryData, error: retryError } = await supabase.storage
          .from("form-uploads")
          .upload(fileName, fileBuffer, {
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
        const { data: urlData } = supabase.storage
          .from("form-uploads")
          .getPublicUrl(retryData.path)

        return NextResponse.json({
          url: urlData.publicUrl,
          path: retryData.path,
          fileName: file.name,
        })
      }

      return NextResponse.json(
        { error: error.message || "Failed to upload file" },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("form-uploads")
      .getPublicUrl(data.path)

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      fileName: file.name,
    })
  } catch (error) {
    console.error("Error in file upload:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
