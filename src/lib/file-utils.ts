/**
 * File Utilities
 *
 * File type detection, validation, and size formatting
 */

/**
 * File type categories
 */
export const FILE_TYPES = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf"],
  video: ["mp4", "webm", "avi", "mov", "mkv", "flv", "wmv"],
  audio: ["mp3", "wav", "ogg", "flac", "aac", "wma"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2"],
  code: ["js", "ts", "jsx", "tsx", "html", "css", "json", "xml", "md"],
} as const

/**
 * MIME types
 */
export const MIME_TYPES: Record<string, string> = {
  // Images
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",

  // Documents
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  rtf: "application/rtf",
  csv: "text/csv",

  // Video
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  mkv: "video/x-matroska",

  // Audio
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",

  // Archives
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",

  // Code
  js: "text/javascript",
  ts: "text/typescript",
  json: "application/json",
  html: "text/html",
  css: "text/css",
  xml: "application/xml",
  md: "text/markdown",
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || ""
  return ext
}

/**
 * Get file name without extension
 */
export function getFileName(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  return lastDot === -1 ? filename : filename.substring(0, lastDot)
}

/**
 * Get MIME type from extension
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename)
  return MIME_TYPES[ext] || "application/octet-stream"
}

/**
 * Get file type category
 */
export function getFileCategory(
  filename: string
): keyof typeof FILE_TYPES | "other" {
  const ext = getFileExtension(filename)

  for (const [category, extensions] of Object.entries(FILE_TYPES)) {
    if ((extensions as readonly string[]).includes(ext)) {
      return category as keyof typeof FILE_TYPES
    }
  }

  return "other"
}

/**
 * Check if file is an image
 */
export function isImage(filename: string): boolean {
  return getFileCategory(filename) === "image"
}

/**
 * Check if file is a document
 */
export function isDocument(filename: string): boolean {
  return getFileCategory(filename) === "document"
}

/**
 * Check if file is a video
 */
export function isVideo(filename: string): boolean {
  return getFileCategory(filename) === "video"
}

/**
 * Check if file is audio
 */
export function isAudio(filename: string): boolean {
  return getFileCategory(filename) === "audio"
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
}

/**
 * Parse file size string to bytes
 */
export function parseFileSize(sizeStr: string): number {
  const units: Record<string, number> = {
    b: 1,
    bytes: 1,
    kb: 1024,
    mb: 1024 ** 2,
    gb: 1024 ** 3,
    tb: 1024 ** 4,
  }

  const match = sizeStr.toLowerCase().match(/^([\d.]+)\s*([a-z]+)$/)
  if (!match) return 0

  const [, value, unit] = match
  const multiplier = units[unit] || 1

  return parseFloat(value) * multiplier
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSize: number | string
): { valid: boolean; error?: string } {
  const maxBytes = typeof maxSize === "string" ? parseFileSize(maxSize) : maxSize

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum (${formatFileSize(maxBytes)})`,
    }
  }

  return { valid: true }
}

/**
 * Validate file type
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  const ext = getFileExtension(file.name)

  // Check extension
  const allowedExtensions = allowedTypes
    .filter((t) => !t.startsWith(".") && !t.includes("/"))
    .map((t) => t.toLowerCase())

  // Check MIME types
  const allowedMimes = allowedTypes.filter((t) => t.includes("/"))

  const isValidExt = allowedExtensions.includes(ext)
  const isValidMime = allowedMimes.includes(file.type)

  // Check category shortcuts like "image/*"
  const categoryShortcuts = allowedTypes.filter((t) => t.endsWith("/*"))
  const isValidCategory = categoryShortcuts.some((shortcut) => {
    const category = shortcut.replace("/*", "")
    return file.type.startsWith(category + "/")
  })

  if (!isValidExt && !isValidMime && !isValidCategory) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed. Allowed: ${allowedTypes.join(", ")}`,
    }
  }

  return { valid: true }
}

/**
 * Validate file
 */
export function validateFile(
  file: File,
  options: {
    maxSize?: number | string
    allowedTypes?: string[]
  } = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (options.maxSize) {
    const sizeResult = validateFileSize(file, options.maxSize)
    if (!sizeResult.valid && sizeResult.error) {
      errors.push(sizeResult.error)
    }
  }

  if (options.allowedTypes) {
    const typeResult = validateFileType(file, options.allowedTypes)
    if (!typeResult.valid && typeResult.error) {
      errors.push(typeResult.error)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Create a unique file name
 */
export function uniqueFileName(filename: string): string {
  const name = getFileName(filename)
  const ext = getFileExtension(filename)
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)

  return `${name}-${timestamp}-${random}.${ext}`
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(filename: string): string {
  const name = getFileName(filename)
  const ext = getFileExtension(filename)

  const sanitized = name
    .replace(/[^\w\s.-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Remove multiple dashes
    .toLowerCase()
    .substring(0, 100) // Limit length

  return ext ? `${sanitized}.${ext}` : sanitized
}

/**
 * Read file as data URL
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

/**
 * Read file as text
 */
export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsText(file)
  })
}

/**
 * Read file as array buffer
 */
export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Download text as file
 */
export function downloadText(text: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([text], { type: mimeType })
  downloadBlob(blob, filename)
}

/**
 * Download JSON as file
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2)
  downloadText(json, filename.endsWith(".json") ? filename : `${filename}.json`, "application/json")
}

/**
 * Get file icon based on type
 */
export function getFileIcon(filename: string): string {
  const category = getFileCategory(filename)

  const icons: Record<string, string> = {
    image: "🖼️",
    document: "📄",
    video: "🎬",
    audio: "🎵",
    archive: "📦",
    code: "💻",
    other: "📁",
  }

  return icons[category]
}
