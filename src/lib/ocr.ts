/**
 * OCR.space Integration
 * Free OCR API for extracting text from images
 * https://ocr.space/ocrapi
 */

type OCRResult = {
  success: boolean
  text: string
  error?: string
}

/**
 * Extract text from an image using OCR.space API
 * Supports: JPG, PNG, GIF, PDF, BMP, TIFF, WebP
 */
export async function extractTextFromImage(imageBuffer: Buffer, filename: string): Promise<OCRResult> {
  const apiKey = process.env.OCR_SPACE_API_KEY

  if (!apiKey) {
    console.log("[OCR] No API key configured")
    return { success: false, text: "", error: "OCR API key not configured" }
  }

  try {
    // Determine file type from filename
    const ext = filename.split(".").pop()?.toLowerCase() || "jpg"
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      tiff: "image/tiff",
      webp: "image/webp",
      pdf: "application/pdf",
    }
    const mimeType = mimeTypes[ext] || "image/jpeg"

    // Create form data with base64 encoded image
    const base64Image = `data:${mimeType};base64,${imageBuffer.toString("base64")}`

    const formData = new FormData()
    formData.append("base64Image", base64Image)
    formData.append("apikey", apiKey)
    formData.append("language", "eng")
    formData.append("isOverlayRequired", "false")
    formData.append("detectOrientation", "true")
    formData.append("scale", "true")
    formData.append("OCREngine", "2") // Engine 2 is better for dense text

    console.log(`[OCR] Processing ${filename} (${(imageBuffer.length / 1024).toFixed(1)} KB)`)

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    if (result.IsErroredOnProcessing) {
      console.error("[OCR] Processing error:", result.ErrorMessage)
      return {
        success: false,
        text: "",
        error: result.ErrorMessage?.[0] || "OCR processing failed",
      }
    }

    if (result.ParsedResults && result.ParsedResults.length > 0) {
      const extractedText = result.ParsedResults.map((r: any) => r.ParsedText).join("\n")
      console.log(`[OCR] Extracted ${extractedText.length} characters`)
      return {
        success: true,
        text: extractedText,
      }
    }

    return {
      success: false,
      text: "",
      error: "No text found in image",
    }
  } catch (error: any) {
    console.error("[OCR] Request failed:", error)
    return {
      success: false,
      text: "",
      error: error.message || "OCR request failed",
    }
  }
}

/**
 * Check if OCR is enabled
 */
export function isOCREnabled(): boolean {
  return !!process.env.OCR_SPACE_API_KEY
}
