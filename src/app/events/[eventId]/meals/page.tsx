"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
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
  UtensilsCrossed,
  Eye,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type MealPlan = {
  id: string
  name: string
  date: string
  meal_type: string
  venue: string | null
  capacity: number | null
  start_time: string | null
  end_time: string | null
  menu_description: string | null
  is_included: boolean
  price: number
  status: string
  notes: string | null
  created_at: string
}

type DietarySummary = {
  meals: Array<{
    id: string
    name: string
    meal_type: string
    date: string
    dietary: Record<string, number>
    totalRegistered: number
  }>
  totals: Record<string, number>
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "tea", label: "Tea" },
  { value: "snack", label: "Snack" },
]

const DIETARY_LABELS: Record<string, string> = {
  regular: "Regular",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  jain: "Jain",
  halal: "Halal",
}

const emptyForm = {
  name: "",
  date: "",
  meal_type: "lunch",
  venue: "",
  capacity: 0,
  start_time: "",
  end_time: "",
  menu_description: "",
  is_included: true,
  price: 0,
  notes: "",
}

export default function MealsPage() {
  const params = useParams()
  const eventId = params.eventId as string
  const queryClient = useQueryClient()

  const [showDialog, setShowDialog] = useState(false)
  const [editingMeal, setEditingMeal] = useState<MealPlan | null>(null)
  const [deleteMeal, setDeleteMeal] = useState<MealPlan | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: meals, isLoading } = useQuery({
    queryKey: ["meals", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/meals`)
      if (!res.ok) throw new Error("Failed to fetch meal plans")
      return res.json() as Promise<MealPlan[]>
    },
  })

  const { data: dietarySummary } = useQuery({
    queryKey: ["dietary-summary", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/meals/dietary-summary`)
      if (!res.ok) throw new Error("Failed to fetch dietary summary")
      return res.json() as Promise<DietarySummary>
    },
  })

  const createMeal = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/events/${eventId}/meals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create meal plan")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Meal plan created")
      queryClient.invalidateQueries({ queryKey: ["meals", eventId] })
      setShowDialog(false)
      setForm(emptyForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const updateMeal = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof form }) => {
      const res = await fetch(`/api/events/${eventId}/meals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Meal plan updated")
      queryClient.invalidateQueries({ queryKey: ["meals", eventId] })
      setShowDialog(false)
      setEditingMeal(null)
      setForm(emptyForm)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${eventId}/meals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Meal plan deleted")
      queryClient.invalidateQueries({ queryKey: ["meals", eventId] })
      setDeleteMeal(null)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const openEdit = (meal: MealPlan) => {
    setForm({
      name: meal.name,
      date: meal.date,
      meal_type: meal.meal_type,
      venue: meal.venue || "",
      capacity: meal.capacity || 0,
      start_time: meal.start_time || "",
      end_time: meal.end_time || "",
      menu_description: meal.menu_description || "",
      is_included: meal.is_included,
      price: meal.price,
      notes: meal.notes || "",
    })
    setEditingMeal(meal)
    setShowDialog(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim() || !form.date || !form.meal_type) {
      toast.error("Name, date, and meal type are required")
      return
    }
    if (editingMeal) {
      updateMeal.mutate({ id: editingMeal.id, data: form })
    } else {
      createMeal.mutate(form)
    }
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
          <h1 className="text-xl sm:text-2xl font-bold">Meals & Catering</h1>
          <p className="text-muted-foreground">Manage meal plans and dietary preferences</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditingMeal(null); setShowDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Meal Plan
        </Button>
      </div>

      {/* Dietary Summary */}
      {dietarySummary && Object.keys(dietarySummary.totals).length > 0 && (
        <div className="bg-card rounded-lg border p-5">
          <h3 className="font-semibold mb-3">Dietary Preference Summary</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(dietarySummary.totals).map(([pref, count]) => (
              <div key={pref} className="flex items-center gap-2">
                <Badge variant="outline">{DIETARY_LABELS[pref] || pref}</Badge>
                <span className="font-mono font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {!meals || meals.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No Meal Plans</h3>
          <p className="text-sm text-muted-foreground mb-4">Start adding meal plans for your event</p>
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Meal Plan
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meals.map((meal) => (
                <TableRow key={meal.id}>
                  <TableCell className="font-medium">{meal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{meal.meal_type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(meal.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {meal.start_time ? `${meal.start_time}${meal.end_time ? ` - ${meal.end_time}` : ""}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{meal.venue || "-"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-white capitalize", meal.status === "planned" ? "bg-amber-500" : meal.status === "ready" ? "bg-green-500" : "bg-gray-500")}>
                      {meal.status}
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
                        <DropdownMenuItem asChild>
                          <Link href={`/events/${eventId}/meals/${meal.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Attendees
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(meal)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => setDeleteMeal(meal)}>
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

      {/* Add/Edit Meal Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setEditingMeal(null) }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeal ? "Edit Meal Plan" : "Add Meal Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Day 1 Lunch"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Meal Type *</Label>
                <Select value={form.meal_type} onValueChange={(v) => setForm({ ...form, meal_type: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Venue</Label>
                <Input
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="e.g., Banquet Hall"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={form.capacity || ""}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label>Menu Description</Label>
              <Textarea
                value={form.menu_description}
                onChange={(e) => setForm({ ...form, menu_description: e.target.value })}
                placeholder="Menu items..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMeal.isPending || updateMeal.isPending}>
              {(createMeal.isPending || updateMeal.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMeal ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteMeal} onOpenChange={(open) => !open && setDeleteMeal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Meal Plan
            </DialogTitle>
          </DialogHeader>
          <p className="py-4">
            Are you sure you want to delete <strong>{deleteMeal?.name}</strong>?
            All registrations for this meal will also be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMeal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteMeal && deleteMutation.mutate(deleteMeal.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
