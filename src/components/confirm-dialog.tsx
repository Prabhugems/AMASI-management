"use client"

import { useState, createContext, useContext, useCallback } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertTriangle, Trash2, XCircle, CheckCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ConfirmVariant = "danger" | "warning" | "info" | "success"

interface ConfirmOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  loading?: boolean
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

const variantConfig = {
  danger: {
    icon: Trash2,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    buttonClass: "bg-red-600 hover:bg-red-700 focus:ring-red-600",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    buttonClass: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-600",
  },
  info: {
    icon: XCircle,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    buttonClass: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-600",
  },
  success: {
    icon: CheckCircle,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    buttonClass: "bg-green-600 hover:bg-green-700 focus:ring-green-600",
  },
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setOpen(true)
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
    })
  }, [])

  const handleConfirm = () => {
    setOpen(false)
    resolveRef?.(true)
  }

  const handleCancel = () => {
    setOpen(false)
    resolveRef?.(false)
  }

  const variant = options?.variant || "danger"
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              <div className={cn("h-12 w-12 rounded-full flex items-center justify-center shrink-0", config.iconBg)}>
                <Icon className={cn("h-6 w-6", config.iconColor)} />
              </div>
              <div>
                <AlertDialogTitle>{options?.title}</AlertDialogTitle>
                <AlertDialogDescription className="mt-2">
                  {options?.description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel} disabled={options?.loading}>
              {options?.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(config.buttonClass)}
              disabled={options?.loading}
            >
              {options?.loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {options?.confirmText || "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider")
  }
  return context.confirm
}
