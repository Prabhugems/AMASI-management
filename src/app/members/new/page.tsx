"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ArrowLeft,
  IdCard,
  Loader2,
  Save,
  User,
  Mail,
  Phone,
  Vote,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const MEMBERSHIP_TYPES = [
  { value: "Life Member [LM]", label: "Life Member [LM]" },
  { value: "Associate Life Member [ALM]", label: "Associate Life Member [ALM]" },
  { value: "International Life Member [ILM]", label: "International Life Member [ILM]" },
  { value: "Associate Candidate Member [ACM]", label: "Associate Candidate Member [ACM]" },
]

export default function NewMemberPage() {
  const [formData, setFormData] = useState({
    amasi_number: "",
    name: "",
    email: "",
    phone: "",
    membership_type: "",
    voting_eligible: false,
    asi_member_id: "",
  })

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }

      // Auto-set voting_eligible based on membership type
      if (field === "membership_type") {
        const isLifeMember = value === "Life Member [LM]"
        updated.voting_eligible = isLifeMember
      }

      return updated
    })
  }

  // Create member mutation
  const createMember = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) {
        throw new Error("Name is required")
      }
      if (!formData.email.trim()) {
        throw new Error("Email is required")
      }

      // Check if email already exists
      const { data: existing } = await (supabase as any)
        .from("members")
        .select("id, name")
        .eq("email", formData.email.trim().toLowerCase())
        .maybeSingle()

      if (existing) {
        throw new Error(`Member already exists with this email: ${existing.name}`)
      }

      // Check if AMASI number already exists
      if (formData.amasi_number) {
        const { data: existingNumber } = await (supabase as any)
          .from("members")
          .select("id, name")
          .eq("amasi_number", parseInt(formData.amasi_number))
          .maybeSingle()

        if (existingNumber) {
          throw new Error(`AMASI number already assigned to: ${existingNumber.name}`)
        }
      }

      const { error } = await (supabase as any)
        .from("members")
        .insert({
          amasi_number: formData.amasi_number ? parseInt(formData.amasi_number) : null,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone ? parseInt(formData.phone) : null,
          membership_type: formData.membership_type || null,
          status: "active",
          voting_eligible: formData.voting_eligible,
          asi_member_id: formData.asi_member_id || null,
        })

      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`${formData.name} has been added as a member`)
      queryClient.invalidateQueries({ queryKey: ["members"] })
      router.push("/members")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMember.mutate()
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/members">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Members
            </Link>
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <IdCard className="h-6 w-6" />
              Add New Member
            </h1>
            <p className="text-sm text-muted-foreground">
              Create a new AMASI member record
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Basic Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Personal details of the member
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amasi_number">AMASI Number</Label>
                  <Input
                    id="amasi_number"
                    type="number"
                    placeholder="e.g., 1234"
                    value={formData.amasi_number}
                    onChange={(e) => handleChange("amasi_number", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Details */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IdCard className="h-5 w-5" />
                Membership Details
              </CardTitle>
              <CardDescription>
                Membership type and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="membership_type">Membership Type</Label>
                <Select
                  value={formData.membership_type || undefined}
                  onValueChange={(v) => handleChange("membership_type", v)}
                >
                  <SelectTrigger id="membership_type">
                    <SelectValue placeholder="Select membership type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBERSHIP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="asi_member_id">ASI Member ID</Label>
                <Input
                  id="asi_member_id"
                  value={formData.asi_member_id}
                  onChange={(e) => handleChange("asi_member_id", e.target.value)}
                  placeholder="ASI Membership Number"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
                <div className="flex items-center gap-3">
                  <Vote className="h-5 w-5 text-violet-500" />
                  <div>
                    <p className="font-medium">Voting Rights</p>
                    <p className="text-sm text-muted-foreground">
                      Only Life Members [LM] have voting rights
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.voting_eligible}
                  onCheckedChange={(checked) => handleChange("voting_eligible", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" type="button" asChild>
              <Link href="/members">Cancel</Link>
            </Button>
            <Button type="submit" disabled={createMember.isPending}>
              {createMember.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Create Member
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
