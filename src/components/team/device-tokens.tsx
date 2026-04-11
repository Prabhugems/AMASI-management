"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Loader2,
  Plus,
  Copy,
  CheckCircle,
  Trash2,
  ShieldOff,
  ShieldCheck,
  Tablet,
  Key,
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

type DeviceToken = {
  id: string
  name: string
  token?: string
  module: string
  event_ids: string[]
  status: string
  last_used_at: string | null
  created_at: string
  updated_at: string
}

const MODULE_OPTIONS = [
  { value: "print_station", label: "Print Station" },
  { value: "check_in", label: "Check-in Kiosk" },
  { value: "display", label: "Display Board" },
]

export function DeviceTokens() {
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    module: "print_station",
  })

  const { data: tokens, isLoading } = useQuery<DeviceToken[]>({
    queryKey: ["device-tokens"],
    queryFn: async () => {
      const res = await fetch("/api/team/device-tokens")
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      return json.tokens
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; module: string }) => {
      const res = await fetch("/api/team/device-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["device-tokens"] })
      setCreatedToken(data.token.token)
      setFormData({ name: "", module: "print_station" })
      toast.success("Device token created")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/team/device-tokens/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["device-tokens"] })
      toast.success(data.message)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/team/device-tokens/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-tokens"] })
      toast.success("Device token deleted")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleCreate = () => {
    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }
    createMutation.mutate(formData)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Token copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <Tablet className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Device Tokens</h3>
            <p className="text-xs text-muted-foreground">
              Long-lived tokens for kiosk and print station devices
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreatedToken(null)
            setIsCreateOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create Token
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading tokens...
          </CardContent>
        </Card>
      ) : !tokens || tokens.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No device tokens yet</p>
            <p className="text-xs mt-1">Create a token to authenticate a kiosk or print station device.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Module</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Last Used</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tablet className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{token.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {MODULE_OPTIONS.find((m) => m.value === token.module)?.label || token.module}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "text-xs",
                        token.status === "active"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-red-100 text-red-700 hover:bg-red-100"
                      )}
                    >
                      {token.status === "active" ? (
                        <ShieldCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <ShieldOff className="h-3 w-3 mr-1" />
                      )}
                      {token.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {token.last_used_at
                      ? formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {token.status === "active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: token.id,
                              status: "revoked",
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-1" />
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: token.id,
                              status: "active",
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          Reactivate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm("Delete this device token? This cannot be undone.")) {
                            deleteMutation.mutate(token.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Token Dialog */}
      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedToken(null)
          }
          setIsCreateOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdToken ? "Token Created" : "Create Device Token"}
            </DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Copy this token now. It will not be shown again."
                : "Create a long-lived token for a kiosk or print station device."}
            </DialogDescription>
          </DialogHeader>

          {createdToken ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
                <p className="text-xs font-medium text-amber-800 mb-2">
                  Save this token securely. It will only be shown once.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white rounded px-2 py-1.5 border font-mono break-all select-all">
                    {createdToken}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(createdToken)}
                  >
                    {copied ? (
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  setCreatedToken(null)
                  setIsCreateOpen(false)
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token-name">Device Name</Label>
                <Input
                  id="token-name"
                  placeholder="e.g., Zebra ZD230 Print Station"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token-module">Module</Label>
                <Select
                  value={formData.module}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, module: value }))
                  }
                >
                  <SelectTrigger id="token-module">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Key className="h-4 w-4 mr-2" />
                )}
                Generate Token
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
