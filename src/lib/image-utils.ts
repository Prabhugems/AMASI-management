/**
 * Image Utilities
 *
 * Compression, resizing, and validation for image uploads
 */

interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: "image/jpeg" | "image/png" | "image/webp"
}

/**
 * Compress and resize an image file
 *
 * Usage:
 * ```
 * const compressedFile = await compressImage(file, {
 *   maxWidth: 800,
 *   quality: 0.8
 * })
 * ```
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.85,
    mimeType = "image/jpeg",
  } = options

  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      reject(new Error("Could not get canvas context"))
      return
    }

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress image"))
            return
          }

          const compressedFile = new File([blob], file.name, {
            type: mimeType,
            lastModified: Date.now(),
          })

          resolve(compressedFile)
        },
        mimeType,
        quality
      )
    }

    img.onerror = () => reject(new Error("Could not load image"))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = URL.createObjectURL(file)
  })
}

/**
 * Validate image file
 */
export interface ImageValidationResult {
  valid: boolean
  error?: string
}

export function validateImageFile(
  file: File,
  options: {
    maxSizeMB?: number
    allowedTypes?: string[]
    minWidth?: number
    minHeight?: number
  } = {}
): ImageValidationResult {
  const {
    maxSizeMB = 10,
    allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
  } = options

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} not allowed. Allowed: ${allowedTypes.join(", ")}`,
    }
  }

  // Check file size
  const sizeMB = file.size / (1024 * 1024)
  if (sizeMB > maxSizeMB) {
    return {
      valid: false,
      error: `File size ${sizeMB.toFixed(1)}MB exceeds maximum ${maxSizeMB}MB`,
    }
  }

  return { valid: true }
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(
  file: File,
  options: {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    aspectRatio?: number
    aspectRatioTolerance?: number
  }
): Promise<ImageValidationResult> {
  try {
    const { width, height } = await getImageDimensions(file)

    if (options.minWidth && width < options.minWidth) {
      return {
        valid: false,
        error: `Image width ${width}px is less than minimum ${options.minWidth}px`,
      }
    }

    if (options.minHeight && height < options.minHeight) {
      return {
        valid: false,
        error: `Image height ${height}px is less than minimum ${options.minHeight}px`,
      }
    }

    if (options.maxWidth && width > options.maxWidth) {
      return {
        valid: false,
        error: `Image width ${width}px exceeds maximum ${options.maxWidth}px`,
      }
    }

    if (options.maxHeight && height > options.maxHeight) {
      return {
        valid: false,
        error: `Image height ${height}px exceeds maximum ${options.maxHeight}px`,
      }
    }

    if (options.aspectRatio) {
      const tolerance = options.aspectRatioTolerance || 0.1
      const actualRatio = width / height
      const diff = Math.abs(actualRatio - options.aspectRatio)
      if (diff > tolerance) {
        return {
          valid: false,
          error: `Image aspect ratio ${actualRatio.toFixed(2)} doesn't match required ${options.aspectRatio}`,
        }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: "Could not read image dimensions" }
  }
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Could not read file"))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert base64 to file
 */
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(",")
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png"
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

/**
 * Generate thumbnail from image
 */
export async function generateThumbnail(
  file: File,
  size: number = 200
): Promise<File> {
  return compressImage(file, {
    maxWidth: size,
    maxHeight: size,
    quality: 0.7,
  })
}

/**
 * Extract dominant color from image
 */
export async function getDominantColor(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      reject(new Error("Could not get canvas context"))
      return
    }

    img.onload = () => {
      // Sample a small version of the image
      canvas.width = 10
      canvas.height = 10
      ctx.drawImage(img, 0, 0, 10, 10)

      const imageData = ctx.getImageData(0, 0, 10, 10).data
      let r = 0, g = 0, b = 0
      const pixelCount = imageData.length / 4

      for (let i = 0; i < imageData.length; i += 4) {
        r += imageData[i]
        g += imageData[i + 1]
        b += imageData[i + 2]
      }

      r = Math.round(r / pixelCount)
      g = Math.round(g / pixelCount)
      b = Math.round(b / pixelCount)

      resolve(`rgb(${r}, ${g}, ${b})`)
    }

    img.onerror = () => reject(new Error("Could not load image"))
    img.src = URL.createObjectURL(file)
  })
}
