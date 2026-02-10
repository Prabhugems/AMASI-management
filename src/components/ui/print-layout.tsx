"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface PrintLayoutProps {
  children: React.ReactNode
  className?: string
  pageSize?: "A4" | "Letter" | "A5" | "Badge"
  orientation?: "portrait" | "landscape"
  margin?: string
  showPrintButton?: boolean
  printButtonPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  title?: string
  onBeforePrint?: () => void
  onAfterPrint?: () => void
}

/**
 * Print Layout Component
 *
 * Wrapper for print-optimized content
 *
 * Usage:
 * ```
 * <PrintLayout pageSize="A4" showPrintButton>
 *   <Certificate attendeeName="John Doe" />
 * </PrintLayout>
 * ```
 */
export function PrintLayout({
  children,
  className,
  pageSize = "A4",
  orientation: _orientation = "portrait",
  margin = "10mm",
  showPrintButton = false,
  printButtonPosition = "top-right",
  title,
  onBeforePrint,
  onAfterPrint,
}: PrintLayoutProps) {
  const printRef = React.useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    onBeforePrint?.()

    const printWindow = window.open("", "_blank")
    if (!printWindow || !printRef.current) return

    const dimensions = getPageDimensions(pageSize)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || document.title}</title>
          <style>
            @page {
              size: ${dimensions.width} ${dimensions.height};
              margin: ${margin};
            }

            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }

            body {
              font-family: system-ui, -apple-system, sans-serif;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
      printWindow.close()
      onAfterPrint?.()
    }
  }

  const buttonPositionClass = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  }[printButtonPosition]

  return (
    <div className="relative">
      {showPrintButton && (
        <Button
          variant="outline"
          size="sm"
          className={cn("absolute no-print z-10", buttonPositionClass)}
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      )}
      <div ref={printRef} className={className}>
        {children}
      </div>
    </div>
  )
}

/**
 * Print-only content (hidden on screen)
 */
export function PrintOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("hidden print:block", className)}>
      {children}
    </div>
  )
}

/**
 * Screen-only content (hidden when printing)
 */
export function ScreenOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("print:hidden", className)}>
      {children}
    </div>
  )
}

/**
 * Page break before this element
 */
export function PageBreak() {
  return <div className="print:break-before-page" />
}

/**
 * Avoid page break inside this element
 */
export function AvoidBreak({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("print:break-inside-avoid", className)}>
      {children}
    </div>
  )
}

/**
 * Badge print layout (credit card size)
 */
export function BadgePrintLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "w-[85.6mm] h-[54mm] overflow-hidden",
        "print:w-[85.6mm] print:h-[54mm]",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Certificate print layout (A4 landscape)
 */
export function CertificatePrintLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "w-[297mm] h-[210mm] p-[15mm]",
        "print:w-[297mm] print:h-[210mm]",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Multiple badges per page (4 per A4)
 */
export function BadgeSheetLayout({
  badges,
  className,
}: {
  badges: React.ReactNode[]
  className?: string
}) {
  // Group badges into pages (4 per page)
  const pages: React.ReactNode[][] = []
  for (let i = 0; i < badges.length; i += 4) {
    pages.push(badges.slice(i, i + 4))
  }

  return (
    <div className={className}>
      {pages.map((pageBadges, pageIndex) => (
        <div
          key={pageIndex}
          className={cn(
            "grid grid-cols-2 grid-rows-2 gap-4 p-4",
            "w-[210mm] h-[297mm]",
            pageIndex < pages.length - 1 && "print:break-after-page"
          )}
        >
          {pageBadges.map((badge, badgeIndex) => (
            <div
              key={badgeIndex}
              className="border border-dashed border-gray-300 print:border-gray-200"
            >
              {badge}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Print button component
 */
export function PrintButton({
  targetRef,
  className,
  label = "Print",
  onBeforePrint,
  onAfterPrint,
}: {
  targetRef?: React.RefObject<HTMLElement>
  className?: string
  label?: string
  onBeforePrint?: () => void
  onAfterPrint?: () => void
}) {
  const handlePrint = () => {
    onBeforePrint?.()

    if (targetRef?.current) {
      const printWindow = window.open("", "_blank")
      if (!printWindow) return

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print</title>
          </head>
          <body>
            ${targetRef.current.innerHTML}
          </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.focus()
        printWindow.print()
        printWindow.close()
        onAfterPrint?.()
      }
    } else {
      window.print()
      onAfterPrint?.()
    }
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={handlePrint}>
      <Printer className="h-4 w-4 mr-2" />
      {label}
    </Button>
  )
}

function getPageDimensions(size: PrintLayoutProps["pageSize"]): { width: string; height: string } {
  const sizes = {
    A4: { width: "210mm", height: "297mm" },
    Letter: { width: "8.5in", height: "11in" },
    A5: { width: "148mm", height: "210mm" },
    Badge: { width: "85.6mm", height: "54mm" },
  }
  return sizes[size || "A4"]
}
