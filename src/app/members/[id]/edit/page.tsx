"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

type Member = {
  id: string
  amasi_number: number | null
  name: string | null
  email: string | null
  phone: string | null
  membership_type: string | null
  status: string | null
  voting_eligible: boolean | null
  asi_member_id: string | null
}
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
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"

const MEMBERSHIP_TYPES = [
  { value: "Life Member [LM]", label: "Life Member [LM]" },
  { value: "Associate Life Member [ALM]", label: "Associate Life Member [ALM]" },
  { value: "International Life Member [ILM]", label: "International Life Member [ILM]" },
  { value: "Associate Candidate Member [ACM]", label: "Associate Candidate Member [ACM]" },
]

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
]

export default function EditMemberPage() {
  const params = useParams()
  const memberId = params.id as string

  const [formData, setFormData] = useState({
    amasi_number: "",
    name: "",
    email: "",
    phone: "",
    membership_type: "",
    status: "",
    voting_eligible: false,
    asi_member_id: "",
  })

  const supabase = createClient()
  const queryClient = useQueryClient()
  const router = useRouter()

  // Fetch member data
  const { data: member, isLoading } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("id", memberId)
        .maybeSingle()

      if (error) throw error
      return data as Member
    },
    enabled: !!memberId,
  })

  // Populate form when member data loads
  useEffect(() => {
    if (member) {
      setFormData({
        amasi_number: member.amasi_number?.toString() || "",
        name: member.name || "",
        email: member.email || "",
        phone: member.phone?.toString() || "",
        membership_type: member.membership_type || "",
        status: member.status || "active",
        voting_eligible: member.voting_eligible || false,
        asi_member_id: member.asi_member_id || "",
      })
    }
  }, [member])

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

  // Update member mutation
  const updateMember = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("members")
        .update({
          amasi_number: formData.amasi_number ? parseInt(formData.amasi_number) : null,
          name: formData.name || null,
          email: formData.email || null,
          phone: formData.phone ? parseInt(formData.phone) : null,
          membership_type: formData.membership_type || member?.membership_type || null,
          status: formData.status || member?.status || "active",
          voting_eligible: formData.voting_eligible,
          asi_member_id: formData.asi_member_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", memberId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Member updated successfully")
      queryClient.invalidateQueries({ queryKey: ["members"] })
      queryClient.invalidateQueries({ queryKey: ["member", memberId] })
      router.push("/members")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMember.mutate()
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
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
              Edit Member
            </h1>
            <p className="text-sm text-muted-foreground">
              AMASI #{member?.amasi_number} - {member?.name}
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amasi_number">AMASI Number</Label>
                  <Input
                    id="amasi_number"
                    type="number"
                    value={formData.amasi_number}
                    onChange={(e) => handleChange("amasi_number", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
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
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="membership_type">Membership Type</Label>
                  <Select
                    key={`membership-${member?.id || 'new'}`}
                    defaultValue={member?.membership_type || undefined}
                    onValueChange={(v) => handleChange("membership_type", v)}
                  >
                    <SelectTrigger id="membership_type">
                      <SelectValue placeholder="Select type" />
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
                  <Label htmlFor="status">Status</Label>
                  <Select
                    key={`status-${member?.id || 'new'}`}
                    defaultValue={member?.status || undefined}
                    onValueChange={(v) => handleChange("status", v)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
            <Button type="submit" disabled={updateMember.isPending}>
              {updateMember.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
