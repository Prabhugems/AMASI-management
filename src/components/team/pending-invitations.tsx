"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MailPlus, Trash2, Clock, CheckCircle, XCircle, Loader2, Mail, RefreshCw } from "lucide-react"
import { formatDistanceToNow, format, isPast } from "date-fns"
import { cn } from "@/lib/utils"

export type Invitation = {
  id: string
  email: string
  role: string
  permissions: string[] | Record<string, boolean> | null
  event_ids: string[]
  status: string
  invited_by: string | null
  token: string
  expires_at: string
  created_at: string
  updated_at: string
}

interface PendingInvitationsProps {
  invitations: Invitation[]
  isLoading: boolean
  onResend: (id: string) => void
  onRevoke: (id: string) => void
  isResending?: boolean
}

const ROLE_GRADIENTS: Record<string, string> = {
  admin: "from-purple-500 to-pink-500",
  coordinator: "from-blue-500 to-indigo-500",
  travel: "from-cyan-500 to-blue-500",
  super_admin: "from-red-500 to-orange-500",
  event_admin: "from-blue-500 to-indigo-500",
  staff: "from-emerald-500 to-teal-500",
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  expired: { label: "Expired", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  accepted: { label: "Accepted", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  revoked: { label: "Revoked", className: "bg-slate-100 text-slate-500 border-slate-200", icon: XCircle },
}

function getExpiryText(expiresAt: string): { text: string; isExpired: boolean } {
  const expiryDate = new Date(expiresAt)
  if (isPast(expiryDate)) {
    return { text: "Expired", isExpired: true }
  }
  return { text: `Expires in ${formatDistanceToNow(expiryDate)}`, isExpired: false }
}

function wasResent(createdAt: string, updatedAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const updated = new Date(updatedAt).getTime()
  // If updated more than 60s after created, it was resent
  return updated - created > 60_000
}

export function PendingInvitations({
  invitations,
  isLoading,
  onResend,
  onRevoke,
  isResending,
}: PendingInvitationsProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const handleRevoke = (id: string) => {
    if (confirmingId === id) {
      onRevoke(id)
      setConfirmingId(null)
    } else {
      setConfirmingId(id)
      setTimeout(() => setConfirmingId(null), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">Loading invitations...</p>
      </div>
    )
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border py-16 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Mail className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No pending invitations</h3>
        <p className="text-sm text-muted-foreground">
          Invite team members to get started
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="w-[280px]">Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="w-[140px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const gradient = ROLE_GRADIENTS[invitation.role] || "from-slate-500 to-slate-600"
            const statusInfo = STATUS_CONFIG[invitation.status] || STATUS_CONFIG.pending
            const StatusIcon = statusInfo.icon
            const expiry = getExpiryText(invitation.expires_at)
            const canResend = invitation.status === "pending" || invitation.status === "expired"
            const canRevoke = invitation.status === "pending"
            const resent = wasResent(invitation.created_at, invitation.updated_at)

            return (
              <TableRow key={invitation.id} className="hover:bg-slate-50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <span className="font-medium text-sm truncate max-w-[220px]">
                      {invitation.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-white text-xs bg-gradient-to-r", gradient)}>
                    {invitation.role.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn("text-xs gap-1", statusInfo.className)}>
                      <StatusIcon className="h-3 w-3" />
                      {statusInfo.label}
                    </Badge>
                    {resent && (
                      <Badge variant="outline" className="text-xs gap-1 bg-amber-50 text-amber-700 border-amber-200">
                        <RefreshCw className="h-3 w-3" />
                        Resent
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {format(new Date(invitation.created_at), "PPpp")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <span className={cn("text-sm", expiry.isExpired ? "text-red-600 font-medium" : "text-muted-foreground")}>
                    {expiry.text}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {canResend && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onResend(invitation.id)}
                              disabled={isResending}
                              className="h-8 w-8 p-0"
                            >
                              {isResending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MailPlus className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Resend invitation</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {canRevoke && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(invitation.id)}
                              className={cn(
                                "h-8 w-8 p-0",
                                confirmingId === invitation.id && "bg-red-50"
                              )}
                            >
                              <Trash2
                                className={cn(
                                  "h-4 w-4",
                                  confirmingId === invitation.id ? "text-red-600" : "text-slate-500"
                                )}
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {confirmingId === invitation.id ? "Click again to confirm" : "Revoke invitation"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
