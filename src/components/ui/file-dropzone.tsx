"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Upload, X, File, Image, FileText, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatFileSize } from "@/lib/formatters"

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void
  accept?: string
  maxFiles?: number
  maxSize?: number
  disabled?: boolean
  className?: string
  children?: React.ReactNode
}

/**
 * File Dropzone Component
 *
 * Drag and drop file upload with preview
 *
 * Usage:
 * ```
 * <FileDropzone
 *   onFilesSelected={(files) => handleUpload(files)}
 *   accept="image/*,.pdf"
 *   maxFiles={5}
 *   maxSize={10 * 1024 * 1024}
 * />
 * ```
 */
export function FileDropzone({
  onFilesSelected,
  accept,
  maxFiles = 1,
  maxSize,
  disabled = false,
  className,
  children,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const validateFiles = React.useCallback(
    (files: File[]): { valid: File[]; error: string | null } => {
      // Check max files
      if (files.length > maxFiles) {
        return {
          valid: [],
          error: `Maximum ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`,
        }
      }

      // Check file sizes
      if (maxSize) {
        const oversized = files.filter((f) => f.size > maxSize)
        if (oversized.length > 0) {
          return {
            valid: [],
            error: `File${oversized.length > 1 ? "s" : ""} exceed maximum size of ${formatFileSize(maxSize)}`,
          }
        }
      }

      // Check file types if accept is specified
      if (accept) {
        const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase())
        const invalid = files.filter((f) => {
          const extension = `.${f.name.split(".").pop()?.toLowerCase()}`
          const mimeType = f.type.toLowerCase()

          return !acceptedTypes.some((accepted) => {
            if (accepted.startsWith(".")) {
              return extension === accepted
            }
            if (accepted.endsWith("/*")) {
              return mimeType.startsWith(accepted.replace("/*", "/"))
            }
            return mimeType === accepted
          })
        })

        if (invalid.length > 0) {
          return {
            valid: [],
            error: `Invalid file type. Accepted: ${accept}`,
          }
        }
      }

      return { valid: files, error: null }
    },
    [accept, maxFiles, maxSize]
  )

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      const { valid, error } = validateFiles(files)

      setError(error)
      if (valid.length > 0) {
        onFilesSelected(valid)
      }
    },
    [disabled, onFilesSelected, validateFiles]
  )

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      const { valid, error } = validateFiles(files)

      setError(error)
      if (valid.length > 0) {
        onFilesSelected(valid)
      }

      // Reset input
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    },
    [onFilesSelected, validateFiles]
  )

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxFiles > 1}
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
          "flex flex-col items-center justify-center text-center",
          isDragging && "border-primary bg-primary/5",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed",
          !isDragging && !error && "border-muted-foreground/25 hover:border-primary/50"
        )}
      >
        {children || (
          <>
            <Upload
              className={cn(
                "h-10 w-10 mb-4",
                isDragging ? "text-primary" : "text-muted-foreground"
              )}
            />
            <p className="text-sm font-medium">
              {isDragging ? "Drop files here" : "Drag & drop files here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse
            </p>
            {accept && (
              <p className="text-xs text-muted-foreground mt-2">
                Accepted: {accept}
              </p>
            )}
            {maxSize && (
              <p className="text-xs text-muted-foreground">
                Max size: {formatFileSize(maxSize)}
              </p>
            )}
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  )
}

/**
 * File preview component
 */
export function FilePreview({
  file,
  onRemove,
  className,
}: {
  file: File
  onRemove?: () => void
  className?: string
}) {
  const [preview, setPreview] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file])

  const getIcon = () => {
    if (file.type.startsWith("image/")) return Image
    if (file.type === "application/pdf") return FileText
    if (
      file.type.includes("spreadsheet") ||
      file.type.includes("excel") ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".csv")
    ) {
      return FileSpreadsheet
    }
    return File
  }

  const Icon = getIcon()

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 p-3 border rounded-lg",
        className
      )}
    >
      {preview ? (
        <img
          src={preview}
          alt={file.name}
          className="h-12 w-12 object-cover rounded"
        />
      ) : (
        <div className="h-12 w-12 flex items-center justify-center bg-muted rounded">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>

      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

/**
 * File list with previews
 */
export function FileList({
  files,
  onRemove,
  className,
}: {
  files: File[]
  onRemove?: (index: number) => void
  className?: string
}) {
  if (files.length === 0) return null

  return (
    <div className={cn("space-y-2", className)}>
      {files.map((file, index) => (
        <FilePreview
          key={`${file.name}-${index}`}
          file={file}
          onRemove={onRemove ? () => onRemove(index) : undefined}
        />
      ))}
    </div>
  )
}

/**
 * Complete file upload component with dropzone and preview
 */
export function FileUploader({
  value,
  onChange,
  accept,
  maxFiles = 1,
  maxSize,
  disabled,
  className,
}: {
  value: File[]
  onChange: (files: File[]) => void
  accept?: string
  maxFiles?: number
  maxSize?: number
  disabled?: boolean
  className?: string
}) {
  const handleFilesSelected = (newFiles: File[]) => {
    if (maxFiles === 1) {
      onChange(newFiles)
    } else {
      const combined = [...value, ...newFiles].slice(0, maxFiles)
      onChange(combined)
    }
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={cn("space-y-4", className)}>
      {(value.length < maxFiles || maxFiles === 1) && (
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          accept={accept}
          maxFiles={maxFiles - value.length}
          maxSize={maxSize}
          disabled={disabled}
        />
      )}

      <FileList files={value} onRemove={handleRemove} />
    </div>
  )
}
