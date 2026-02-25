"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  Download,
  Receipt,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Budget = {
  id: string
  name: string
  category: string
  estimated_amount: number
  actual_amount: number
  status: string
  notes: string | null
  created_at: string
  budget_items?: BudgetItem[]
}

type BudgetItem = {
  id: string
  budget_id: string
  item_name: string
  description: string | null
  vendor: string | null
  amount: number
  quantity: number
  receipt_url: string | null
  invoice_number: string | null
  paid_date: string | null
  payment_method: string | null
  status: string
  notes: string | null
  created_at: string
}

const CATEGORIES = [
  "venue", "catering", "printing", "travel", "marketing", "av_equipment", "gifts", "miscellaneous",
]

const CATEGORY_LABELS: Record<string, string> = {
  venue: "Venue",
  catering: "Catering",
  printing: "Printing",
  travel: "Travel",
  marketing: "Marketing",
  av_equipment: "AV Equipment",
  gifts: "Gifts",
  miscellaneous: "Miscellaneous",
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-amber-500" },
  { value: "approved", label: "Approved", color: "bg-blue-500" },
  { value: "paid", label: "Paid", color: "bg-green-500" },
  { value: "rejected", label: "Rejected", color: "bg-red-500" },
]

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
]

const emptyBudgetForm = {
  name: "",
  category: "miscellaneous",
  estimated_amount: 0,
  notes: "",
}

const emptyItemForm = {
  item_name: "",
  description: "",
  vendor: "",
  amount: 0,
  quantity: 1,
  invoice_number: "",
  payment_method: "",
  status: "pending",
  notes: "",
}

export default function BudgetExpensesPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [showBudgetDialog, setShowBudgetDialog] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [deleteBudget, setDeleteBudget] = useState<Budget | null>(null)
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null)
  const [budgetForm, setBudgetForm] = useState(emptyBudgetForm)
  const [itemForm, setItemForm] = useState(emptyItemForm)

  const { data: budgets, isLoading } = useQuery({
    queryKey: ["budgets", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/budgets`)
      if (!res.ok) throw new Error("Failed to fetch budgets")
      return res.json() as Promise<Budget[]>
    },
  })

  const createBudget = useMutation({
    mutationFn: async (data: typeof budgetForm) => {
      const res = await fetch(`/api/events/${eventId}/budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create budget")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Budget category created")
      queryClient.invalidateQueries({ queryKey: ["budgets", eventId] })
      setShowBudgetDialog(false)
      setBudgetForm(emptyBudgetForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateBudget = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof budgetForm }) => {
      const res = await fetch(`/api/events/${eventId}/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update budget")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Budget updated")
      queryClient.invalidateQueries({ queryKey: ["budgets", eventId] })
      setShowBudgetDialog(false)
      setEditingBudget(null)
      setBudgetForm(emptyBudgetForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/budgets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Budget deleted")
      queryClient.invalidateQueries({ queryKey: ["budgets", eventId] })
      setDeleteBudget(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const addItem = useMutation({
    mutationFn: async ({ budgetId, data }: { budgetId: string; data: typeof itemForm }) => {
      const res = await fetch(`/api/events/${eventId}/budgets/${budgetId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to add expense item")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Expense item added")
      queryClient.invalidateQueries({ queryKey: ["budgets", eventId] })
      setShowItemDialog(false)
      setSelectedBudgetId(null)
      setItemForm(emptyItemForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const filtered = useMemo(() => {
    if (!budgets) return []
    return budgets.filter((b) => {
      const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = filterCategory === "all" || b.category === filterCategory
      return matchesSearch && matchesCategory
    })
  }, [budgets, search, filterCategory])

  const handleBudgetSubmit = () => {
    if (!budgetForm.name.trim()) {
      toast.error("Budget name is required")
      return
    }
    if (editingBudget) {
      updateBudget.mutate({ id: editingBudget.id, data: budgetForm })
    } else {
      createBudget.mutate(budgetForm)
    }
  }

  const openEditBudget = (budget: Budget) => {
    setBudgetForm({
      name: budget.name,
      category: budget.category,
      estimated_amount: budget.estimated_amount,
      notes: budget.notes || "",
    })
    setEditingBudget(budget)
    setShowBudgetDialog(true)
  }

  const exportExpenses = () => {
    const headers = ["Category", "Budget Name", "Estimated", "Status", "Created"]
    const rows = filtered.map((b) => [
      CATEGORY_LABELS[b.category] || b.category,
      b.name,
      b.estimated_amount,
      b.status,
      new Date(b.created_at).toLocaleDateString("en-IN"),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `budget-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Budget exported")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Budget categories and expense items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExpenses}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => { setBudgetForm(emptyBudgetForm); setEditingBudget(null); setShowBudgetDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search budgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Budgets Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Start by adding budget categories for your event
          </p>
          <Button onClick={() => setShowBudgetDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((budget) => (
                <TableRow key={budget.id}>
                  <TableCell className="font-medium">{budget.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{CATEGORY_LABELS[budget.category] || budget.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {Number(budget.estimated_amount).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-white capitalize", budget.status === "planned" ? "bg-amber-500" : budget.status === "approved" ? "bg-blue-500" : budget.status === "spent" ? "bg-green-500" : "bg-gray-500")}>
                      {budget.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setSelectedBudgetId(budget.id); setItemForm(emptyItemForm); setShowItemDialog(true) }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Expense Item
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditBudget(budget)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteBudget(budget)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Budget Dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={(open) => { setShowBudgetDialog(open); if (!open) setEditingBudget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? "Edit Budget" : "Add Budget Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={budgetForm.name}
                onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                placeholder="e.g., Main Hall Rental"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={budgetForm.category} onValueChange={(v) => setBudgetForm({ ...budgetForm, category: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estimated Amount</Label>
              <Input
                type="number"
                value={budgetForm.estimated_amount || ""}
                onChange={(e) => setBudgetForm({ ...budgetForm, estimated_amount: parseFloat(e.target.value) || 0 })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={budgetForm.notes}
                onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>Cancel</Button>
            <Button onClick={handleBudgetSubmit} disabled={createBudget.isPending || updateBudget.isPending}>
              {(createBudget.isPending || updateBudget.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBudget ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Expense Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Item Name *</Label>
              <Input
                value={itemForm.item_name}
                onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })}
                placeholder="e.g., Projector Rental"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  value={itemForm.amount || ""}
                  onChange={(e) => setItemForm({ ...itemForm, amount: parseFloat(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={itemForm.quantity || ""}
                  onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor</Label>
                <Input
                  value={itemForm.vendor}
                  onChange={(e) => setItemForm({ ...itemForm, vendor: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Invoice #</Label>
                <Input
                  value={itemForm.invoice_number}
                  onChange={(e) => setItemForm({ ...itemForm, invoice_number: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Select value={itemForm.payment_method} onValueChange={(v) => setItemForm({ ...itemForm, payment_method: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={itemForm.status} onValueChange={(v) => setItemForm({ ...itemForm, status: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={itemForm.description}
                onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
            <Button
              onClick={() => selectedBudgetId && addItem.mutate({ budgetId: selectedBudgetId, data: itemForm })}
              disabled={addItem.isPending || !itemForm.item_name.trim()}
            >
              {addItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteBudget} onOpenChange={(open) => !open && setDeleteBudget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Budget
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{deleteBudget?.name}</strong>?
            All expense items under this budget will also be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBudget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteBudget && deleteBudgetMutation.mutate(deleteBudget.id)}
              disabled={deleteBudgetMutation.isPending}
            >
              {deleteBudgetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
