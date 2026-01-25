"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { GripVertical } from "lucide-react"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200
const DEFAULT_WIDTH = 500

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-card text-card-foreground p-6 shadow-2xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 bg-muted/80 hover:bg-muted text-foreground ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

// Resizable Sheet Content - adds drag-to-resize functionality
interface ResizableSheetContentProps
  extends Omit<SheetContentProps, 'style'> {
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  storageKey?: string
}

const ResizableSheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  ResizableSheetContentProps
>(({
  side = "right",
  className,
  children,
  defaultWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  storageKey = "sheet-width",
  ...props
}, ref) => {
  const [width, setWidth] = React.useState(defaultWidth)
  const [isResizing, setIsResizing] = React.useState(false)

  // Load saved width from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      const parsed = parseInt(saved)
      if (parsed >= minWidth && parsed <= maxWidth) {
        setWidth(parsed)
      }
    }
  }, [storageKey, minWidth, maxWidth])

  // Handle resize
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
  }, [])

  React.useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = side === "right"
        ? window.innerWidth - e.clientX
        : e.clientX

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth)
        localStorage.setItem(storageKey, newWidth.toString())
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.body.style.cursor = "ew-resize"
    document.body.style.userSelect = "none"

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, side, minWidth, maxWidth, storageKey])

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={ref}
        style={{ width }}
        className={cn(
          "fixed z-50 gap-4 bg-card text-card-foreground shadow-2xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "right" && "inset-y-0 right-0 h-full border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          side === "left" && "inset-y-0 left-0 h-full border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          isResizing && "transition-none",
          className
        )}
        {...props}
      >
        {/* Resize Handle */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/50 transition-colors group z-50",
            side === "right" ? "left-0" : "right-0",
            isResizing && "bg-primary"
          )}
        >
          <div className={cn(
            "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
            side === "right" ? "-translate-x-1/2" : "translate-x-1/2"
          )}>
            <div className="bg-primary text-primary-foreground rounded p-0.5 shadow-md">
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Close Button */}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 bg-muted/80 hover:bg-muted text-foreground ring-offset-background transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>

        {/* Content with padding for resize handle */}
        <div className={cn(
          "h-full overflow-auto",
          side === "right" ? "pl-2" : "pr-2"
        )}>
          {children}
        </div>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
ResizableSheetContent.displayName = "ResizableSheetContent"

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left pb-4 border-b border-border mb-4",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  ResizableSheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
